import {MAX_FEED_IMAGES,flyerSources} from './carousel.mjs';
export function createFlyerUploads({form,onChange}){
 const input=form.elements.flyer,selection=document.querySelector('#flyer-selection'),preview=document.querySelector('#flyer-preview'),feedback=document.querySelector('#flyer-feedback'),list=document.querySelector('#flyer-image-list');let items=[],baseline=[],selected=0,serial=0,dragged='',selectionError='',pending=Promise.resolve(),generation=0;
 const release=()=>{for(const item of items)if(item.file&&item.preview)URL.revokeObjectURL(item.preview);};
 const source=item=>item?.preview||item?.url||'';
 function render(message=''){
  selection.hidden=!items.length&&!message;preview.hidden=!items.length;if(items.length)preview.src=source(items[0]);else preview.removeAttribute('src');
  feedback.textContent=message||`${items.length} image${items.length===1?'':'s'} · first image is the feed cover and Story. Drag to reorder, or use the arrow buttons.`;
  list.replaceChildren();
  items.forEach((item,index)=>{
   const li=document.createElement('li');li.draggable=true;li.dataset.imageId=item.id;
   const pick=document.createElement('button');pick.type='button';pick.className='flyer-image-pick';pick.setAttribute('aria-pressed',String(index===selected));pick.setAttribute('aria-label',`Preview image ${index+1}${index===0?', cover and Story':''}`);
   const image=document.createElement('img');image.src=source(item);image.alt='';const name=document.createElement('span');name.textContent=`${index+1}${index===0?' · Cover + Story':''} — ${item.file?.name||'Saved image'}`;pick.append(image,name);pick.onclick=()=>{selected=index;render();onChange({selected:true});};li.append(pick);
   for(const [label,delta]of [['Move earlier',-1],['Move later',1]]){const button=document.createElement('button');button.type='button';button.textContent=delta<0?'↑':'↓';button.setAttribute('aria-label',`${label}: image ${index+1}`);button.disabled=index+delta<0||index+delta>=items.length;button.onclick=()=>move(index,index+delta);li.append(button);}
   const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label',`Remove image ${index+1}`);remove.onclick=()=>{selectionError='';const [gone]=items.splice(index,1);if(gone.file)URL.revokeObjectURL(gone.preview);selected=Math.min(selected,Math.max(0,items.length-1));render();onChange({});};li.append(remove);
   li.ondragstart=event=>{dragged=item.id;event.dataTransfer.setData('text/plain',item.id);event.dataTransfer.effectAllowed='move';};li.ondragover=event=>event.preventDefault();li.ondrop=event=>{event.preventDefault();const from=items.findIndex(x=>x.id===dragged);if(from>=0)move(from,index);};list.append(li);
  });
 }
 function move(from,to){if(to<0||to>=items.length||from===to)return;const current=items[selected]?.id;items.splice(to,0,items.splice(from,1)[0]);selected=Math.max(0,items.findIndex(x=>x.id===current));render();onChange({});list.children[to]?.querySelector('button')?.focus();}
 function reset(c){++generation;selectionError='';release();baseline=flyerSources(c||{});items=baseline.map(url=>({id:String(++serial),url}));selected=0;input.value='';render();}
 input.addEventListener('change',()=>{
  const files=[...input.files],current=generation;input.value='';
  pending=pending.then(async()=>{
   if(current!==generation)return;selectionError='';
   for(const file of files){
    if(!['image/jpeg','image/png'].includes(file.type)||file.size>=8*1024*1024){selectionError='Choose JPEG or PNG files smaller than 8 MB.';continue;}
    const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer()),png=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    if(current!==generation)return;
    if((file.type==='image/png'&&!png)||(file.type==='image/jpeg'&&!jpeg)){selectionError='An image does not match its JPEG or PNG format. Choose a valid image.';continue;}
    if(items.length>=MAX_FEED_IMAGES){selectionError='You can add up to 10 images.';break;}items.push({id:String(++serial),file,preview:URL.createObjectURL(file)});
   }
   selected=Math.min(selected,Math.max(0,items.length-1));render(selectionError);onChange({});
  });
 });
 document.querySelector('#clear-flyer').addEventListener('click',()=>{reset({flyerUrls:baseline});onChange({});input.focus();});
 document.querySelector('#editor').addEventListener('close',release);
 async function save(upload){
  for(const item of items)if(item.file&&!item.url){const bytes=new Uint8Array(await item.file.arrayBuffer()),png=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;if((item.file.type==='image/png'&&!png)||(item.file.type==='image/jpeg'&&!jpeg))throw Error('An image does not match its JPEG or PNG format. Remove it and choose a valid image.');}
  const urls=[];for(const [index,item]of items.entries()){if(!item.url)item.url=await upload(item.file,index);urls.push(item.url);}return urls;
 }
 return {reset,save,validate:async()=>{await pending;if(selectionError)throw Error(selectionError);},get first(){return source(items[0]);},get feed(){return source(items[selected]||items[0]);},get count(){return items.length;},get selected(){return selected;},get sources(){return items.map(source);},get hasNew(){return items.some(x=>x.file&&!x.url);}};
}
