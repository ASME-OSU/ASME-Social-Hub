import {fireTime,localInput} from './time.mjs';
import {groupMeDue} from './groupme-schedule.mjs';

const labels={feed:'Instagram feed',story:'Instagram Story',groupme:'GroupMe announcement',followUp:'GroupMe follow-up'};
export function nextCampaignAction(c,config,now=new Date()){
 const current=+new Date(now),start=Date.parse(c.start);
 if(!Number.isFinite(current)||!Number.isFinite(start)||current>=start||c.cancelled||c.deletedAt||c.archived||c.demo||c.year!==config.activeYear)return null;
 const actions=[];
 function add(channel,kind,receipt,state,due){
  if(['done','skipped'].includes(state)||receipt.mediaId||receipt.postedAt||receipt.publishAttemptedAt||receipt.botSentAt||receipt.botAttemptedAt)return;
  try{
   const at=due(),time=Date.parse(at);
   if(!Number.isFinite(time)||time>=start||current-time>86400000)return;
   if(kind==='followUp'&&Date.parse(c.results?.groupme?.botSentAt)>=time)return;
   actions.push({channel,kind,label:labels[kind==='followUp'?'followUp':channel],due:at,late:time<current});
  }catch{/* Invalid schedules appear in warnings rather than promising a send. */}
 }
 for(const channel of ['feed','story']){
  if(c.campaign?.[channel]?.enabled===false)continue;
  const cadence={...config.defaultCadence?.[channel],...c.campaign?.[channel],enabled:true};
  add(channel,'initial',c.results?.[channel]||{},c.status?.[channel],()=>fireTime({...c,campaign:{...c.campaign,[channel]:cadence}},channel,config.timezone));
 }
 const plan=c.campaign?.groupme,result=c.results?.groupme||{};
 if(config.integrations?.groupme?.enabled!==false&&config.integrations?.groupme?.mode==='bot'&&plan?.enabled===true&&plan.announce===true){
  if(result.botSentAt){if(plan.followUp?.enabled)add('groupme','followUp',result.followUp||{},result.followUp?.status,()=>groupMeDue(c,config,'followUp'));}
  else add('groupme','initial',result,c.status?.groupme,()=>groupMeDue(c,config));
 }
 return actions.sort((a,b)=>Date.parse(a.due)-Date.parse(b.due))[0]||null;
}
export function actionCountdown(due,zone,now=new Date()){
 const current=+new Date(now),delta=Date.parse(due)-current;
 if(delta<0)return 'Awaiting next dispatcher run';
 if(delta<60000)return 'Due now';
 const day=at=>Date.parse(localInput(at,zone).slice(0,10)+'T12:00:00Z');
 const days=Math.round((day(due)-day(current))/86400000);
 if(days===1)return 'Tomorrow';
 if(days>1)return `In ${days} days`;
 const minutes=Math.ceil(delta/60000),hours=Math.floor(minutes/60);
 return hours?`In ${hours} hour${hours===1?'':'s'}`:`In ${minutes} minute${minutes===1?'':'s'}`;
}
export function overviewSummary(c){return String(c.description||'').trim().replace(/\s+/g,' ');}
export function overviewIdleMessage(c,config,warnings=[],now=new Date()){
 if(c.cancelled||c.deletedAt)return 'Pending messages have been stopped.';
 if(c.demo)return 'Example campaign · messages will not be sent.';
 if(c.archived)return 'Archived campaign · messages will not be sent.';
 if(c.year!==config.activeYear)return 'Outside the active academic year · messages will not be sent.';
 if(Date.parse(c.start)<=+new Date(now))return 'The event has started. No further announcements are scheduled.';
 return warnings.length?'Review the warning below before the next send.':'No further messages are scheduled.';
}
export function orderedOverviewWarnings(warnings){
 const rank={failed:0,missed:1,late:2};
 return warnings.map((warning,index)=>({warning,index})).sort((a,b)=>(rank[a.warning.state]??3)-(rank[b.warning.state]??3)||a.index-b.index).map(item=>item.warning);
}
export function warningExcerpt(warning){
 const text=String(warning?.message||'').replace(/\s+/g,' ').trim();
 if(text.length<=210)return text;
 return text.slice(0,207).replace(/\s+\S*$/,'')+'…';
}
