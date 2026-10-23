import {GROUPME_FORMATS,randomGroupMeFormat} from './groupme-message.mjs';
import {groupMeCadence} from './groupme-schedule.mjs';

export function createGroupMeControls({form,getConfig,onPreview,onChange}){
 const f=form.elements;
 for(const name of ['groupmeFormat','groupmeFollowUpFormat'])f[name].replaceChildren(...Object.entries(GROUPME_FORMATS).map(([value,label])=>new Option(label,value)));
 function sync(){
  const config=getConfig(),bot=config.integrations?.groupme?.mode==='bot',available=bot&&config.integrations?.groupme?.enabled!==false,on=available&&f.groupmeAnnounce.checked;
  document.querySelector('#groupme-announcement-control').hidden=!bot;f.groupmeAnnounce.disabled=!available;
  document.querySelector('#groupme-setup-note').hidden=available;
  document.querySelector('#groupme-message-settings').hidden=!on;
  document.querySelector('#groupme-follow-up-settings').hidden=!on||!f.groupmeFollowUp.checked;
  for(const name of ['groupmeDays','groupmeTime','groupmeFormat','groupmeFollowUp'])f[name].disabled=!on;
  for(const name of ['groupmeFollowUpDays','groupmeFollowUpTime','groupmeFollowUpFormat'])f[name].disabled=!on||!f.groupmeFollowUp.checked;
 }
 function reset(c){
  const config=getConfig(),initial=groupMeCadence(c||{},config),followUp=groupMeCadence(c||{},config,'followUp');
  f.groupmeDays.value=initial.daysBefore;f.groupmeTime.value=initial.time;
  f.groupmeFormat.value=initial.format||'standard';f.groupmeFollowUp.checked=!!c?.campaign?.groupme?.followUp?.enabled;
  f.groupmeFollowUpDays.value=followUp.daysBefore;f.groupmeFollowUpTime.value=followUp.time;f.groupmeFollowUpFormat.value=followUp.format||'invite';sync();
 }
 function read(){
  const enabled=f.groupmeAnnounce.checked,config=getConfig();
  function cadence(days,time,active,fallback,label){
   const value={daysBefore:Number(days.value),time:time.value},valid=days.value.trim()!==''&&Number.isInteger(value.daysBefore)&&value.daysBefore>=0&&value.daysBefore<=365&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time);
   if(!valid&&active)throw Error('Choose valid days before and a time for the GroupMe '+label+'.');
   return valid?value:fallback;
  }
  return {enabled,announce:enabled,...cadence(f.groupmeDays,f.groupmeTime,enabled,config.defaultCadence.feed,'initial announcement'),format:f.groupmeFormat.value,followUp:{enabled:f.groupmeFollowUp.checked,...cadence(f.groupmeFollowUpDays,f.groupmeFollowUpTime,enabled&&f.groupmeFollowUp.checked,{daysBefore:1,time:'12:00'},'follow-up'),format:f.groupmeFollowUpFormat.value}};
 }

 for(const button of document.querySelectorAll('[data-shuffle-groupme]'))button.addEventListener('click',()=>{
  const followUp=button.dataset.shuffleGroupme==='followUp',input=f[followUp?'groupmeFollowUpFormat':'groupmeFormat'];input.value=randomGroupMeFormat(input.value);onChange();onPreview(followUp?'followUp':'initial');
 });
 document.querySelector('#preview-groupme-message').addEventListener('click',()=>onPreview('initial'));
 return {reset,read,sync};
}
