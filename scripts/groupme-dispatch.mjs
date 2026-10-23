import {botAnnouncementText} from '../docs/groupme-message.mjs';
import {groupMeDue,validateGroupMeTiming} from '../docs/groupme-schedule.mjs';

// Each message has its own durable write intent and receipt. An uncertain send
// is never retried automatically, and a reminder cannot bypass that uncertainty.
export async function dispatchGroupMe({c,config,now,dryRun,services,save,log,actions}) {
 const plan=c.campaign?.groupme;
 if(plan?.enabled!==true||plan.announce!==true)return;
 const result=c.results?.groupme||{};
 const kinds=['initial',...(plan.followUp?.enabled?['followUp']:[])];
 for(const kind of kinds){
  const followUp=kind==='followUp',receipt=followUp?(result.followUp||{}):result;
  if(receipt.botSentAt)continue;
  if(followUp&&!result.botSentAt)continue;
  if(!followUp&&['done','skipped'].includes(c.status?.groupme)&&!receipt.botAttemptedAt)continue;
  if(followUp&&['done','skipped'].includes(receipt.status))continue;
  const actionName=followUp?'follow-up':'announce',stage=followUp?'bot-follow-up':'bot';
  const attach=()=>{c.results.groupme=result;if(followUp)result.followUp=receipt;};
  const fail=async error=>{if(dryRun)return;attach();receipt.error={...error,at:now.toISOString()};if(followUp)receipt.status='failed';c.status.groupme='failed';await save();};
  if(receipt.botAttemptedAt){
   const error={code:'BOT_RECONCILIATION_REQUIRED',stage,hint:'Inspect GroupMe before clearing the recorded attempt; delivery is unresolved.'};
   actions.push({id:c.id,channel:'groupme',action:actionName,outcome:'failed',error});
   if(!dryRun&&receipt.error?.code!==error.code){log('groupme',error.hint);await fail(error);}
   continue;
  }
  const due=new Date(groupMeDue(c,config,kind));
  const reason=c.cancelled?'cancelled':now>=new Date(c.start)||(+now>=+due&&+now-+due>86400000)?'announcement-window-missed':followUp&&Date.parse(result.botSentAt)>=+due?'initial-sent-after-follow-up-time':null;
  if(reason){
   actions.push({id:c.id,channel:'groupme',action:'skip',message:kind,reason});
   if(!dryRun){attach();receipt.skipReason=reason;if(followUp){receipt.status='skipped';c.status.groupme='done';}else c.status.groupme='skipped';log('groupme',followUp?'Bot follow-up skipped':'Bot announcement skipped');await save();}
   continue;
  }
  if(now<due)continue;
  const action={id:c.id,channel:'groupme',action:actionName,fireAt:due.toISOString()};actions.push(action);
  try{
   validateGroupMeTiming(c,config);
   const text=botAnnouncementText(c,config,{kind});
   if(dryRun){action.text=text;continue;}
   attach();receipt.botText=text;receipt.botAttemptedAt=now.toISOString();await save();
   await services.postBotMessage(text);
   receipt.botSentAt=now.toISOString();delete receipt.error;delete receipt.skipReason;
   if(followUp)receipt.status='done';
   c.status.groupme=!followUp&&plan.followUp?.enabled?'pending':'done';
   log('groupme',followUp?'Bot follow-up sent':'Bot announcement sent');
  }catch(error){
   if(error.persistenceFailure)throw error;
   action.outcome='failed';action.error={code:receipt.botAttemptedAt?'BOT_OUTCOME_UNKNOWN':'BOT_PREPARATION_FAILED',stage,hint:receipt.botAttemptedAt?'Inspect GroupMe before clearing the recorded attempt; this message will not automatically retry.':'Check message length, dates, timezone, and links.'};
   if(!dryRun){attach();receipt.error={...action.error,at:now.toISOString()};if(followUp)receipt.status='failed';c.status.groupme='failed';log('groupme',action.error.hint);}
  }
  if(!dryRun)await save();
 }
 if(!dryRun&&result.botSentAt){
  const follow=result.followUp,status=plan.followUp?.enabled?(follow?.botSentAt||follow?.status==='skipped'?'done':follow?.status==='failed'?'failed':'pending'):'done';
  if(c.status.groupme!==status){c.status.groupme=status;await save();}
 }
}
