import {fireTime} from './time.mjs';

// Only explicit missed-window skips may reopen. All recorded progress is retained.
function reopenCampaign(c, previous, config, now=new Date()) {
  now=+new Date(now);
  if(!previous || c.cancelled || c.deletedAt || c.archived || c.demo || c.year!==config.activeYear || !(Date.parse(c.start)>+now)) return c;
  c=structuredClone(c);
  for(const channel of ['feed','story','groupme']) {
    const result=c.results?.[channel]||{};
    const lastLog=(previous.log||[]).filter(entry=>entry.channel===channel).at(-1);
    const legacyMissed=!result.skipReason && lastLog?.message==='Publishing window missed';
    if(c.status?.[channel]!=='skipped' || previous.status?.[channel]==='done' || !(legacyMissed || ['publishing-window-missed','announcement-window-missed','event-started'].includes(result.skipReason))) continue;
    if(['publishAttemptedAt','containerId','mediaId','postedAt','botAttemptedAt','botSentAt','createAttemptedAt','eventId','createdAt','deletedAt'].some(k=>result[k]||previous.results?.[channel]?.[k])) continue;
    const bot=channel==='groupme' && config.integrations?.groupme?.mode==='bot';
    if(channel==='groupme' && (config.integrations?.groupme?.enabled===false || !bot)) continue;
    if(channel==='groupme' ? !(c.campaign?.groupme?.enabled===true && c.campaign?.groupme?.announce===true && previous.campaign?.groupme?.enabled===true && previous.campaign?.groupme?.announce===true) : c.campaign?.[channel]?.enabled!==true || previous.campaign?.[channel]?.enabled===false) continue;
    const schedule=x=>fireTime(bot?{...x,campaign:{...x.campaign,feed:{...x.campaign?.feed,enabled:true}}}:x,bot?'feed':channel,config.timezone);
    try {
      const due=schedule(c),before=schedule(previous);
      if(due===before || !(Date.parse(due)>+now)) continue;
      c.status[channel]='pending';c.results??={};c.results[channel]??={};delete c.results[channel].skipReason;
    } catch { /* Invalid schedules remain skipped for validation. */ }
  }
  return c;
}

/** Compatibility for the deployed editor; new callers receive the full merged record. */
export function reopenMissedChannels(c, previous, config, now=new Date()) {
  if(arguments.length===1 && c && Object.hasOwn(c,'next')) {
    const {previous:before,next,status,zone,groupmeBot=false,now:at=new Date()}=c;
    if(!before)return status;
    const year=next.year||before.year||'legacy';
    const results={...before.results,...next.results};
    for(const channel of ['feed','story','groupme'])results[channel]={...before.results?.[channel],...next.results?.[channel]};
    const draft={...before,...next,year,status:{...before.status,...status},results};
    const chapter={activeYear:year,timezone:zone,integrations:{groupme:{enabled:groupmeBot,mode:groupmeBot?'bot':'native'}}};
    return reopenCampaign(draft,{...before,year},chapter,at).status;
  }
  return reopenCampaign(c,previous,config,now);
}

/** Legacy date-only warning; publishing eligibility is checked by scheduleWarnings. */
export function scheduleWarning(dueIso,now=new Date()) {
  if(!dueIso)return null;
  const late=+new Date(now)-Date.parse(dueIso);
  if(!Number.isFinite(late)||late<=0)return null;
  return late>86400000
    ?{level:'skipped',text:'The posting date has already passed and the 24-hour publishing window has closed. This post will not be posted. Choose a future posting time.'}
    :{level:'late',text:'This posting time has passed. An eligible pending channel can still publish on the next dispatcher run within 24 hours and before the event starts. Scheduled runs can be delayed.'};
}
