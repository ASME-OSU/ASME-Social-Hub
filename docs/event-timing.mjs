import {fromLocal} from './time.mjs';

export function eventTiming(startValue,endValue,zone) {
 const start=fromLocal(startValue,zone),end=fromLocal(endValue,zone);
 if(Date.parse(end)<=Date.parse(start))throw Error('End time must be after the start time. Choose a later end date or time.');
 return {start,end};
}

// Revalidate both fields when either changes; never silently change an officer's dates.
export function mountEventTiming(form,{getZone,warning}) {
 const {start,end}=form.elements;
 for(const field of [start,end])field.setAttribute('aria-describedby',[field.getAttribute('aria-describedby'),warning.id].filter(Boolean).join(' '));
 function refresh(){
  for(const field of [start,end]){field.setCustomValidity('');field.removeAttribute('aria-invalid');}
  end.removeAttribute('min');warning.hidden=true;warning.textContent='';
  let startValid=false;
  for(const field of [start,end]){
   if(!field.value)continue;
   try{fromLocal(field.value,getZone());if(field===start)startValid=true;}
   catch(error){field.setCustomValidity(error.message);}
  }
  if(startValid){
   // datetime-local has minute precision; use wall-clock arithmetic for its native limit.
   end.min=new Date(Date.parse(start.value+'Z')+60000).toISOString().slice(0,16);
   if(end.value&&!end.validity.customError){
    try{eventTiming(start.value,end.value,getZone());}catch(error){end.setCustomValidity(error.message);}
   }
  }
  const invalid=[start,end].find(field=>field.validity.customError);
  if(invalid){invalid.setAttribute('aria-invalid','true');warning.textContent=invalid.validationMessage;warning.hidden=false;}
 }
 for(const type of ['input','change'])form.addEventListener(type,event=>{if(event.target===start||event.target===end)refresh();});
 return {refresh};
}
