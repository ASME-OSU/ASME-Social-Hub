import {fireTime} from './time.mjs';

export function groupMeCadence(c,config,kind='initial') {
 const plan=c.campaign?.groupme||{};
 return kind==='followUp'?{daysBefore:1,time:'12:00',...plan.followUp,enabled:true}:{...config.defaultCadence?.feed,...c.campaign?.feed,...plan,enabled:true};
}
export function groupMeDue(c,config,kind='initial') {
 return fireTime({...c,campaign:{...c.campaign,groupme:groupMeCadence(c,config,kind)}},'groupme',config.timezone);
}
export function validateGroupMeTiming(c,config) {
 const plan=c.campaign?.groupme;
 if(!plan?.enabled||!plan.announce)return;
 const initial=Date.parse(groupMeDue(c,config));
 if(initial>=Date.parse(c.start))throw Error('Schedule the initial GroupMe announcement before the event starts.');
 if(plan.followUp?.enabled){
  const followUp=Date.parse(groupMeDue(c,config,'followUp'));
  if(followUp<=initial||followUp>=Date.parse(c.start))throw Error('Schedule the GroupMe follow-up after the initial announcement and before the event starts.');
 }
}
