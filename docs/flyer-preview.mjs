import {createInstagramPost} from './instagram-preview.mjs';
import {captionFor} from './caption.mjs';
import {feedImageIssue,measureImage} from './image-policy.mjs';
import {flyerHtml,fitFlyerDocument} from './flyer-render.mjs';
import {fromLocal} from './time.mjs';

const styles=new Set(['blueprint','editorial','refined-blueprint','editorial-poster','assembly-card']);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const imageURL=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}};

export function createFlyerPreview({form,getConfig,getExisting,getUpload,getStoryDesign,getFeedUpload=getUpload,getFeedInfo=()=>({count:1,index:0}),refreshGroupMe=()=>null}) {
  const details=document.querySelector('#artwork-preview'),frame=document.querySelector('#artwork-preview-frame'),inlineStage=frame.parentElement,status=document.querySelector('#artwork-preview-status'),caption=document.querySelector('#artwork-preview-caption');
  const expanded=document.querySelector('#preview-dialog'),canvas=document.querySelector('#preview-dialog-canvas'),expandedStage=document.querySelector('.expanded-preview-stage'),zoom=document.querySelector('#preview-zoom');
  const inlineCanvas=document.querySelector('.inline-preview-canvas');
  const selectImage=delta=>{const info=getFeedInfo();document.querySelectorAll('#flyer-image-list .flyer-image-pick')[info.index+delta]?.click();};
  const inlinePost=createInstagramPost({media:inlineStage,onPrevious:()=>selectImage(-1),onNext:()=>selectImage(1)}),expandedPost=createInstagramPost({media:expandedStage,onPrevious:()=>selectImage(-1),onNext:()=>selectImage(1)});
  inlineCanvas.replaceChildren(inlinePost.root);canvas.replaceChildren(expandedPost.root);
  let stage=inlineStage,opener=null;
  const logoCache=new Map();
  const templates=new Map();let format='feed',previewHeight=1350,timer,revision=0;
  function groupMePanel(){return document.querySelector('#groupme-preview-panel');}
  function syncPreviewSurface(){
    details.dataset.format=format;expanded.dataset.format=format;
    const groupme=format==='groupme';
    inlinePost.root.hidden=groupme;expandedPost.root.hidden=groupme;
    inlineCanvas.classList.toggle('is-groupme-preview',groupme);canvas.classList.toggle('is-groupme-preview',groupme);
    document.querySelector('.preview-zoom-label').hidden=groupme;
    canvas.setAttribute('aria-label',groupme?'GroupMe announcement preview; scroll to read':'Enlarged artwork; scroll to inspect at 100 percent');
    const panel=groupMePanel();if(panel){const destination=expanded.open?canvas:inlineCanvas;if(panel.parentElement!==destination)destination.append(panel);panel.hidden=!groupme;}
  }
  function resize(){
    syncPreviewSurface();if(format==='groupme')return;
    const height=previewHeight,story=format==='story',post=expanded.open?expandedPost:inlinePost,slot=expanded.open?canvas:inlineCanvas;
    inlinePost.setStory(story);expandedPost.setStory(story);frame.style.height=`${height}px`;
    const sideBySide=expanded.open&&!story&&(matchMedia('(min-width:700px)').matches||matchMedia('(min-width:600px) and (max-height:500px)').matches);
    const side=sideBySide?302:0,padding=expanded.open?16:0;
    post.root.style.width=`${Math.max(80,Math.min(slot.clientWidth-padding,expanded.open?Infinity:430))}px`;
    const chrome=sideBySide||story?0:post.chromeHeight()+2;
    const availableWidth=Math.min(slot.clientWidth-padding-side-(story?0:2),expanded.open?Infinity:428);
    const scale=expanded.open&&zoom.value==='1'?1:Math.max(.05,Math.min(1,availableWidth/1080,(slot.clientHeight-padding-chrome)/height));
    stage.style.width=`${1080*scale}px`;stage.style.height=`${height*scale}px`;stage.style.maxWidth='';stage.style.aspectRatio=`1080 / ${height}`;frame.style.transform=`scale(${scale})`;
    post.root.style.width=`${1080*scale+side+(story?0:2)}px`;post.root.style.height=sideBySide?`${height*scale+2}px`:'auto';
  }
  new ResizeObserver(resize).observe(document.querySelector('.inline-preview-canvas'));new ResizeObserver(resize).observe(canvas);new ResizeObserver(resize).observe(document.querySelector('.editor-preview-pane'));
  function openPreview(trigger=document.activeElement){
    clearTimeout(timer);opener=trigger;details.open=true;
    if(!expanded.open){expanded.showModal();stage=expandedStage;stage.hidden=false;stage.append(frame);}
    document.querySelector('#preview-dialog-title').textContent=format==='groupme'?'GroupMe preview':format==='story'?'Story preview':'Feed preview';resize();update();
  }
  function closePreview(){if(expanded.open)expanded.close();}
  expanded.addEventListener('close',()=>{inlineStage.append(frame);stage=inlineStage;const panel=groupMePanel();if(panel)inlineCanvas.append(panel);resize();if(document.querySelector('#editor').open){opener?.focus();update();}});
  document.querySelector('#enlarge-preview').addEventListener('click',event=>openPreview(event.currentTarget));
  document.querySelector('#mobile-preview').addEventListener('click',event=>openPreview(event.currentTarget));
  document.querySelector('#close-preview').addEventListener('click',closePreview);
  zoom.addEventListener('change',resize);
  async function template(name){if(!templates.has(name))templates.set(name,fetch(`./templates/${name}.html`).then(response=>{if(!response.ok)throw Error('Preview could not load. Try again when your connection is available.');return response.text();}).catch(error=>{templates.delete(name);throw error;}));return templates.get(name);}
  async function update(){
    const current=++revision,config=getConfig();if(!config||!document.querySelector('#editor').open||!details.open)return;
    if(format==='groupme'){
      refreshGroupMe();syncPreviewSurface();
      status.textContent='Review the exact bot message. Previewing does not send an announcement.';
      caption.textContent='GroupMe announcement preview';
      const summary=groupMePanel()?.querySelector('.gm-message-text')?.textContent||'Choose the event details to preview the GroupMe announcement.';
      document.querySelector('#artwork-preview-summary').textContent=summary;document.querySelector('#preview-dialog-summary').textContent=summary;
      document.querySelector('#preview-dialog-status').textContent=status.textContent;document.querySelector('#preview-dialog-title').textContent='GroupMe preview';
      resize();return;
    }
    syncPreviewSurface();
    const f=form.elements,channel=format,label=channel==='feed'?'Feed':'Story',height=channel==='story'?1920:1350;
    previewHeight=height;resize();stage.hidden=false;frame.style.visibility='hidden';status.textContent='Preparing preview…';
    try{
      const name=f.template.value;if(!styles.has(name))throw Error('Choose a flyer style to preview.');
      let source=await template(name);if(current!==revision)return;
      const missingDate=!f.start.value,start=missingDate?'2026-01-01T17:00:00Z':fromLocal(f.start.value,config.timezone);
      if(missingDate)source=source.replace(/{{(date|day|month|shortDate|time)}}/g,(_,key)=>({date:'Choose a date',day:'—',month:'DATE',shortDate:'Choose a date',time:'Choose a time'}[key]));
      const advertising={};for(const key of ['foodDetails','benefit','speaker','audience','cost','rsvpUrl','preparation','accessibilityContact'])if(f[key].value.trim())advertising[key]=f[key].value.trim();
      if(f.rsvpDeadline.value)advertising.rsvpDeadline=fromLocal(f.rsvpDeadline.value,config.timezone);
      const campaign={title:f.title.value.trim()||'Your event title',description:f.description.value.trim(),start,type:f.type.value,location:f.location.value.trim()||'Building and room',food:f.food.checked,advertising,storyDesign:getStoryDesign(),flyerUrl:imageURL(getExisting()?.flyerUrl)};
      let postCaption='',captionError='';
      try{postCaption=missingDate?'Choose the event date to preview the publishing caption.':captionFor(campaign,config);}catch(error){captionError=error.message;}
      const feedInfo=getFeedInfo(),count=channel==='feed'&&!f.feedImage.value.trim()?Math.max(1,feedInfo.count):1,index=count>1?feedInfo.index:0;
      inlinePost.update({config,caption:postCaption,captionError,count,index});expandedPost.update({config,caption:postCaption,captionError,count,index});resize();
      const upload=channel==='feed'?getFeedUpload():getUpload();
      const direct=imageURL(f[channel+'Image'].value),logo=config.brand?.logoFlyer||config.brand?.logoMark||config.brand?.logoReverse||config.brand?.logo;
      if(f[channel+'Image'].value.trim()&&!direct)throw Error('Use an HTTPS image URL without embedded credentials to preview a custom image.');
      const fontCss=`@font-face{font-family:Inter;font-weight:100 900;src:url("${new URL('./assets/fonts/inter-latin.woff2',document.baseURI)}")}@font-face{font-family:'DM Serif Display';font-weight:400;src:url("${new URL('./assets/fonts/dm-serif-display-latin.woff2',document.baseURI)}")}`;
      let logoURL=logo?new URL(logo,document.baseURI).href:'';
      if(logoURL){if(!logoCache.has(logoURL))logoCache.set(logoURL,measureImage(logoURL).then(()=>true,()=>false));if(!await logoCache.get(logoURL))logoURL='';if(current!==revision)return;}
      const assets={fontCss,flyer:upload,previewMissingDate:missingDate,logo:logoURL,logoResolved:true};
      const html=direct?`<!doctype html><html><head><style>*{margin:0}html,body{width:1080px;background:#fff}img{display:block;width:1080px;height:auto}</style></head><body><img src="${escape(direct)}" alt="Custom ${label} image"></body></html>`:flyerHtml(source,campaign,config,channel,assets);
      const csp=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' https: data: blob:;">`;
      frame.onload=async()=>{
        const doc=frame.contentDocument;if(current!==revision||doc?.querySelector('meta[name=preview-revision]')?.content!==String(current))return;
        let timeout;
        try{
          await Promise.race([direct?Promise.all([...doc.images].map(image=>image.decode().catch(()=>{throw Error('Custom image could not load. Check the image URL.');}))):fitFlyerDocument(doc),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Preview is taking too long. Check image URLs and try again.')),8000);})]);
          if(current!==revision)return;
          const uploaded=doc.querySelector('img.uploaded-feed');
          const original=uploaded||(direct?doc.querySelector('img'):null);
          if(original){previewHeight=Math.round(1080*original.naturalHeight/original.naturalWidth);resize();}
          frame.style.visibility='visible';status.textContent=direct?'Custom image override. Showing the original image proportions; it publishes directly from its URL.':uploaded?'Your uploaded flyer is used directly for the feed, without added text, borders, or a background.':(!f.title.value.trim()||missingDate||!f.location.value.trim()?'Placeholder text is shown for empty fields.':'Preview updated with your event details.');
          const info=getFeedInfo();
          caption.textContent=`${label}${channel==='feed'&&!direct&&info.count>1?' image '+(info.index+1)+' of '+info.count:''} preview · 1080 × ${previewHeight}${f[channel+'Enabled'].checked?'':' · channel is off'}`;
          const issue=channel==='feed'&&original?feedImageIssue(original.naturalWidth,original.naturalHeight):'';
          if(issue)status.textContent=issue;
          const artwork=doc.querySelector('.artwork');
          if(channel==='story'&&artwork&&!doc.querySelector('.flyer-showcase')&&artwork.clientHeight<600)status.textContent+=' The flyer was reduced to fit the event details; enlarge the preview to review it.';
          const summary=[campaign.title,!missingDate?new Intl.DateTimeFormat('en-US',{timeZone:config.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(start)):'Date not chosen',campaign.location,campaign.food?'Food provided':'',campaign.description].filter(Boolean).join('. ');
          document.querySelector('#artwork-preview-summary').textContent=summary;document.querySelector('#preview-dialog-summary').textContent=summary;
          document.querySelector('#preview-dialog-status').textContent=status.textContent;
          document.querySelector('#preview-dialog-title').textContent=label+' preview';resize();

        }catch(error){if(current===revision){stage.hidden=true;status.textContent=error.message;document.querySelector('#preview-dialog-status').textContent=error.message;}}finally{clearTimeout(timeout);}
      };
      frame.srcdoc=html.replace('<head>',`<head>${csp}<meta name="preview-revision" content="${current}">`);
    }catch(error){if(current===revision){stage.hidden=true;status.textContent=error.message;}}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(update,180);}
  const artworkFields=new Set(['title','description','start','type','location','food','foodDetails','benefit','speaker','audience','cost','preparation','accessibilityContact','rsvpUrl','rsvpDeadline','template','flyer','feedImage','storyImage','feedEnabled','storyEnabled','storyBackground','storyFlyerColors']);
  const artworkChange=event=>{if(artworkFields.has(event.target.name))schedule();};
  form.addEventListener('input',artworkChange);form.addEventListener('change',artworkChange);
  details.addEventListener('toggle',()=>{if(!details.open&&matchMedia('(min-width:960px)').matches){details.open=true;return;}if(details.open)update();});
  matchMedia('(min-width:960px)').addEventListener('change',event=>{if(event.matches)details.open=true;});
  function setFormat(value){if(!['feed','story','groupme'].includes(value))return;clearTimeout(timer);format=value;document.querySelectorAll('[data-preview-format]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.previewFormat===format)));update();}
  document.querySelectorAll('[data-preview-format]').forEach(button=>button.addEventListener('click',()=>setFormat(button.dataset.previewFormat)));
  document.querySelector('#editor').addEventListener('close',()=>{++revision;clearTimeout(timer);closePreview();frame.onload=null;frame.removeAttribute('srcdoc');status.textContent='';});
  return {update,schedule,getFormat:()=>format,showGroupMe:()=>setFormat('groupme'),showFeed:()=>setFormat('feed'),showStory:()=>{setFormat('story');if(matchMedia('(max-width:959px)').matches&&document.querySelector('#editor').open)openPreview();}};
}
