import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fireAt, readCampaigns, writeJson} from './core.mjs';

const text = value => typeof value === 'string' ? value : null;
const integer = value => Number.isInteger(value) && value >= 0 ? value : null;
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const sourceIdentity = value => ({uid:text(value?.uid),calendarUid:text(value?.calendarUid)});
function cadence(value) {
  return {daysBefore:integer(value?.daysBefore),time:text(value?.time)};
}
function deadline(campaign, channel, config) {
  try { return {dueAt:fireAt(campaign,channel,config).toISOString(),scheduleInvalid:false}; }
  catch { return {dueAt:null,scheduleInvalid:true}; }
}
function channelHealth(campaign, channel, config) {
  const schedule=campaign.campaign?.[channel], result=campaign.results?.[channel];
  const groupme=channel==='groupme',bot=groupme && config.integrations?.groupme?.mode==='bot';
  const enabled=groupme
    ? config.integrations?.groupme?.enabled!==false && (bot ? schedule?.enabled===true && schedule?.announce===true : schedule?.enabled!==false)
    : schedule?.enabled!==false;
  const timing=groupme && !bot ? {dueAt:null,scheduleInvalid:false} : deadline(campaign,groupme?'feed':channel,config);
  return {
    enabled,...timing,immediate:groupme && !bot,
    schedule:groupme ? {createAt:text(schedule?.createAt),announce:schedule?.announce===true} : cadence({...config.defaultCadence?.[channel],...schedule}),
    status:text(campaign.status?.[channel]),
    mediaId:text(result?.mediaId),postedAt:timestamp(result?.postedAt),
    eventId:text(result?.eventId),syncedRevision:integer(result?.syncedRevision),
    botSentAt:timestamp(result?.botSentAt),deletedAt:timestamp(result?.deletedAt),
    publishAttemptedAt:timestamp(result?.publishAttemptedAt),
    createAttemptedAt:timestamp(result?.createAttemptedAt),botAttemptedAt:timestamp(result?.botAttemptedAt),
  };
}
async function optionalJson(file) {
  try { return JSON.parse(await readFile(file,'utf8')); }
  catch(error) { if(error.code==='ENOENT') return null; throw error; }
}
export function postingHealth({config,campaigns,candidates,tokenWarning,now=new Date()}) {
  return {
    schemaVersion:1,generatedAt:now.toISOString(),activeYear:text(config.activeYear),
    config:{timezone:text(config.timezone),defaultCadence:{feed:cadence(config.defaultCadence?.feed),story:cadence(config.defaultCadence?.story)},groupme:{enabled:config.integrations?.groupme?.enabled!==false,mode:config.integrations?.groupme?.mode==='bot'?'bot':'native'}},
    tokenWarning:tokenWarning ? {status:text(tokenWarning.status),warning:tokenWarning.warning===true,configured:tokenWarning.configured===true,checkedAt:timestamp(tokenWarning.checkedAt),expiresAt:timestamp(tokenWarning.expiresAt),daysRemaining:Number.isFinite(tokenWarning.daysRemaining)?tokenWarning.daysRemaining:null} : null,
    calendar:{feedUrl:text(config.icalUrl),generatedAt:timestamp(candidates?.generatedAt),candidates:(Array.isArray(candidates?.events)?candidates.events:[]).map(event=>{
      const feed=deadline({start:event.start},'feed',config),story=deadline({start:event.start},'story',config);
      return {id:text(event.id),title:text(event.title),start:text(event.start),end:text(event.end),allDay:event.allDay===true,uid:text(event.source?.uid),source:sourceIdentity(event.source),dueAt:{feed:feed.dueAt,story:story.dueAt},scheduleInvalid:{feed:feed.scheduleInvalid,story:story.scheduleInvalid}};
    })},
    campaigns:campaigns.map(campaign=>({
      id:text(campaign.id),year:text(campaign.year),title:text(campaign.title),start:text(campaign.start),end:text(campaign.end),
      demo:Boolean(campaign.demo),cancelled:Boolean(campaign.cancelled),archived:Boolean(campaign.archived),source:sourceIdentity(campaign.source),revision:integer(campaign.revision)??0,
      channels:Object.fromEntries(['feed','story','groupme'].map(channel=>[channel,channelHealth(campaign,channel,config)])),
    })),
  };
}
export async function writePostingHealth(root=process.cwd(),{campaigns,config,now=new Date()}={}) {
  config??=JSON.parse(await readFile(resolve(root,'config/chapter.json'),'utf8'));
  campaigns??=await readCampaigns(root);
  const [candidates,tokenWarning]=await Promise.all([optionalJson(resolve(root,'data/candidates.json')),optionalJson(resolve(root,'data/token-warning.json'))]);
  const health=postingHealth({config,campaigns,candidates,tokenWarning,now});
  await writeJson(resolve(root,'docs/data/posting-health.json'),health);
  return health;
}
