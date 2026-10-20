import {captionFor} from './caption.mjs';
import {feedImageUrls} from './carousel.mjs';

const paths={heart:'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',comment:'M21 11.5a8.4 8.4 0 0 1-.9 3.8A8.5 8.5 0 0 1 12.5 20a8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z',share:'m22 2-7 20-4-9-9-4 20-7Zm0 0L11 13',save:'M19 21l-7-5-7 5V3h14v18Z'};
function icon(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;}
export function instagramHandle(config){return String(config.instagramHandle||config.brand?.shortName||config.chapterName||'chapter').replace(/^@/,'');}
export function safePreviewImage(value){if(typeof value!=='string'||!value.trim())return '';try{const url=new URL(value,typeof document==='undefined'?'https://preview.invalid/':document.baseURI);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:'';}catch{return '';}}

// Direction is based on deliberate horizontal motion, not a diagonal page-scroll gesture.
export function classifySwipe(start,end,{minDistance=40,dominance=1.5}={}) {
  if(![start?.x,start?.y,end?.x,end?.y].every(Number.isFinite))return null;
  const dx=end.x-start.x,dy=end.y-start.y;
  if(Math.abs(dx)<minDistance||Math.abs(dx)<=Math.abs(dy)*dominance)return null;
  return dx<0?'next':'previous';
}

// Media stays independent from the Instagram chrome: native artwork sizes and exports are unchanged.
export function createInstagramPost({media,config={},caption='',captionError='',count=1,index=0,onPrevious,onNext}={}) {
  const root=document.createElement('article');root.className='ig-post';root.setAttribute('aria-label','Instagram feed preview');
  root.innerHTML=`<div class="ig-header"><span class="ig-avatar" aria-hidden="true"></span><div class="ig-account"><strong></strong><small></small></div><span class="ig-more" aria-hidden="true">•••</span></div><div class="ig-media"><div class="ig-carousel" hidden><button type="button" class="ig-previous" aria-label="Previous carousel image">‹</button><span class="ig-position" aria-live="polite"></span><button type="button" class="ig-next" aria-label="Next carousel image">›</button></div></div><div class="ig-body"><div class="ig-actions" aria-hidden="true"><span>${icon('heart')}</span><span>${icon('comment')}</span><span>${icon('share')}</span><span class="ig-save">${icon('save')}</span></div><div class="ig-caption" tabindex="0" role="region" aria-label="Instagram caption; scroll to read"><strong class="ig-caption-handle"></strong><span class="ig-caption-text"></span></div><p class="ig-caption-error" role="status" hidden></p><small class="ig-preview-note">Instagram preview · appearance may vary</small></div>`;
  const mediaSlot=root.querySelector('.ig-media');if(media)mediaSlot.append(media);
  let currentCount=count,currentIndex=index,storyOnly=false,gesture=null;
  function navigable(){return currentCount>1&&!storyOnly;}
  function navigate(direction){
    if(!navigable())return;
    if(direction==='next'&&currentIndex<currentCount-1)onNext?.();
    if(direction==='previous'&&currentIndex>0)onPrevious?.();
  }
  function syncNavigation(){
    const active=navigable();mediaSlot.classList.toggle('ig-swipeable',active);mediaSlot.tabIndex=active?0:-1;
    mediaSlot.setAttribute('role','group');mediaSlot.setAttribute('aria-label',active?`Instagram carousel image ${currentIndex+1} of ${currentCount}; swipe or use Left and Right arrow keys`:'Instagram post image');
    mediaSlot.setAttribute('aria-keyshortcuts',active?'ArrowLeft ArrowRight':'');
  }
  root.querySelector('.ig-previous').addEventListener('click',()=>navigate('previous'));root.querySelector('.ig-next').addEventListener('click',()=>navigate('next'));
  mediaSlot.addEventListener('dragstart',event=>event.preventDefault());
  mediaSlot.addEventListener('keydown',event=>{
    if(event.target!==mediaSlot||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||!navigable())return;
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();navigate(event.key==='ArrowLeft'?'previous':'next');}
  });
  mediaSlot.addEventListener('pointerdown',event=>{
    if(!navigable()||event.isPrimary===false||event.button!==0||event.target.closest('button,a,input,select,textarea'))return;
    gesture={pointerId:event.pointerId,start:{x:event.clientX,y:event.clientY},axis:null,index:currentIndex};
    try{mediaSlot.setPointerCapture(event.pointerId);}catch{ /* Synthetic events do not have an active pointer. */ }
  });
  mediaSlot.addEventListener('pointermove',event=>{
    if(!gesture||event.pointerId!==gesture.pointerId)return;
    const dx=Math.abs(event.clientX-gesture.start.x),dy=Math.abs(event.clientY-gesture.start.y);
    if(!gesture.axis&&Math.max(dx,dy)>=8)gesture.axis=dx>dy*1.5?'horizontal':'vertical';
    if(gesture.axis==='horizontal'&&event.cancelable)event.preventDefault();
  });
  mediaSlot.addEventListener('pointerup',event=>{
    if(!gesture||event.pointerId!==gesture.pointerId)return;
    const completed=gesture;gesture=null;
    if(completed.axis==='vertical'||completed.index!==currentIndex)return;
    const direction=classifySwipe(completed.start,{x:event.clientX,y:event.clientY});
    if(direction)navigate(direction);
  });
  for(const type of ['pointercancel','lostpointercapture'])mediaSlot.addEventListener(type,event=>{if(gesture?.pointerId===event.pointerId)gesture=null;});
  function update({config:nextConfig=config,caption:nextCaption=caption,captionError:nextError='',count:nextCount=1,index:nextIndex=0}={}){
    config=nextConfig;caption=nextCaption;currentCount=nextCount;currentIndex=nextIndex;syncNavigation();
    const handle=instagramHandle(config);root.querySelector('.ig-account strong').textContent=handle;root.querySelector('.ig-account small').textContent=config.chapterName||'Instagram feed';root.querySelector('.ig-caption-handle').textContent=handle+' ';root.querySelector('.ig-caption-text').textContent=caption;
    const avatar=root.querySelector('.ig-avatar'),logo=config.brand?.logoMark||config.brand?.logoPrimary||config.brand?.logo;
    avatar.replaceChildren();const safe=logo&&safePreviewImage(logo);if(safe){const image=document.createElement('img');image.alt='';image.src=safe;image.addEventListener('error',()=>{avatar.textContent=handle.slice(0,1).toUpperCase();},{once:true});avatar.append(image);}else avatar.textContent=handle.slice(0,1).toUpperCase();
    root.querySelector('.ig-carousel').hidden=nextCount<2;root.querySelector('.ig-position').textContent=`${nextIndex+1} / ${nextCount}`;root.querySelector('.ig-previous').disabled=nextIndex<=0;root.querySelector('.ig-next').disabled=nextIndex>=nextCount-1;
    const error=root.querySelector('.ig-caption-error');error.textContent=nextError;error.hidden=!nextError;
  }
  update({config,caption,captionError,count,index});
  return {root,media:mediaSlot,update,setStory(story){if(storyOnly!==story)gesture=null;storyOnly=story;root.classList.toggle('ig-story-only',story);syncNavigation();},chromeHeight(){return root.classList.contains('ig-story-only')?0:root.querySelector('.ig-header').offsetHeight+root.querySelector('.ig-body').offsetHeight;}};
}

export function instagramPreviewContent(campaign,config,{images}={}) {
  let caption='',captionError='';try{caption=campaign.results?.feed?.caption??captionFor(campaign,config);}catch(error){captionError=error.message;}
  const recorded=campaign.results?.feed;
  const sources=(images||recorded?.images||(recorded?.image?[recorded.image]:feedImageUrls(campaign,config))).map(safePreviewImage).filter(Boolean);
  return {caption,captionError,images:sources,handle:instagramHandle(config)};
}
export function mountCampaignInstagramPreview(container,campaign,config,options={}) {
  const {caption,captionError,images:sources}=instagramPreviewContent(campaign,config,options);
  const media=document.createElement('div');media.className='ig-detail-image';const image=document.createElement('img');image.alt=campaign.title+' · Instagram feed';media.append(image);
  const unavailable=document.createElement('p');unavailable.className='ig-image-unavailable';unavailable.textContent='Image preview unavailable. Check again after rendering finishes.';unavailable.hidden=true;media.append(unavailable);
  let index=0;
  const show=()=>{unavailable.hidden=true;image.hidden=false;image.src=sources[index]||'';post.update({config,caption,captionError,count:Math.max(1,sources.length),index});};
  image.addEventListener('error',()=>{image.hidden=true;unavailable.hidden=false;});
  const post=createInstagramPost({media,config,caption,captionError,count:Math.max(1,sources.length),onPrevious(){if(index>0){index--;show();}},onNext(){if(index<sources.length-1){index++;show();}}});
  post.root.classList.add('ig-detail-post');container.replaceChildren(post.root);show();return post;
}
