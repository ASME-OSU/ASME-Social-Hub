// Wall-clock input is always interpreted in the chapter timezone.
export function localInput(instant, zone) {
  if (!instant) return '';
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(instant)).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function fromLocal(value, zone) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw Error('Enter a complete date and time.');
  const nominal = Date.parse(value+'Z');
  if (!Number.isFinite(nominal) || new Date(nominal).toISOString().slice(0,16)!==value) throw Error('Enter a valid date and time.');
  const offsets = new Set();
  for (let h=-36; h<=36; h+=6) {
    const t=nominal+h*3600000;
    offsets.add(Date.parse(localInput(t,zone)+'Z')-t);
  }
  const matches=[...offsets].map(o=>nominal-o).filter(t=>localInput(t,zone)===value);
  if (!matches.length) throw Error('This time does not exist because of daylight saving time. Choose another time.');
  if (matches.length>1) throw Error('This time occurs twice because of daylight saving time. Choose a time outside the repeated hour.');
  return new Date(matches[0]).toISOString();
}
export function fireTime(c, channel, zone) {
 const cadence=c.campaign?.[channel]; if (!cadence?.enabled) return null;
 const date=localInput(c.start,zone).slice(0,10);
 const day=new Date(date+'T12:00:00Z'); day.setUTCDate(day.getUTCDate()-Number(cadence.daysBefore));
 return fromLocal(day.toISOString().slice(0,10)+'T'+cadence.time,zone);
}
