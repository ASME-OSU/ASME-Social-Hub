import {matchingFeedIssue} from './carousel.mjs';
// Conservative Instagram publishing-API feed range. Preserve the flyer; never crop it silently.
export function feedImageIssue(width,height){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return 'The feed image could not be measured. Choose a valid JPEG or PNG.';
 const ratio=width/height;
 return ratio<.8-1e-6||ratio>1.91+1e-6?'This flyer is outside the feed publishing range (4:5 portrait to 1.91:1 landscape). Upload a feed-compatible flyer, or turn Instagram feed off and use Story only.':'';
}
export async function measureImage(url){
 const image=new Image();let timer;
 try{await Promise.race([new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('The feed image could not load. Check its URL or upload it again.'));image.src=url;}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('The feed image could not be verified. Check its URL and try again.')),8000);})]);return {width:image.naturalWidth,height:image.naturalHeight};}
 finally{clearTimeout(timer);image.onload=image.onerror=null;}
}
export function createFeedImageGuard({form,getSources}){
 const note=document.querySelector('#feed-image-note');let revision=0;
 const sources=()=>form.elements.feedImage.value.trim()?[form.elements.feedImage.value.trim()]:getSources();
 async function inspect(){const dimensions=await Promise.all(sources().map(measureImage));for(const [index,size]of dimensions.entries()){const issue=feedImageIssue(size.width,size.height);if(issue)return `Image ${index+1}: ${issue}`;}return matchingFeedIssue(dimensions);}
 async function refresh(){const current=++revision;note.hidden=true;if(!sources().length||!form.elements.feedEnabled.checked)return;try{const issue=await inspect();if(current!==revision)return;note.textContent=issue;note.hidden=!issue;}catch(error){if(current===revision){note.textContent=error.message;note.hidden=false;}}}
 async function validate(){if(!sources().length||!form.elements.feedEnabled.checked)return;const issue=await inspect();if(issue){note.textContent=issue;note.hidden=false;throw Error(issue);}}
 form.addEventListener('input',e=>{if(['feedImage','feedEnabled'].includes(e.target.name))refresh();});
 form.addEventListener('change',e=>{if(['flyer','feedImage','feedEnabled'].includes(e.target.name))refresh();});
 document.querySelector('#editor').addEventListener('close',()=>{++revision;});
 return {refresh,validate};
}
export function jpegDimensions(input){
 const data=input instanceof Uint8Array?input:new Uint8Array(input);
 if(data[0]!==255||data[1]!==216)return null;
 let offset=2;
 while(offset+3<data.length){
  if(data[offset++]!==255)return null;
  while(data[offset]===255)offset++;
  const marker=data[offset++];if(marker===218||marker===217)return null;
  if(marker===1||(marker>=208&&marker<=215))continue;
  const length=(data[offset]<<8)|data[offset+1];if(length<2||offset+length>data.length)return null;
  if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=8)return {width:(data[offset+5]<<8)|data[offset+6],height:(data[offset+3]<<8)|data[offset+4]};
  offset+=length;
 }
 return null;
}
