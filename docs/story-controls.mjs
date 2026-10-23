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
 const panel=document.querySelector('#story-design-controls'),note=document.querySelector('#story-palette-note'),swatches=document.querySelector('#story-palette'),choices=document.querySelector('#story-background-options'),refreshButton=document.querySelector('#story-reset-colors');
 const colorSettings=document.querySelector('#story-color-settings'),customPalette=document.querySelector('#story-custom-palette'),templateSettings=document.querySelector('#story-template-settings'),templateLabel=document.querySelector('#template-label'),templateHelp=document.querySelector('#template-help'),overrideNote=document.querySelector('#story-override-note');
 const samples=new Map();
 let custom=false,palette=null,sampleKey='',pendingKey='',generation=0,sampleNote='';
 const source=()=>getUpload()||getExisting()?.flyerUrl||'';
 const fallback=()=>resolveStoryPalette(undefined,getConfig());
 function paint(){
  const colors=form.elements.storyFlyerColors.checked&&palette?palette:fallback(),disabled=!!form.elements.storyImage.value.trim()||!form.elements.storyFlyerColors.checked||form.elements.storyBackground.value==='template';
  const override=!!form.elements.storyImage.value.trim(),useTemplate=form.elements.storyBackground.value==='template';
  colorSettings.hidden=override||useTemplate;customPalette.hidden=!form.elements.storyFlyerColors.checked;
  templateSettings.hidden=!(useTemplate&&!override)&&!!(source()||form.elements.feedImage.value.trim());
  templateLabel.textContent=useTemplate&&!override?'Chapter template style':'Generated feed style';
  templateHelp.textContent=useTemplate&&!override?'Used for this Story. Also used for generated feed posts.':override?'Used to generate the feed post when no flyer is uploaded. Your custom Story image is used as supplied.':'No flyer is uploaded, so this style is used to generate the feed post. Story colors above apply only to the Story.';
  overrideNote.hidden=!override;
  colors.forEach((value,i)=>panel.style.setProperty('--story-color-'+(i+1),value));swatches.dataset.palette=colors.join(', ');
  if(!swatches.children.length)for(const [i,name]of ['Primary','Accent','Tint'].entries()){
   const label=document.createElement('label'),input=document.createElement('input');label.append(document.createTextNode(name));input.type='color';input.name='storyColor'+i;input.setAttribute('aria-label',name+' Story background color');label.append(input);swatches.append(label);
   input.addEventListener('input',()=>{++generation;pendingKey='';palette=[...(form.elements.storyFlyerColors.checked&&palette?palette:fallback())];palette[i]=input.value.toLowerCase();custom=true;sampleKey=source();sampleNote='Custom colors. Your changes are saved with this campaign.';if(sampleKey)samples.set(sampleKey,{palette:[...palette],note:sampleNote,custom:true});note.textContent=sampleNote;paint();onChange();});
  }
  [...swatches.querySelectorAll('input')].forEach((input,i)=>{input.value=colors[i];input.disabled=disabled;});
  refreshButton.disabled=disabled||!source()||!!pendingKey||(!custom&&!!palette);
  swatches.setAttribute('aria-label',custom?'Custom Story background colors':'Story background colors');
 }
 function refresh(){
  if(!getConfig())return;
  const override=Boolean(form.elements.storyImage.value.trim());choices.disabled=override;form.elements.storyFlyerColors.disabled=override;
  refreshButton.disabled=override||!source()||!form.elements.storyFlyerColors.checked||form.elements.storyBackground.value==='template'||!!pendingKey;
  if(override){note.textContent='A custom Story image overrides these backgrounds. Clear its URL to use a generated Story.';paint();return;}
  if(form.elements.storyBackground.value==='template'){note.textContent='';paint();return;}
  if(!form.elements.storyFlyerColors.checked){note.textContent='Using chapter colors.';paint();return;}
  const url=source();
  if(!url&&custom){note.textContent=sampleNote;paint();return;}
  if(!url){++generation;palette=null;sampleKey=pendingKey='';note.textContent='Upload a flyer to sample its colors. Chapter colors are used until then.';paint();return;}
  if(pendingKey&&pendingKey!==url){++generation;pendingKey='';}
  refreshButton.disabled=!!pendingKey||form.elements.storyBackground.value==='template';
  if(url!==sampleKey&&samples.has(url)){const saved=samples.get(url);palette=saved.palette;custom=!!saved.custom;sampleNote=saved.note;sampleKey=url;}
  if(url===sampleKey){note.textContent=sampleNote;paint();return;}
  if(url===pendingKey)return;
  const current=++generation;pendingKey=url;palette=null;custom=false;note.textContent='Sampling colors from your flyer…';refreshButton.disabled=true;paint();onChange();
  sampleImage(url,fallback()).then(colors=>{
   if(current!==generation)return;palette=colors;sampleKey=url;pendingKey='';sampleNote=JSON.stringify(colors)===JSON.stringify(fallback())?'This flyer is mostly neutral; using chapter colors.':'Colors sampled from your flyer. These colors are saved with the campaign.';samples.set(url,{palette:[...colors],note:sampleNote});refresh();onChange();
  }).catch(()=>{if(current!==generation)return;palette=null;sampleKey=url;pendingKey='';sampleNote='Colors could not be sampled from this image. Using chapter colors; uploading a PNG or JPEG directly usually resolves this.';refresh();onChange();});
 }
 function reset(c){++generation;custom=c?.storyDesign?.paletteSource==='custom';palette=c?.storyDesign?.palette?[...c.storyDesign.palette]:null;sampleKey=palette?(c?.flyerUrl||''):'';pendingKey='';samples.clear();sampleNote=palette?(custom?'Custom colors. Your changes are saved with this campaign.':'Using the saved flyer palette. Adjust the swatches to customize it.'):'';if(palette&&sampleKey)samples.set(sampleKey,{palette:[...palette],note:sampleNote,custom});form.elements.storyBackground.value=Object.hasOwn(STORY_BACKGROUNDS,c?.storyDesign?.background)?c.storyDesign.background:'template';form.elements.storyFlyerColors.checked=c?.storyDesign?.paletteSource!=='chapter';paint();refresh();}
 function getDesign({forSave=false}={}){
  if(forSave&&pendingKey&&form.elements.storyFlyerColors.checked&&form.elements.storyBackground.value!=='template'&&!form.elements.storyImage.value.trim())throw Error('Wait for flyer colors to finish sampling, then review the Story preview and save.');
  const useFlyer=form.elements.storyFlyerColors.checked;const design={background:form.elements.storyBackground.value||'template',paletteSource:useFlyer?(custom?'custom':'flyer'):'chapter',...(useFlyer&&palette?{palette:[...palette]}:{})};validateStoryDesign(design);return design;
 }
 form.addEventListener('change',e=>{if(['flyer','feedImage','storyFlyerColors','storyImage','storyBackground'].includes(e.target.name)){refresh();onChange(e.target.name==='storyBackground');}});
 for(const name of ['storyImage','feedImage'])form.elements[name].addEventListener('input',()=>{refresh();onChange();});
 refreshButton.addEventListener('click',()=>{++generation;custom=false;samples.delete(source());sampleKey=pendingKey='';refresh();});
 document.querySelector('#editor').addEventListener('close',()=>{++generation;pendingKey='';});
 return {reset,refresh,getDesign};
}
