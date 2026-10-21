// Display labels only. Scheduling and calendar payloads keep the IANA timezone.
export function timeZoneName(instant,zone='America/New_York') {
  const date=new Date(instant);
  if(!Number.isFinite(+date))return '';
  return new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'short'}).formatToParts(date).find(part=>part.type==='timeZoneName')?.value||'';
}
export function chapterTimeLabel(zone='America/New_York') {
  if(zone==='America/New_York')return 'Columbus time';
  if(['UTC','Etc/UTC','GMT'].includes(zone))return 'UTC';
  return `${String(zone).split('/').at(-1).replaceAll('_',' ')} time`;
}
