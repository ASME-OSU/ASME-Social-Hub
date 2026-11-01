import {eventIdentity} from './event-links.mjs';
import {memberEvent} from './event-model.mjs';
import {renderMemberBody} from './event-page.mjs';
export {memberEvent} from './event-model.mjs';

export function bindMemberArtwork(){
 const image=document.querySelector('#event-flyer'),link=document.querySelector('#event-flyer-link'),poster=document.querySelector('#event-poster');
 if(!image||!image.getAttribute('src'))return;
 const show=()=>{link.hidden=false;poster.hidden=true;},hide=()=>{link.hidden=true;poster.hidden=false;};
 image.addEventListener('load',show);image.addEventListener('error',hide);
 if(image.complete){if(image.naturalWidth)show();else hide();}
}

async function loadEvent() {
  const $=selector=>document.querySelector(selector),status=$('#event-status');
  try {
    const {year,id}=eventIdentity(location.search);
    const load=async path=>{let response;try{response=await fetch(path);}catch{throw Error('The event could not be loaded. Check your connection and try again.');}if(!response.ok)throw Error(response.status===404?'This event could not be found. Check the link or contact the chapter.':'The event is temporarily unavailable. Please try again.');return response.json();};
    const [config,campaign]=await Promise.all([load('./config/chapter.json'),load(`./data/campaigns/${encodeURIComponent(year)}/${encodeURIComponent(id)}.json`)]);
    if(campaign.year!==year||campaign.id!==id)throw Error('This event could not be found.');
    memberEvent(campaign,config);
    document.title=`${campaign.title} · ${config.chapterName||'Chapter event'}`;
    document.body.innerHTML=renderMemberBody(campaign,config,{site:new URL('./',location.href).href});
    document.body.classList.toggle('is-cancelled',Boolean(campaign.cancelled));
    bindMemberArtwork();
    return;
  } catch(error) {status.textContent=error.message||'The event could not be loaded. Please try again later.';status.classList.add('event-error');$('#event-recovery').hidden=false;$('#event-retry').hidden=/invalid|incomplete|no longer available|could not be found/.test(error.message);}
  finally {$('#event-content').setAttribute('aria-busy','false');}
}
if(typeof document!=='undefined'){if(document.body.dataset.eventRendered)bindMemberArtwork();else {document.querySelector('#event-retry')?.addEventListener('click',()=>location.reload());loadEvent();}}
