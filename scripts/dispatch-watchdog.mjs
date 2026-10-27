import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Allow the normal 30-minute primary cadence plus scheduling jitter.
export const WATCHDOG_STALE_MS=40*60*1000;
// Throttle accepted requests independently while their heartbeat is pending.
export const WATCHDOG_COOLDOWN_MS=20*60*1000;
const time=value=>typeof value==='string'?Date.parse(value):NaN;
const active=run=>['queued','requested','waiting','pending','in_progress'].includes(run.status);
export function watchdogDecision({health,dispatchRuns=[],insightsRuns=[],now=Date.now()}) {
  const current=+now;
  if(!Number.isFinite(current))throw Error('Invalid watchdog time');
  const success=time(health?.lastSuccessfulLiveRunAt);
  if(Number.isFinite(success)&&success<=current&&current-success<WATCHDOG_STALE_MS)return {request:false,reason:'recent-success'};
  const liveInsights=insightsRuns.filter(run=>run.event==='schedule');
  if([...dispatchRuns,...liveInsights].some(active))return {request:false,reason:'dispatcher-already-active'};
  // Includes previews and failures: avoid repeatedly requesting jobs when a run
  // was just accepted, even before its heartbeat has reached the repository.
  if(dispatchRuns.some(run=>{const at=time(run.created_at);return Number.isFinite(at)&&at<=current&&current-at<WATCHDOG_COOLDOWN_MS;}))return {request:false,reason:'recent-dispatch-request'};
  return {request:true,reason:'heartbeat-overdue'};
}

export async function runWatchdog({env=process.env,fetchImpl=fetch,now=Date.now(),dryRun=true}={}) {
  const repo=env.GITHUB_REPOSITORY,token=env.GH_TOKEN;
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo||'')||!token)throw Error('GitHub workflow context required');
  const request=async(resource,{method='GET',body,missing=false}={})=>{
    let response;
    try {
      response=await fetchImpl(`https://api.github.com/repos/${repo}/${resource}`,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
    } catch {throw Error('GitHub watchdog request unavailable');}
    if(missing&&response.status===404)return null;
    if(!response.ok)throw Error(`GitHub watchdog request rejected (HTTP ${response.status})`);
    if(response.status===204)return null;
    try{return await response.json();}catch{throw Error('Invalid GitHub watchdog response');}
  };
  const file=await request('contents/data/dispatcher-health.json?ref=main',{missing:true});
  let health=null;
  if(file!==null) {
    if(file.encoding!=='base64'||typeof file.content!=='string')throw Error('Invalid GitHub health file response');
    try {health=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));}catch{throw Error('Invalid dispatcher health file');}
  }
  let decision=watchdogDecision({health,now});
  if(!decision.request)return {...decision,dryRun};
  const [primary,insights]=await Promise.all(['dispatch.yml','insights.yml'].map(workflow=>request(`actions/workflows/${workflow}/runs?branch=main&per_page=100`)));
  if(!Array.isArray(primary?.workflow_runs)||!Array.isArray(insights?.workflow_runs))throw Error('Invalid GitHub workflow run response');
  decision=watchdogDecision({health,dispatchRuns:primary.workflow_runs,insightsRuns:insights.workflow_runs,now});
  if(decision.request&&!dryRun)await request('actions/workflows/dispatch.yml/dispatches',{method:'POST',body:{ref:'main',inputs:{dry_run:false}}});
  return {...decision,dryRun};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  runWatchdog({dryRun:process.env.WATCHDOG_DRY_RUN!=='false'}).then(result=>{
    console.log(result.request?(result.dryRun?'Preview: overdue dispatcher would be requested.':'Live dispatcher requested; workflow completion is not yet confirmed.'):`No dispatcher requested: ${result.reason}.`);
  }).catch(error=>{console.error(error.message);process.exitCode=1;});
}
