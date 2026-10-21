export const DELAYED_AFTER_MS=90*60*1000;
// Recent scheduled runs have arrived hours apart despite a 15-minute cron.
// Keep that delay visible; reserve the stronger warning for a prolonged gap.
export const STALE_AFTER_MS=12*60*60*1000;
const elapsed=milliseconds=>{const minutes=Math.floor(milliseconds/60000);if(minutes<60)return `${minutes} minute${minutes===1?'':'s'}`;const hours=Math.floor(minutes/60);return `${hours} hour${hours===1?'':'s'}`;};
export function dispatcherHealth(data, now=Date.now()) {
  const at=Date.parse(data?.lastSuccessfulLiveRunAt),last=Date.parse(data?.lastLiveRunAt),current=+now;
  const success=Number.isFinite(at)&&at<=current;
  if(data?.lastLiveRunStatus==='failed'&&Number.isFinite(last)&&last<=current&&(!Number.isFinite(at)||last>=at))return {state:'failed',at:success?new Date(at).toISOString():null,message:`The latest completed dispatcher run recorded a publishing failure ${elapsed(current-last)} ago. Review GitHub Actions and campaign results before retrying.`};
  if(!success)return {state:'unknown',at:null,message:'No successful live dispatcher run recorded. Automatic publishing health is unknown.'};
  const age=current-at,result={at:new Date(at).toISOString()};
  if(age>STALE_AFTER_MS)return {...result,state:'stale',message:`No successful dispatcher completion for more than 12 hours; the last success was ${elapsed(age)} ago. Check GitHub Actions before running the dispatcher manually. This page cannot confirm whether a run is queued.`};
  if(age>DELAYED_AFTER_MS)return {...result,state:'delayed',message:`GitHub’s scheduled run is delayed. The last completed successful run was ${elapsed(age)} ago; no newer completion is recorded. Scheduled posts may be late. This page cannot confirm whether a run is queued.`};
  return {...result,state:'healthy',message:'A successful dispatcher completion was recorded recently. Scheduled GitHub Actions runs can be delayed.'};
}
