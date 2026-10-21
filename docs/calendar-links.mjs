export function googleCalendarLink(campaign,timezone='America/New_York') {
  const start=new Date(campaign.start),end=new Date(campaign.end);
  if(campaign.cancelled||campaign.deletedAt||!Number.isFinite(+start)||!Number.isFinite(+end)||+end<=+start)return '';
  // Google Calendar accepts UTC timestamps for timed events and exclusive-end dates for all-day events.
  const stamp=date=>campaign.allDay?date.toISOString().slice(0,10).replaceAll('-',''):date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const url=new URL('https://calendar.google.com/calendar/render');
  const location=typeof campaign.location==='string'?campaign.location:campaign.location?.name||'';
  for(const [key,value] of Object.entries({action:'TEMPLATE',text:campaign.title||'Chapter event',dates:`${stamp(start)}/${stamp(end)}`,details:campaign.description||'',location,ctz:timezone}))url.searchParams.set(key,value);
  return url.href;
}
