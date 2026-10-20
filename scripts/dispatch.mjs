import {feedImageUrls} from '../docs/carousel.mjs';
import { readFile, mkdir, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateConfig, validateCampaign, fireAt, captionFor, readCampaigns, writeJson } from './core.mjs';
import { buildArchive } from './archive.mjs';
import { botAnnouncementText } from './groupme.mjs';

function safeHint(error) {
  const message=String(error?.message || '');
  if(/requires.*IG_USER_ID|requires.*IG_ACCESS_TOKEN|requires.*GROUPME_TOKEN|requires.*GROUPME_GROUP_ID|GROUPME_BOT_ID is required/.test(message)) return 'Configure the required Actions secrets, then retry after reconciling any recorded write intent.';
  if(/quota exhausted/.test(message)) return 'Instagram publishing quota is exhausted; retry within the publishing window after quota resets.';
  if(/flyer|image\/jpeg|HTTPS/.test(message)) return 'Verify that the rendered JPEG is deployed and publicly reachable at the recorded image URL.';
  if(/reconcil|missing.*ID|Missing.*identifier/i.test(message)) return 'Inspect the remote account before clearing a recorded write intent.';
  if(/processing|container/i.test(message)) return 'Inspect Instagram container processing; an existing container will be reused.';
  return 'Check Actions secrets, API availability, and the recorded processing stage.';
}

export async function dispatch({root=process.cwd(),now=new Date(),dryRun=false,services,checkpoint}={}) {
  now=new Date(now); if(!Number.isFinite(+now)) throw new Error('Invalid current time');
  const config=validateConfig(JSON.parse(await readFile(path.join(root,'config/chapter.json'),'utf8')));
  const lock=path.join(root,'data/.dispatch-lock');
  if(!dryRun) { await mkdir(path.dirname(lock),{recursive:true}); try { await mkdir(lock); } catch(e) { if(e.code==='EEXIST') throw new Error('Dispatcher lock exists; check for an active run before removing data/.dispatch-lock'); throw e; } }
  const actions=[];
  try {
    if(!dryRun && !services) { const [ig,gm]=await Promise.all([import('./ig.mjs'),import('./groupme.mjs')]); services={ig:ig.createInstagramClient(),groupme:gm.createGroupMeClient(),postBotMessage:gm.postBotMessage}; }
    for(const c of await readCampaigns(root)) {
      if(c.demo || c.archived || c.year!==config.activeYear) continue;
      validateCampaign(c);
      if(c.deletedAt) c.cancelled=true;
      const file=path.join(root,'data/campaigns',c.year,`${c.id}.json`);
      const save=async()=> { try { await writeJson(file,c); if(checkpoint) await checkpoint({root,file,campaign:c}); } catch(cause) { const error=new Error('Durable campaign checkpoint failed', {cause}); error.persistenceFailure=true; throw error; } };
      const log=(channel,message)=> { c.log.push({at:now.toISOString(),channel,message}); };
      if(!dryRun) { c.status??={}; c.results??={}; c.log??=[]; }
      for(const channel of ['feed','story','groupme']) {
        // Global integration switch also blocks updates, cancellations, and bot messages.
        if(channel==='groupme' && config.integrations?.groupme?.enabled===false) continue;
        const result=c.results?.[channel] || {};
        if(channel==='groupme' && config.integrations?.groupme?.mode==='bot') {
          if(c.campaign?.groupme?.enabled!==true || c.campaign?.groupme?.announce!==true || result.botSentAt) continue;
          const due=fireAt(c,'feed',config);
          if(result.botAttemptedAt) {
            actions.push({id:c.id,channel,action:'announce',outcome:'failed',error:{code:'BOT_RECONCILIATION_REQUIRED',stage:'bot'}});
            if(!dryRun && c.status.groupme!=='failed') { c.status.groupme='failed';c.results.groupme=result;result.error={code:'BOT_RECONCILIATION_REQUIRED',stage:'bot',at:now.toISOString()};log(channel,'Inspect GroupMe before clearing botAttemptedAt; announcement outcome is unresolved');await save(); }
            continue;
          }
          if(['done','skipped'].includes(c.status?.groupme)) continue;
          if(c.cancelled || now>=new Date(c.start) || (+now>=+due && +now-+due>86400000)) {
            if(c.status?.groupme!=='skipped') { actions.push({id:c.id,channel,action:'skip',reason:c.cancelled?'cancelled':'announcement-window-missed'}); if(!dryRun) { c.status.groupme='skipped'; c.results.groupme=result; result.skipReason=c.cancelled?'cancelled':'announcement-window-missed'; log(channel,'Bot announcement skipped'); await save(); } }
            continue;
          }
          if(now<due) continue;
          const action={id:c.id,channel,action:'announce',fireAt:due.toISOString()};actions.push(action);
          try {
            const text=botAnnouncementText(c,config);
            if(dryRun) { action.text=text; continue; }
            c.results.groupme=result;result.botText=text;result.botAttemptedAt=now.toISOString();await save();
            await services.postBotMessage(text);
            result.botSentAt=now.toISOString();delete result.error;delete result.skipReason;c.status.groupme='done';log(channel,'Bot announcement sent');
          } catch(error) {
            if(error.persistenceFailure) throw error;
            action.outcome='failed';action.error={code:result.botAttemptedAt?'BOT_OUTCOME_UNKNOWN':'BOT_PREPARATION_FAILED',stage:'bot',hint:result.botAttemptedAt?'Inspect GroupMe before clearing botAttemptedAt; this message will not automatically retry.':'Check announcement length, event date, timezone, and links.'};
            if(!dryRun) { c.results.groupme=result;result.error={...action.error,at:now.toISOString()};c.status.groupme='failed';log(channel,action.error.hint); }
          }
          if(!dryRun) await save();
          continue;
        }
        const disabled=c.campaign?.[channel]?.enabled===false;
        if(disabled && !(channel==='groupme' && c.cancelled && result.eventId)) {
          if(!dryRun && !result.mediaId && !(channel==='groupme' && result.eventId) && c.status[channel]!=='skipped') { c.status[channel]='skipped'; c.results[channel]=result; result.skipReason='disabled'; log(channel,'Channel disabled'); await save(); }
          continue;
        }
        if(!dryRun && result.skipReason==='disabled') { delete result.skipReason; c.status[channel]='pending'; await save(); }
        if(channel!=='groupme') {
          if(result.mediaId || c.status?.[channel]==='done' || c.status?.[channel]==='skipped' || c.cancelled || c.campaign?.[channel]?.enabled===false) continue;
          const due=fireAt(c,channel,config);
          if(now<due) continue;
          if(now>=new Date(c.start) || +now-+due>86400000) { actions.push({id:c.id,channel,action:'skip',fireAt:due.toISOString()}); if(!dryRun) { c.status[channel]='skipped'; c.results[channel]=result; result.skipReason='publishing-window-missed'; log(channel,'Publishing window missed'); await save(); } continue; }
          actions.push({id:c.id,channel,action:'publish',fireAt:due.toISOString()});
          if(dryRun) continue;
          c.results[channel]=result;
          try {
            if(result.publishAttemptedAt) throw new Error('Publication outcome requires reconciliation');
            if(result.preparedRevision !== undefined && result.preparedRevision !== (c.revision??0)) {
              delete result.containerId; delete result.image; delete result.images; delete result.caption;
            }
            result.preparedRevision=c.revision??0;
            const imageUrls=channel==='feed'?(result.images||feedImageUrls(c,config)):[];
            const imageUrl=result.image || imageUrls[0] || c.flyers?.[channel] || c.images?.[channel] || (config.siteUrl ? `${config.siteUrl.replace(/\/$/,'')}/media/${c.year}/${c.id}-${channel}.jpg` : null);
            if(!imageUrl || !/^https:\/\//.test(imageUrl)) throw new Error('Public HTTPS flyer URL is required');
            await services.ig.checkPublishingLimit?.();
            result.image=imageUrl;if(channel==='feed')result.images=imageUrls.length?imageUrls:[imageUrl]; result.caption=captionFor(c,config);
            if(!result.containerId) { result.containerId=await services.ig.createContainer({campaign:c,channel,imageUrl,imageUrls:channel==='feed'?result.images:undefined,caption:result.caption,config}); await save(); }
            await services.ig.waitForContainer(result.containerId);
            result.publishAttemptedAt=now.toISOString(); await save();
            try { const published=await services.ig.publishContainer(result.containerId); result.mediaId=typeof published==='string'?published:published.mediaId || published.id; if(!result.mediaId) throw new Error('Missing publication identifier'); } catch(e) { if(e.retrySafe) delete result.publishAttemptedAt; throw e; }
            result.postedAt=now.toISOString(); delete result.error; c.status[channel]='done'; log(channel,'Published'); await save();
            try { const media=await services.ig.getMedia(result.mediaId); if(media.permalink) result.permalink=media.permalink; } catch { log(channel,'Permalink lookup unavailable'); }
          } catch(error) { if(error.persistenceFailure) throw error; result.error={at:now.toISOString(),hint:safeHint(error),code:error.code && /^[A-Z_0-9]{1,40}$/.test(error.code)?error.code:'PUBLISH_FAILED',stage:result.publishAttemptedAt?'publish':result.containerId?'container-processing':'prepare'}; c.status[channel]='failed'; actions.at(-1).outcome='failed'; actions.at(-1).error=result.error; log(channel,result.publishAttemptedAt?'Publication outcome requires officer reconciliation before retry':'Publishing failed; check credentials, flyer availability, and API diagnostics'); }
          await save();
        } else {

          const revision=c.revision??0;
          const action=c.cancelled?(result.eventId && !result.deletedAt?'delete':null):result.eventId?(result.syncedRevision!==revision?'update':null):'create';
          if(!action) continue;
          if(!c.cancelled && now>=new Date(c.start)) {
            if(!result.eventId && !result.createAttemptedAt && c.status?.groupme!=='skipped') { actions.push({id:c.id,channel,action:'skip',reason:'event-started'}); if(!dryRun) { c.status.groupme='skipped'; c.results.groupme=result; result.skipReason='event-started'; log(channel,'Event already started; creation window missed'); await save(); } }
            continue;
          }
          actions.push({id:c.id,channel,action}); if(dryRun) continue;
          c.results.groupme=result;
          try {
            if(result.createAttemptedAt && !result.eventId) throw new Error('Creation outcome requires reconciliation');
            if(action==='create') {
              result.createAttemptedAt=now.toISOString(); await save();
              try { Object.assign(result,await services.groupme.createEvent(c,config)); if(!result.eventId) throw new Error('Missing event identifier'); } catch(e) { if(e.retrySafe) delete result.createAttemptedAt; throw e; }
            } else if(action==='update') await services.groupme.updateEvent(result.eventId,c,config);
            else { await services.groupme.deleteEvent(result.eventId,config); result.deletedAt=now.toISOString(); }
            result.syncedRevision=revision; delete result.error; c.status.groupme='done'; log(channel,`Event ${action} completed`);
          } catch(error) { if(error.persistenceFailure) throw error; result.error={at:now.toISOString(),hint:safeHint(error),code:error.code && /^[A-Z_0-9]{1,40}$/.test(error.code)?error.code:'GROUPME_SYNC_FAILED',stage:action}; c.status.groupme='failed'; actions.at(-1).outcome='failed'; actions.at(-1).error=result.error; log(channel,result.createAttemptedAt&&!result.eventId?'Event creation outcome requires officer reconciliation before retry':'Event sync failed; will retry'); }
          await save();
          if(c.campaign?.groupme?.announce === true && !c.cancelled && !result.botAttemptedAt && services.postBotMessage) {
            const calendarUrl=config.siteUrl ? `${config.siteUrl.replace(/\/$/,'')}/calendar/${c.year}/${c.id}.ics` : null;
            const link=result.url || result.eventUrl || calendarUrl;
            if(link) {
              result.botAttemptedAt=now.toISOString(); await save();
              try { await services.postBotMessage(`${c.title} — ${link}`); result.botSentAt=now.toISOString(); log(channel,'Announcement sent'); }
              catch { result.botError='Announcement outcome unknown; inspect GroupMe before retry'; log(channel,result.botError); }
              await save();
            }
          }
        }
      }
    }
    if(!dryRun) {
      await buildArchive(root);
      const file=path.join(root,'data/dispatcher-health.json');
      const previous=await readFile(file,'utf8').then(JSON.parse).catch(error=>{if(error.code==='ENOENT')return {};throw error;});
      const completedAt=new Date().toISOString(),success=!actions.some(a=>a.outcome==='failed');
      await writeJson(file,{...previous,lastLiveRunAt:completedAt,lastLiveRunStatus:success?'success':'failed',...(success?{lastSuccessfulLiveRunAt:completedAt}:{}),runId:process.env.GITHUB_RUN_ID||null,event:process.env.GITHUB_EVENT_NAME||'local'});
    }
    return actions;
  } finally { if(!dryRun) await rmdir(lock); }
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) dispatch({dryRun:process.argv.includes('--dry-run'),checkpoint:process.env.CAMPAIGN_GIT_CHECKPOINT==='1' ? (await import('./git-checkpoint.mjs')).gitCheckpoint : undefined}).then(actions=>{ console.log(JSON.stringify({actions,failures:actions.filter(a=>a.outcome==='failed')},null,2)); if(actions.some(a=>a.outcome==='failed')) process.exitCode=1; }).catch(()=>{console.error('Dispatch failed. Check configuration, campaign validation, and dispatcher lock.');process.exitCode=1;});
