import {advertisingLines} from './caption.mjs';
import {eventIdentity,httpsLink} from './event-links.mjs';

export function memberEvent(campaign,config) {
  if(campaign.deletedAt)throw Error('This event is no longer available. Please check with the chapter for updates.');
  if(!Number.isFinite(Date.parse(campaign.start)))throw Error('This event’s date is not available yet.');
  const timezone=config.timezone||'America/New_York',start=new Date(campaign.start),format=options=>new Intl.DateTimeFormat('en-US',{timeZone:timezone,...options}).format(start);
  const end=Number.isFinite(Date.parse(campaign.end))?new Date(campaign.end):null;
  const dayFormat=new Intl.DateTimeFormat('en-US',{timeZone:timezone,dateStyle:'full'});
  let when=dayFormat.format(start);
  if(campaign.allDay)when+=' · All day';
  else {
    when+=` · ${format({timeStyle:'short'})}`;
    if(end)when+=` – ${dayFormat.format(end)===dayFormat.format(start)?new Intl.DateTimeFormat('en-US',{timeZone:timezone,timeStyle:'short'}).format(end):new Intl.DateTimeFormat('en-US',{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(end)}`;
  }
  const folder=`${encodeURIComponent(campaign.year)}/${encodeURIComponent(campaign.id)}`;
  const flyer=httpsLink(campaign.images?.feed||campaign.flyers?.feed||campaign.flyerUrls?.[0]||campaign.flyerUrl)||`./media/${folder}-feed.jpg`;
  return {title:campaign.title||'Chapter event',type:config.eventTypes?.find(t=>t.id===campaign.type)?.name||'Chapter event',day:format({day:'2-digit'}),month:format({month:'short',year:'numeric'}),weekday:format({weekday:'long'}),when,timezone,location:typeof campaign.location==='string'?campaign.location:campaign.location?.name||'Location to be announced',address:typeof campaign.location==='object'?campaign.location?.address||'':'',description:campaign.description||'',advertising:advertisingLines(campaign,config).filter(line=>!line.startsWith('RSVP:')),rsvp:campaign.cancelled?'':httpsLink(campaign.advertising?.rsvpUrl),calendar:campaign.cancelled?'':`./calendar/${folder}.ics`,flyer,cancelled:Boolean(campaign.cancelled),demo:Boolean(campaign.demo)};
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
    for(const [selector,value] of Object.entries({'#event-chapter':config.chapterName||'Chapter events','#event-school':config.school||'','#event-title':model.title,'#poster-title':model.title,'#event-type':model.type,'#event-day':model.day,'#event-month':model.month,'#event-weekday':model.weekday,'#event-description':model.description,'#event-when':model.when,'#event-timezone':model.timezone.replaceAll('_',' '),'#event-location':model.location,'#event-address':model.address}))$(selector).textContent=value;
    const chapterLink=httpsLink(config.socialLinks?.linktree||config.socialLinks?.instagram);
    if(chapterLink)$('#chapter-link').href=chapterLink;else $('#chapter-link').removeAttribute('href');
    $('#event-address').hidden=!model.address;
    $('#event-description').hidden=!model.description;
    $('#event-cancelled').hidden=!model.cancelled;
    $('#event-example').hidden=!model.demo;
    $('#event-label').textContent=model.cancelled?'CANCELLED':model.demo?'EXAMPLE EVENT':'YOU’RE INVITED';
    if(model.cancelled)document.body.classList.add('is-cancelled');
    const details=$('#event-advertising');
    for(const line of model.advertising){const p=document.createElement('p');p.textContent=line;details.append(p);}
    details.hidden=!model.advertising.length;
    for(const [selector,href] of [['#event-rsvp',model.rsvp],['#event-calendar',model.calendar]]){const link=$(selector);link.hidden=!href;if(href)link.href=href;}
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
