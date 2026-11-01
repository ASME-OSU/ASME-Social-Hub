import {advertisingLines} from './caption.mjs';
import {httpsLink} from './event-links.mjs';
import {chapterTimeLabel,timeZoneName} from './display-time.mjs';
import {googleCalendarLink} from './calendar-links.mjs';

export function memberEvent(campaign,config) {
  if(campaign.deletedAt)throw Error('This event is no longer available. Please check with the chapter for updates.');
  if(!Number.isFinite(Date.parse(campaign.start)))throw Error('This event’s date is not available yet.');
  const timezone=config.timezone||'America/New_York',displayZone=campaign.allDay?'UTC':timezone,start=new Date(campaign.start),format=options=>new Intl.DateTimeFormat('en-US',{timeZone:displayZone,...options}).format(start);
  const end=Number.isFinite(Date.parse(campaign.end))?new Date(campaign.end):null;
  const dayFormat=new Intl.DateTimeFormat('en-US',{timeZone:displayZone,dateStyle:'full'});
  let timeRange=campaign.allDay?'All day':format({timeStyle:'short'});
  if(!campaign.allDay&&end){
    const endTime=new Intl.DateTimeFormat('en-US',{timeZone:timezone,timeStyle:'short'}).format(end);
    if(dayFormat.format(end)===dayFormat.format(start)){
      const startPeriod=timeRange.match(/ (AM|PM)$/)?.[1],endPeriod=endTime.match(/ (AM|PM)$/)?.[1];
      if(startPeriod===endPeriod)timeRange=timeRange.replace(/ (AM|PM)$/,'');
      timeRange+=`–${endTime}`;
    }else timeRange+=` – ${new Intl.DateTimeFormat('en-US',{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(end)}`;
  }
  const when=`${dayFormat.format(start)} · ${timeRange}`;
  const folder=`${encodeURIComponent(campaign.year)}/${encodeURIComponent(campaign.id)}`;
  const flyer=httpsLink(campaign.images?.feed||campaign.flyers?.feed||campaign.flyerUrls?.[0]||campaign.flyerUrl)||`./media/${folder}-feed.jpg`;
  return {title:campaign.title||'Chapter event',type:config.eventTypes?.find(t=>t.id===campaign.type)?.name||'Chapter event',day:format({day:'2-digit'}),month:format({month:'short',year:'numeric'}),weekday:format({weekday:'long'}),when,timeRange,timezone,timezoneLabel:campaign.allDay?'':`${chapterTimeLabel(timezone)} · ${timeZoneName(start,timezone)}`,googleCalendar:googleCalendarLink(campaign,timezone),location:typeof campaign.location==='string'?campaign.location:campaign.location?.name||'Location to be announced',address:typeof campaign.location==='object'?campaign.location?.address||'':'',description:campaign.description||'',advertising:advertisingLines(campaign,config).filter(line=>!line.startsWith('RSVP:')),rsvp:campaign.cancelled?'':httpsLink(campaign.advertising?.rsvpUrl),calendar:campaign.cancelled?'':`./calendar/${folder}.ics`,flyer,cancelled:Boolean(campaign.cancelled),demo:Boolean(campaign.demo)};
}

