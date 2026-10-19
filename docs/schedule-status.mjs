import {fireTime} from './time.mjs';
const DAY=86400000;
const progress=result=>Boolean(result&&(result.publishAttemptedAt||result.containerId||result.mediaId||result.postedAt||result.botAttemptedAt||result.botSentAt));

/** Tells the editor whether a scheduled time has already passed, using the dispatcher's 24-hour rule. */
export function scheduleWarning(dueIso,now=new Date()){
  if(!dueIso)return null;
  const late=+now-Date.parse(dueIso);
  if(!Number.isFinite(late)||late<0)return null;
  return late>DAY
    ?{level:'skipped',text:'Already passed. The dispatcher skips posts more than 24 hours late, so this post will be skipped. Choose a later time.'}
    :{level:'late',text:'This time has just passed. It will post on the next dispatcher run, which can take up to an hour.'};
}

/**
 * A channel skipped for a missed window returns to pending when its schedule is edited,
 * unless something was already published or attempted. Never clears a published channel.
 */
export function reopenMissedChannels({previous,next,status,zone,groupmeBot=false}){
  if(!previous)return status;
  const out={...status},was=previous.status||{},current=k=>out[k]??was[k];
  for(const k of ['feed','story']){
    if(current(k)!=='skipped'||progress(previous.results?.[k]))continue;
    if(previous.campaign?.[k]?.enabled===false||next.campaign?.[k]?.enabled===false)continue;
    const before=fireTime(previous,k,zone),after=fireTime(next,k,zone);
    if(after&&before!==after)out[k]='pending';
  }
  const optedIn=x=>x.campaign?.groupme?.enabled===true&&x.campaign?.groupme?.announce===true;
  if(groupmeBot&&optedIn(previous)&&optedIn(next)&&current('groupme')==='skipped'&&!progress(previous.results?.groupme)){
    const feedTime=x=>x.campaign?.feed?fireTime({start:x.start,campaign:{feed:{...x.campaign.feed,enabled:true}}},'feed',zone):null;
    const before=feedTime(previous),after=feedTime(next);
    if(after&&before!==after)out.groupme='pending';
  }
  return out;
}
