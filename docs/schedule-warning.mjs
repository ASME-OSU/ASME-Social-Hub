import {groupMeCadence,groupMeDue} from './groupme-schedule.mjs';
import {timeZoneName} from './display-time.mjs';
import {fireTime} from './time.mjs';

const labels={feed:'Instagram feed',story:'Instagram story',groupme:'GroupMe announcement'};
const WINDOW_MS=24*60*60*1000;

// Mirrors the dispatcher's 24-hour catch-up window; a past due time alone
// does not mean publishing has stopped being eligible.
export function scheduleWarnings(c, config, now=new Date()) {
  const current=+new Date(now),start=Date.parse(c.start);
  if(!Number.isFinite(current)||!Number.isFinite(start)||c.cancelled||c.deletedAt||c.demo||c.archived||c.year!==config.activeYear)return [];
  const warnings=[];
  for(const [channel,kind] of [['feed','initial'],['story','initial'],['groupme','initial'],['groupme','followUp']]) {
    const followUp=kind==='followUp';
    if(followUp&&(!c.campaign?.groupme?.followUp?.enabled||!c.results?.groupme?.botSentAt))continue;
    const result=(followUp?c.results?.groupme?.followUp:c.results?.[channel])||{},state=followUp?result.status:c.status?.[channel];
    if(state==='done'||['mediaId','postedAt','publishAttemptedAt','botSentAt','botAttemptedAt','eventId','createAttemptedAt'].some(key=>result[key]))continue;
    const lastLog=(c.log||[]).filter(entry=>entry.channel===channel).at(-1);
    const skippedMissed=state==='skipped'&&(['publishing-window-missed','announcement-window-missed','event-started'].includes(result.skipReason)||(!result.skipReason&&lastLog?.message==='Publishing window missed'));
    // A skipped channel never becomes due just because its time is changed.
    // Unrelated skips have their own cause and must not imply late eligibility.
    if(state==='skipped'&&!skippedMissed)continue;
    const bot=channel==='groupme';
    if(bot ? (config.integrations?.groupme?.enabled===false||config.integrations?.groupme?.mode!=='bot'||c.campaign?.groupme?.enabled!==true||c.campaign?.groupme?.announce!==true) : c.campaign?.[channel]?.enabled!==true)continue;
    const cadence=bot?groupMeCadence(c,config,kind):{...config.defaultCadence?.[channel],...c.campaign?.[channel],enabled:true};
    if(!Number.isInteger(cadence.daysBefore)||cadence.daysBefore<0||cadence.daysBefore>365||!/^([01]\d|2[0-3]):[0-5]\d$/.test(cadence.time))continue;
    let due;
    try {due=bot?groupMeDue(c,config,kind):fireTime({...c,campaign:{...c.campaign,[channel]:cadence}},channel,config.timezone);}catch{continue;}
    const dueAt=Date.parse(due);
    if(current<start&&current<=dueAt)continue;
    const scheduled=new Intl.DateTimeFormat('en-US',{timeZone:config.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(dueAt))+' '+timeZoneName(dueAt,config.timezone);
    const missed=skippedMissed||current>=start||current-dueAt>WINDOW_MS;
    const message=skippedMissed
      ? `${followUp?'GroupMe follow-up':labels[channel]} will not be posted: it is marked skipped after a missed publishing window. Scheduled for ${scheduled}. A posting time that is still in the past will not reopen it. Choose a future posting time and save the campaign.`
      : missed
      ? `${followUp?'GroupMe follow-up':labels[channel]} will not be posted: ${current>=start?'the event has already started':'the scheduled posting date has already passed and its 24-hour publishing window has closed'}. Scheduled for ${scheduled}. Choose a future posting time or reduce the number of days before the event.`
      : `${followUp?'GroupMe follow-up':labels[channel]} scheduled posting time has already passed (${scheduled}). It can still publish on the next dispatcher run within the 24-hour publishing window, before the event starts. Choose a future time if you do not want a late post.`;
    warnings.push({channel,messageKind:kind,state:missed?'missed':'late',due,message});
  }
  return warnings;
}
