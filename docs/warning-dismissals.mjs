// Acknowledgements apply to one missed send, not to future schedules or failures.
export function missedWarningKey(c, warning) {
  return JSON.stringify([warning.channel,warning.messageKind||'initial',c.start,warning.due]);
}
export function visibleWarnings(c, warnings) {
  return warnings.filter(w=>w.state!=='missed'||!c.warningDismissals?.[missedWarningKey(c,w)]);
}
export function dismissMissedWarning(c, warning, now=new Date()) {
  if(warning.state!=='missed')throw Error('Only missed publishing warnings can be dismissed.');
  const next=structuredClone(c),at=new Date(now).toISOString();
  next.warningDismissals={...next.warningDismissals,[missedWarningKey(c,warning)]:{at}};
  next.log=[...(next.log||[]),{at,channel:warning.channel,message:`Missed ${warning.messageKind==='followUp'?'follow-up':'publishing'} warning dismissed`}];
  next.revision=(next.revision||0)+1;
  return next;
}
