import {flyerHtml,fitFlyerDocument} from './flyer-render.mjs';
import {fromLocal} from './time.mjs';

const styles=new Set(['blueprint','editorial','refined-blueprint','editorial-poster','assembly-card']);
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const imageURL=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch{return '';}};

export function createFlyerPreview({form,getConfig,getExisting,getUpload,getStoryDesign}) {
  const details=document.querySelector('#artwork-preview'),frame=document.querySelector('#artwork-preview-frame'),stage=frame.parentElement,status=document.querySelector('#artwork-preview-status'),caption=document.querySelector('#artwork-preview-caption');
  const templates=new Map();let format='feed',feedHeight=1350,timer,revision=0;
  function resize(){const height=format==='story'?1920:feedHeight;stage.style.aspectRatio=`1080 / ${height}`;frame.style.height=`${height}px`;frame.style.transform=`scale(${stage.clientWidth/1080})`;}
  new ResizeObserver(resize).observe(stage);
  async function template(name){if(!templates.has(name))templates.set(name,fetch(`./templates/${name}.html`).then(response=>{if(!response.ok)throw Error('Preview could not load. Try again when your connection is available.');return response.text();}).catch(error=>{templates.delete(name);throw error;}));return templates.get(name);}
  async function update(){
    const current=++revision,config=getConfig();if(!config||!document.querySelector('#editor').open||!details.open)return;
    const f=form.elements,channel=format,label=channel==='feed'?'Feed':'Story',height=channel==='story'?1920:1350;
    feedHeight=1350;resize();stage.hidden=false;frame.style.visibility='hidden';status.textContent='Updating preview…';
    try{
      const name=f.template.value;if(!styles.has(name))throw Error('Choose a flyer style to preview.');
      let source=await template(name);if(current!==revision)return;
      const missingDate=!f.start.value,start=missingDate?'2026-01-01T17:00:00Z':fromLocal(f.start.value,config.timezone);
      if(missingDate)source=source.replace(/{{(date|day|month|shortDate|time)}}/g,(_,key)=>({date:'Choose a date',day:'—',month:'DATE',shortDate:'Choose a date',time:'Choose a time'}[key]));
      const advertising={};for(const key of ['foodDetails','benefit','speaker','audience','cost','rsvpUrl'])if(f[key].value.trim())advertising[key]=f[key].value.trim();
      if(f.rsvpDeadline.value)advertising.rsvpDeadline=fromLocal(f.rsvpDeadline.value,config.timezone);
      const campaign={title:f.title.value.trim()||'Your event title',description:f.description.value.trim(),start,type:f.type.value,location:f.location.value.trim()||'Building and room',food:f.food.checked,advertising,storyDesign:getStoryDesign(),flyerUrl:imageURL(getExisting()?.flyerUrl)};
      const upload=getUpload();
      const direct=imageURL(f[channel+'Image'].value),logo=config.brand?.logoFlyer||config.brand?.logoMark||config.brand?.logo;
      if(f[channel+'Image'].value.trim()&&!direct)throw Error('Use an HTTPS image URL without embedded credentials to preview a custom image.');
      const fontCss=`@font-face{font-family:Inter;font-weight:100 900;src:url("${new URL('./assets/fonts/inter-latin.woff2',document.baseURI)}")}@font-face{font-family:'DM Serif Display';font-weight:400;src:url("${new URL('./assets/fonts/dm-serif-display-latin.woff2',document.baseURI)}")}`;
      const assets={fontCss,flyer:upload,previewMissingDate:missingDate,logo:logo?new URL(logo,document.baseURI).href:''};
      const html=direct?`<!doctype html><html><head><style>*{margin:0}html,body{width:1080px;height:${height}px;background:#102840}img{width:100%;height:100%;object-fit:contain}</style></head><body><img src="${escape(direct)}" alt="Custom ${label} image"></body></html>`:flyerHtml(source,campaign,config,channel,assets);
      const csp=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' https: data: blob:;">`;
      frame.onload=async()=>{
        const doc=frame.contentDocument;if(current!==revision||doc?.querySelector('meta[name=preview-revision]')?.content!==String(current))return;
        let timeout;
        try{
          await Promise.race([direct?Promise.all([...doc.images].map(image=>image.decode().catch(()=>{throw Error('Custom image could not load. Check the image URL.');}))):fitFlyerDocument(doc),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Preview is taking too long. Check image URLs and try again.')),8000);})]);
          if(current!==revision)return;
          const uploaded=doc.querySelector('img.uploaded-feed');
          if(uploaded){feedHeight=Math.round(1080*uploaded.naturalHeight/uploaded.naturalWidth);resize();}
          frame.style.visibility='visible';status.textContent=direct?'Custom image override. The selected style applies to generated artwork only.':uploaded?'Your uploaded flyer is used directly for the feed, without added text, borders, or a background.':(!f.title.value.trim()||missingDate||!f.location.value.trim()?'Placeholder text is shown for empty fields.':'Preview updated with your event details.');
          caption.textContent=`${label} preview · 1080 × ${uploaded?feedHeight:height}${f[channel+'Enabled'].checked?'':' · channel is off'}`;
        }catch(error){if(current===revision){stage.hidden=true;status.textContent=error.message;}}finally{clearTimeout(timeout);}
      };
      frame.srcdoc=html.replace('<head>',`<head>${csp}<meta name="preview-revision" content="${current}">`);
    }catch(error){if(current===revision){stage.hidden=true;status.textContent=error.message;}}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(update,180);}
  form.addEventListener('input',schedule);form.addEventListener('change',schedule);
  details.addEventListener('toggle',()=>{if(details.open)update();});
  function setFormat(value){format=value;document.querySelectorAll('[data-preview-format]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.previewFormat===format)));update();}
  document.querySelectorAll('[data-preview-format]').forEach(button=>button.addEventListener('click',()=>setFormat(button.dataset.previewFormat)));
  document.querySelector('#editor').addEventListener('close',()=>{++revision;clearTimeout(timer);frame.onload=null;frame.removeAttribute('srcdoc');status.textContent='';});
  return {update,schedule,showStory:()=>setFormat('story')};
}
