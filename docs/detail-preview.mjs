import {instagramPreviewContent,mountCampaignInstagramPreview,safePreviewImage} from './instagram-preview.mjs';

let dialog,canvas,title,returnFocus;
function artworkDialog() {
  if(dialog)return dialog;
  dialog=document.createElement('dialog');dialog.id='detail-artwork-dialog';dialog.setAttribute('aria-labelledby','detail-artwork-title');
  dialog.innerHTML='<div class="detail-artwork-heading"><h2 id="detail-artwork-title"></h2><button type="button" class="detail-artwork-close" aria-label="Close enlarged artwork">×</button></div><div class="detail-artwork-canvas"></div>';
  document.body.append(dialog);canvas=dialog.querySelector('.detail-artwork-canvas');title=dialog.querySelector('h2');
  dialog.querySelector('.detail-artwork-close').addEventListener('click',()=>dialog.close());
  let beganOutside=false;
  const outside=event=>{const bounds=dialog.getBoundingClientRect();return event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom;};
  dialog.addEventListener('pointerdown',event=>{beganOutside=event.target===dialog&&outside(event);});
  dialog.addEventListener('pointerup',event=>{if(beganOutside&&event.target===dialog&&outside(event))dialog.close();beganOutside=false;});
  dialog.addEventListener('close',()=>{if(dialog.open)return;canvas.replaceChildren();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
  return dialog;
}

export function mountDetailArtworkPreview(container,campaign,config) {
  const feed=container.querySelector('.ig-detail-image img');
  if(feed){
    const trigger=document.createElement('button');trigger.type='button';trigger.className='detail-artwork-trigger';trigger.setAttribute('aria-label','Enlarge Instagram feed preview');trigger.setAttribute('aria-haspopup','dialog');
    feed.before(trigger);trigger.append(feed);
    trigger.addEventListener('click',()=>{
      const current=feed.src,{images}=instagramPreviewContent(campaign,config),index=Math.max(0,images.indexOf(current));
      const modal=artworkDialog();returnFocus=trigger;title.textContent=campaign.title+' · Instagram feed';
      mountCampaignInstagramPreview(canvas,campaign,config,{index});modal.showModal();
    });
  }
  for(const image of container.querySelectorAll('.detail-images img')){
    const trigger=document.createElement('button');trigger.type='button';trigger.className='detail-artwork-trigger';trigger.setAttribute('aria-label','Enlarge Instagram story preview');trigger.setAttribute('aria-haspopup','dialog');
    image.before(trigger);trigger.append(image);
    trigger.addEventListener('click',()=>{
      const source=safePreviewImage(image.currentSrc||image.src);if(!source)return;
      const modal=artworkDialog();returnFocus=trigger;title.textContent=campaign.title+' · Instagram story';
      const story=document.createElement('div');story.className='detail-artwork-story';const enlarged=document.createElement('img');enlarged.src=source;enlarged.alt=image.alt;
      const unavailable=document.createElement('p');unavailable.className='ig-image-unavailable';unavailable.hidden=true;unavailable.textContent='Image preview unavailable. Check again after rendering finishes.';
      enlarged.addEventListener('error',()=>{enlarged.hidden=true;unavailable.hidden=false;});
      story.append(enlarged,unavailable);canvas.replaceChildren(story);modal.showModal();
    });
  }
}
