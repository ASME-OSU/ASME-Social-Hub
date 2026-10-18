import {STORY_BACKGROUNDS,paletteFromPixels,resolveStoryPalette,validateStoryDesign} from './story-design.mjs';

async function sampleImage(url,fallback){
 const image=new Image();if(!url.startsWith('blob:'))image.crossOrigin='anonymous';
 let timer;
 try{
  await Promise.race([new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('This flyer does not allow color sampling.'));image.src=url;}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Color sampling timed out.')),6000);})]);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,64,64);return paletteFromPixels(ctx.getImageData(0,0,64,64).data,fallback);
 }finally{clearTimeout(timer);image.onload=image.onerror=null;}
}
export function createStoryControls({form,getConfig,getExisting,getUpload,onChange}){
 const panel=document.querySelector('#story-design-controls'),note=document.querySelector('#story-palette-note'),swatches=document.querySelector('#story-palette'),choices=document.querySelector('#story-background-options'),refreshButton=document.querySelector('#story-resample');
 const samples=new Map();
 let palette=null,sampleKey='',pendingKey='',generation=0,sampleNote='';
 const source=()=>getUpload()||getExisting()?.flyerUrl||'';
 const fallback=()=>resolveStoryPalette(undefined,getConfig());
 function paint(){const colors=form.elements.storyFlyerColors.checked&&palette?palette:fallback();colors.forEach((value,i)=>panel.style.setProperty('--story-color-'+(i+1),value));swatches.replaceChildren(...colors.map(color=>{const chip=document.createElement('span');chip.style.background=color;chip.title=color;chip.setAttribute('aria-hidden','true');return chip;}));swatches.setAttribute('aria-label','Story palette: '+colors.join(', '));}
 function refresh(){
  if(!getConfig())return;
  const override=Boolean(form.elements.storyImage.value.trim());choices.disabled=override;form.elements.storyFlyerColors.disabled=override;
  refreshButton.disabled=override||!source()||!form.elements.storyFlyerColors.checked||!!pendingKey;
  if(override){note.textContent='A custom Story image overrides these backgrounds. Clear its URL to use a generated Story.';paint();return;}
  if(!form.elements.storyFlyerColors.checked){note.textContent='Using chapter colors.';paint();return;}
  const url=source();
  if(!url){++generation;palette=null;sampleKey=pendingKey='';note.textContent='Upload a flyer to sample its colors. Chapter colors are used until then.';paint();return;}
  if(pendingKey&&pendingKey!==url){++generation;pendingKey='';}
  refreshButton.disabled=!!pendingKey;
  if(url!==sampleKey&&samples.has(url)){const saved=samples.get(url);palette=saved.palette;sampleNote=saved.note;sampleKey=url;}
  if(url===sampleKey){note.textContent=sampleNote;paint();return;}
  if(url===pendingKey)return;
  const current=++generation;pendingKey=url;palette=null;note.textContent='Sampling colors from your flyer…';refreshButton.disabled=true;paint();onChange();
  sampleImage(url,fallback()).then(colors=>{
   if(current!==generation)return;palette=colors;sampleKey=url;pendingKey='';sampleNote=JSON.stringify(colors)===JSON.stringify(fallback())?'This flyer is mostly neutral; using chapter colors.':'Colors sampled from your flyer. These colors are saved with the campaign.';samples.set(url,{palette:[...colors],note:sampleNote});refresh();onChange();
  }).catch(()=>{if(current!==generation)return;palette=null;sampleKey=url;pendingKey='';sampleNote='Colors could not be sampled from this image. Using chapter colors; uploading a PNG or JPEG directly usually resolves this.';refresh();onChange();});
 }
 function reset(c){++generation;palette=c?.storyDesign?.palette?[...c.storyDesign.palette]:null;sampleKey=palette?(c?.flyerUrl||''):'';pendingKey='';samples.clear();sampleNote=palette?'Using the saved flyer palette. Resample to update it.':'';if(palette&&sampleKey)samples.set(sampleKey,{palette:[...palette],note:sampleNote});form.elements.storyBackground.value=Object.hasOwn(STORY_BACKGROUNDS,c?.storyDesign?.background)?c.storyDesign.background:'template';form.elements.storyFlyerColors.checked=c?.storyDesign?.paletteSource!=='chapter';paint();refresh();}
 function getDesign({forSave=false}={}){
  if(forSave&&pendingKey&&form.elements.storyFlyerColors.checked&&form.elements.storyBackground.value!=='template'&&!form.elements.storyImage.value.trim())throw Error('Wait for flyer colors to finish sampling, then review the Story preview and save.');
  const useFlyer=form.elements.storyFlyerColors.checked;const design={background:form.elements.storyBackground.value||'template',paletteSource:useFlyer?'flyer':'chapter',...(useFlyer&&palette?{palette:[...palette]}:{})};validateStoryDesign(design);return design;
 }
 form.addEventListener('change',e=>{if(['flyer','storyFlyerColors','storyImage','storyBackground'].includes(e.target.name)){refresh();onChange(e.target.name==='storyBackground');}});
 form.elements.storyImage.addEventListener('input',()=>{refresh();onChange();});
 refreshButton.addEventListener('click',()=>{++generation;samples.delete(source());sampleKey=pendingKey='';refresh();});
 document.querySelector('#editor').addEventListener('close',()=>{++generation;pendingKey='';});
 return {reset,refresh,getDesign};
}
