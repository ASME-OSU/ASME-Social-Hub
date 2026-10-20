import {fireTime} from './time.mjs';

const labels={feed:'Instagram feed',story:'Instagram story',groupme:'GroupMe announcement'};
const WINDOW_MS=24*60*60*1000;

// Mirrors the dispatcher's 24-hour catch-up window; a past due time alone
// does not mean publishing has stopped being eligible.
export function scheduleWarnings(c, config, now=new Date()) {
  const current=+new Date(now),start=Date.parse(c.start);
  if(!Number.isFinite(current)||!Number.isFinite(start)||c.cancelled||c.deletedAt||c.demo||c.archived||c.year!==config.activeYear)return [];
  const warnings=[];
  for(const channel of ['feed','story','groupme']) {
    const result=c.results?.[channel]||{};
    if(c.status?.[channel]==='done'||['mediaId','postedAt','publishAttemptedAt','botSentAt','botAttemptedAt','eventId','createAttemptedAt'].some(key=>result[key]))continue;
    const lastLog=(c.log||[]).filter(entry=>entry.channel===channel).at(-1);
    const skippedMissed=c.status?.[channel]==='skipped'&&(['publishing-window-missed','announcement-window-missed','event-started'].includes(result.skipReason)||(!result.skipReason&&lastLog?.message==='Publishing window missed'));
    // A skipped channel never becomes due just because its time is changed.
    // Unrelated skips have their own cause and must not imply late eligibility.
    if(c.status?.[channel]==='skipped'&&!skippedMissed)continue;
    const bot=channel==='groupme';
    if(bot ? (config.integrations?.groupme?.enabled===false||config.integrations?.groupme?.mode!=='bot'||c.campaign?.groupme?.enabled!==true||c.campaign?.groupme?.announce!==true) : c.campaign?.[channel]?.enabled!==true)continue;
    const cadence={...config.defaultCadence?.[bot?'feed':channel],...c.campaign?.[bot?'feed':channel],enabled:true};
    if(!Number.isInteger(cadence.daysBefore)||cadence.daysBefore<0||cadence.daysBefore>365||!/^([01]\d|2[0-3]):[0-5]\d$/.test(cadence.time))continue;
    let due;
    try {due=fireTime({...c,campaign:{...c.campaign,[bot?'feed':channel]:cadence}},bot?'feed':channel,config.timezone);}catch{continue;}
    const dueAt=Date.parse(due);
    if(current<start&&current<=dueAt)continue;
    const scheduled=new Intl.DateTimeFormat('en-US',{timeZone:config.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(dueAt))+' ('+config.timezone+')';
    const missed=skippedMissed||current>=start||current-dueAt>WINDOW_MS;
    const message=skippedMissed
      ? `${labels[channel]} will not be posted: it is marked skipped after a missed publishing window. Scheduled for ${scheduled}. A posting time that is still in the past will not reopen it. Choose a future posting time and save the campaign.`
      : missed
      ? `${labels[channel]} will not be posted: ${current>=start?'the event has already started':'the scheduled posting date has already passed and its 24-hour publishing window has closed'}. Scheduled for ${scheduled}. Choose a future posting time or reduce the number of days before the event.`
      : `${labels[channel]} scheduled posting time has already passed (${scheduled}). It can still publish on the next dispatcher run within the 24-hour publishing window, before the event starts. Choose a future time if you do not want a late post.`;
    warnings.push({channel,state:missed?'missed':'late',due,message});
  }
  return warnings;
}
