import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {runWatchdog,watchdogDecision,WATCHDOG_STALE_MS,WATCHDOG_COOLDOWN_MS} from '../scripts/dispatch-watchdog.mjs';

const now=Date.parse('2026-10-22T18:49:00Z');
const health={lastSuccessfulLiveRunAt:'2026-10-22T17:35:58.896Z'};
const recent={lastSuccessfulLiveRunAt:new Date(now-1000).toISOString()};
const run={status:'completed',event:'schedule',created_at:'2026-10-22T17:35:43Z'};
const env={GITHUB_REPOSITORY:'fixture/hub',GH_TOKEN:'TEST_TOKEN_DO_NOT_LOG'};

test('watchdog distinguishes fresh, overdue, missing and future heartbeat',()=>{
  assert.equal(watchdogDecision({health:recent,now}).reason,'recent-success');
  for(const value of [health,null,{}, {lastSuccessfulLiveRunAt:'invalid'},{lastSuccessfulLiveRunAt:'2027-01-01T00:00:00Z'},{lastSuccessfulLiveRunAt:new Date(now-WATCHDOG_STALE_MS).toISOString()}]) {
    assert.equal(watchdogDecision({health:value,now}).request,true);
  }
});

test('October 27 noon delay is recoverable before the former hourly watchdog slot',()=>{
  const heartbeat={lastSuccessfulLiveRunAt:'2026-10-27T15:48:36.000Z'};
  const primary={...run,created_at:'2026-10-27T15:48:25Z'};
  // A punctual 12:22 check allows normal cadence/jitter; 12:32 recovers
  // the absent primary passes without waiting for the old hourly :49 slot.
  assert.equal(watchdogDecision({health:heartbeat,dispatchRuns:[primary],now:Date.parse('2026-10-27T16:22:00Z')}).request,false);
  assert.deepEqual(watchdogDecision({health:heartbeat,dispatchRuns:[primary],now:Date.parse('2026-10-27T16:32:00Z')}),{request:true,reason:'heartbeat-overdue'});
  assert.equal(watchdogDecision({health:heartbeat,dispatchRuns:[{...primary,created_at:'2026-10-27T16:31:00Z',status:'queued'}],now:Date.parse('2026-10-27T16:32:00Z')}).request,false);
});


test('48 hours of healthy half-hour passes never request watchdog recovery',()=>{
  const start=Date.parse('2026-10-25T00:00:00Z');
  for(let minute=0;minute<48*60;minute++) {
    const current=start+minute*60*1000;
    const lastPass=start+Math.floor(minute/30)*30*60*1000;
    assert.equal(watchdogDecision({health:{lastSuccessfulLiveRunAt:new Date(lastPass).toISOString()},now:current}).request,false,`minute ${minute}`);
  }
});

test('stale heartbeat and request cooldown have independent boundaries',()=>{
  for(const age of [WATCHDOG_COOLDOWN_MS-1,WATCHDOG_COOLDOWN_MS]) {
    const decision=watchdogDecision({health,now,dispatchRuns:[{...run,created_at:new Date(now-age).toISOString()}]});
    assert.equal(decision.request,age===WATCHDOG_COOLDOWN_MS);
  }
  assert.equal(watchdogDecision({health:{lastSuccessfulLiveRunAt:new Date(now-WATCHDOG_STALE_MS+1).toISOString()},now}).request,false);
});

test('active dispatch and scheduled Insights suppress requests, manual Insights does not',()=>{
  for(const status of ['queued','requested','waiting','pending','in_progress']) {
    assert.equal(watchdogDecision({health,now,dispatchRuns:[{...run,status}]}).reason,'dispatcher-already-active');
    assert.equal(watchdogDecision({health,now,insightsRuns:[{...run,status}]}).reason,'dispatcher-already-active');
    assert.equal(watchdogDecision({health,now,insightsRuns:[{...run,status,event:'workflow_dispatch'}]}).request,true);
  }
  for(const conclusion of ['success','failure','cancelled'])assert.equal(watchdogDecision({health,now,dispatchRuns:[{...run,conclusion,created_at:new Date(now-1000).toISOString()}]}).reason,'recent-dispatch-request');
});

function mock({heartbeat=health,primary=[run],insights=[],failure}={}) {
  const requests=[];
  const fetchImpl=async(url,options)=>{
    const resource=new URL(url).pathname;
    requests.push({resource,...options});
    if(failure?.(resource))return Response.json({message:env.GH_TOKEN},{status:403});
    if(resource.includes('/contents/'))return heartbeat===null?new Response(null,{status:404}):Response.json({encoding:'base64',content:Buffer.from(JSON.stringify(heartbeat)).toString('base64')});
    if(resource.endsWith('/dispatch.yml/runs'))return Response.json({workflow_runs:primary});
    if(resource.endsWith('/insights.yml/runs'))return Response.json({workflow_runs:insights});
    if(resource.endsWith('/dispatches'))return new Response(null,{status:204});
    throw Error('Unexpected request');
  };
  return {requests,fetchImpl};
}

test('overdue live watchdog requests only the existing main dispatcher, never social APIs',async()=>{
  const {requests,fetchImpl}=mock();
  assert.deepEqual(await runWatchdog({env,fetchImpl,now,dryRun:false}),{request:true,reason:'heartbeat-overdue',dryRun:false});
  const writes=requests.filter(request=>request.method==='POST');
  assert.equal(writes.length,1);
  assert.equal(writes[0].resource,'/repos/fixture/hub/actions/workflows/dispatch.yml/dispatches');
  assert.deepEqual(JSON.parse(writes[0].body),{ref:'main',inputs:{dry_run:false}});
});

test('preview, recent success and active run make no dispatch request',async()=>{
  for(const options of [{},{heartbeat:recent},{primary:[{...run,status:'pending'}]},{primary:[{...run,created_at:new Date(now-1000).toISOString()}]}]) {
    const {requests,fetchImpl}=mock(options);
    await runWatchdog({env,fetchImpl,now,...(Object.keys(options).length?{dryRun:false}:{})});
    assert.equal(requests.some(request=>request.method==='POST'),false);
    if(options.heartbeat===recent)assert.equal(requests.length,1,'healthy checks do not fetch run lists');
  }
});

test('missing heartbeat can recover but unreadable GitHub state fails closed without exposing response text',async()=>{
  const missing=mock({heartbeat:null});
  assert.equal((await runWatchdog({env,now,fetchImpl:missing.fetchImpl,dryRun:false})).request,true);
  for(const match of ['/contents/','/dispatch.yml/runs','/insights.yml/runs']) {
    const {requests,fetchImpl}=mock({failure:resource=>resource.includes(match)});
    const error=await runWatchdog({env,fetchImpl,now,dryRun:false}).catch(error=>error);
    assert.match(error.message,/HTTP 403/);
    assert.doesNotMatch(error.message,/TEST_TOKEN/);
    assert.equal(requests.some(request=>request.method==='POST'),false);
  }
});

test('watchdog workflow is lightweight, staggered and cannot loop on dispatch or manual analytics',async()=>{
  const workflow=await readFile(new URL('../.github/workflows/dispatch-watchdog.yml',import.meta.url),'utf8');
  const minutes=workflow.match(/cron: '([\d,]+) \* \* \* \*'/)[1].split(',').map(Number);
  assert.equal(minutes.length,6);
  for(let i=0;i<minutes.length;i++)assert.equal((minutes[(i+1)%minutes.length]-minutes[i]+60)%60,10);
  assert.equal(WATCHDOG_STALE_MS,40*60*1000);
  assert.equal(WATCHDOG_COOLDOWN_MS,20*60*1000);
  assert.match(workflow,/workflows: \[Render and publish dashboard, Calendar\]/);
  assert.match(workflow,/branches: \[main\]/);
  assert.match(workflow,/contents: read\n  actions: write/);
  assert.match(workflow,/default: true/);
  assert.doesNotMatch(workflow,/secrets:|npm |render-flyers|deploy-pages|GROUPME|IG_ACCESS_TOKEN/);
  const guard=workflow.match(/    if: (.+)/)[1];
  const evaluate=github=>vm.runInNewContext(guard,{github},{timeout:100});
  assert.equal(evaluate({event_name:'schedule'}),true);
  for(const event of ['push','schedule','workflow_dispatch','pull_request']) {
    for(const conclusion of ['success','failure','cancelled']) {
      for(const repository of ['fixture/hub','fork/hub']) {
        assert.equal(evaluate({event_name:'workflow_run',repository:'fixture/hub',event:{workflow_run:{event,conclusion,head_repository:{full_name:repository}}}}),conclusion==='success'&&repository==='fixture/hub'&&['push','schedule'].includes(event));
      }
    }
  }
});
