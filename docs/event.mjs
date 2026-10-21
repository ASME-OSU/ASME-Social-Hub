import {advertisingLines} from './caption.mjs';
import {eventIdentity,httpsLink} from './event-links.mjs';
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

async function loadEvent() {
  const $=selector=>document.querySelector(selector),status=$('#event-status');
  try {
    const {year,id}=eventIdentity(location.search);
    const load=async path=>{const response=await fetch(path);if(!response.ok)throw Error('This event could not be found. Please check the link or try again later.');return response.json();};
    const [config,campaign]=await Promise.all([load('./config/chapter.json'),load(`./data/campaigns/${encodeURIComponent(year)}/${encodeURIComponent(id)}.json`)]);
    if(campaign.year!==year||campaign.id!==id)throw Error('This event could not be found.');
    const model=memberEvent(campaign,config);
    document.title=`${model.title} · ${config.chapterName||'Chapter event'}`;
    for(const [selector,value] of Object.entries({'#event-chapter':config.chapterName||'Chapter events','#event-school':config.school||'','#event-type':model.type,'#event-day':model.day,'#event-month':model.month,'#event-weekday':model.weekday,'#event-description':model.description,'#event-when':model.timeRange,'#event-timezone':model.timezoneLabel,'#event-location':model.location,'#event-address':model.address}))$(selector).textContent=value;
    // Keep long compound titles readable without introducing markup from event text.
    for(const selector of ['#event-title','#poster-title']){
      const title=$(selector);title.replaceChildren();
      const parts=model.title.split('/');
      parts.forEach((part,index)=>{title.append(document.createTextNode(part+(index<parts.length-1?'/':'')));if(index<parts.length-1)title.append(document.createElement('wbr'));});
    }
    $('#event-when').setAttribute('aria-label',model.when);
    const chapterLink=httpsLink(config.socialLinks?.linktree||config.socialLinks?.instagram);
    if(chapterLink)$('#chapter-link').href=chapterLink;else $('#chapter-link').removeAttribute('href');
    $('#event-address').hidden=!model.address;
    $('#event-timezone').hidden=!model.timezoneLabel;
    $('#event-description').hidden=!model.description;
    $('#event-cancelled').hidden=!model.cancelled;
    $('#event-example').hidden=!model.demo;
    $('#event-label').textContent=model.cancelled?'CANCELLED':model.demo?'EXAMPLE EVENT':'';
    $('#event-label').hidden=!model.cancelled&&!model.demo;
    if(model.cancelled)document.body.classList.add('is-cancelled');
    const details=$('#event-advertising');
    for(const line of model.advertising){const p=document.createElement('p');p.textContent=line;details.append(p);}
    details.hidden=!model.advertising.length;
    for(const [selector,href] of [['#event-rsvp',model.rsvp],['#event-calendar',model.calendar],['#event-google-calendar',model.googleCalendar]]){const link=$(selector);link.hidden=!href;if(href)link.href=href;}
    $('.event-actions').hidden=!model.rsvp;
    $('#event-calendar-actions').hidden=!model.calendar&&!model.googleCalendar;
    const image=$('#event-flyer'),flyerLink=$('#event-flyer-link'),poster=$('#event-poster');
    image.alt=`Flyer for ${model.title}`;
    image.addEventListener('load',()=>{flyerLink.hidden=false;poster.hidden=true;});
    image.addEventListener('error',()=>{flyerLink.hidden=true;poster.hidden=false;});
    flyerLink.href=model.flyer;image.src=model.flyer;
    status.hidden=true;$('.event-layout').hidden=false;
  } catch(error) {status.textContent=error.message||'The event could not be loaded. Please try again later.';status.classList.add('event-error');}
  finally {$('#event-content').setAttribute('aria-busy','false');}
}
if(typeof document!=='undefined')loadEvent();
