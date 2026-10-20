import {fireTime} from './time.mjs';

// Only explicit missed-window skips may reopen. All recorded progress is retained.
export function reopenMissedChannels(c, previous, config, now=new Date()) {
  if(!previous || c.cancelled || c.archived || c.demo || c.year!==config.activeYear || !(Date.parse(c.start)>+now)) return c;
  c=structuredClone(c);
  for(const channel of ['feed','story','groupme']) {
    const result=c.results?.[channel]||{};
    const lastLog=(previous.log||[]).filter(entry=>entry.channel===channel).at(-1);
    const legacyMissed=!result.skipReason && lastLog?.message==='Publishing window missed';
    if(c.status?.[channel]!=='skipped' || !(legacyMissed || ['publishing-window-missed','announcement-window-missed','event-started'].includes(result.skipReason))) continue;
    if(['publishAttemptedAt','containerId','mediaId','postedAt','botAttemptedAt','botSentAt','createAttemptedAt','eventId','createdAt','deletedAt'].some(k=>result[k])) continue;
    const bot=channel==='groupme' && config.integrations?.groupme?.mode==='bot';
    if(channel==='groupme' && (config.integrations?.groupme?.enabled===false || !bot)) continue;
    if(channel==='groupme' ? !(c.campaign?.groupme?.enabled===true && c.campaign?.groupme?.announce===true) : c.campaign?.[channel]?.enabled!==true) continue;
    const schedule=x=>fireTime(bot?{...x,campaign:{...x.campaign,feed:{...x.campaign?.feed,enabled:true}}}:x,bot?'feed':channel,config.timezone);
    try {
      const due=schedule(c),before=schedule(previous);
      if(due===before || !(Date.parse(due)>+now)) continue;
      c.status[channel]='pending';c.results??={};c.results[channel]??={};delete c.results[channel].skipReason;
    } catch { /* Invalid schedules remain skipped for validation. */ }
  }
  return c;
}
