import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {dispatch} from '../scripts/dispatch.mjs';
import {writeJson} from '../scripts/core.mjs';

// These workflow guards use the boolean/equality subset shared by Actions and
// JavaScript. Exercise the actual expressions so manual tasks cannot gain a
// publishing side effect when the scheduled catch-up path changes.
const runner=await readFile(new URL('../.github/workflows/run.yml',import.meta.url),'utf8');
const workflow=await readFile(new URL('../.github/workflows/dispatch.yml',import.meta.url),'utf8');
const insightsWorkflow=await readFile(new URL('../.github/workflows/insights.yml',import.meta.url),'utf8');
const catchup=runner.match(/- name: Catch up due campaigns during scheduled insights\n([\s\S]*?)(?=      - )/)[1];
const guard=catchup.match(/if: (.+)/)[1];
const preview=workflow.match(/dry_run: \$\{\{ (.+) \}\}/)[1];
const evaluate=(expression,context)=>vm.runInNewContext(expression,context,{timeout:100});

test('only scheduled live insights gets a durable catch-up before insights collection',()=>{
  for(const task of ['dispatch','insights','calendar','render','refresh','keepalive']) {
    for(const event_name of ['schedule','workflow_dispatch','repository_dispatch','push']) {
      for(const dry_run of [true,false]) {
        assert.equal(evaluate(guard,{inputs:{task,dry_run},github:{event_name}}),task==='insights'&&event_name==='schedule'&&!dry_run,`${task}/${event_name}/${dry_run}`);
      }
    }
  }
  assert.match(catchup,/CAMPAIGN_GIT_CHECKPOINT: '1'/);
  assert.match(catchup,/run: node scripts\/dispatch\.mjs/);
  assert.ok(runner.indexOf('name: Catch up due campaigns')<runner.indexOf('name: Insights'));
  assert.match(runner,/group: campaign-repository\n  cancel-in-progress: false/);
  const fallbackMinute=Number(insightsWorkflow.match(/cron: '(\d+) \* \* \* \*'/)[1]);
  const primaryMinutes=workflow.match(/cron: '([\d,]+) \* \* \* \*'/)[1].split(',').map(Number);
  assert.equal(primaryMinutes.includes(fallbackMinute),false,'fallback should have a separate scheduling minute');
});

test('external dispatch defaults to preview and requires an explicit live mode',()=>{
  assert.match(workflow,/repository_dispatch:\n    types: \[campaign-dispatch\]/);
  for(const mode of [undefined,null,false,true,0,'','preview','false','live']) {
    assert.equal(evaluate(preview,{inputs:{},github:{event_name:'repository_dispatch',event:{client_payload:{mode}}}}),mode!=='live');
  }
  for(const dry_run of [true,false])assert.equal(evaluate(preview,{inputs:{dry_run},github:{event_name:'workflow_dispatch',event:{}}}),dry_run);
  assert.equal(evaluate(preview,{inputs:{},github:{event_name:'schedule',event:{}}}),false);
});

test('a secondary scheduled pass publishes newly due channels once with durable intents',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'dispatch-catchup-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const file=path.join(root,'data/campaigns/2026-27/meeting.json');
  await writeJson(path.join(root,'config/chapter.json'),{chapterName:'Fixture',activeYear:'2026-27',timezone:'America/New_York',siteUrl:'https://example.org',defaultCadence:{feed:{daysBefore:1,time:'10:00'},story:{daysBefore:1,time:'10:00'}},integrations:{groupme:{enabled:true,mode:'bot'}}});
  await writeJson(file,{id:'meeting',year:'2026-27',title:'Meeting',start:'2026-10-22T21:30:00Z',end:'2026-10-22T22:30:00Z',food:false,campaign:{groupme:{enabled:true,announce:true}},revision:1});
  const durable={};const calls=[];
  const checkpoint=async({campaign})=>{Object.assign(durable,structuredClone(campaign));};
  const services={ig:{createContainer:async({channel})=>channel,waitForContainer:async()=>{},publishContainer:async channel=>{assert.ok(durable.results[channel].publishAttemptedAt);calls.push(channel);return `${channel}-receipt`;},getMedia:async()=>({})},postBotMessage:async()=>{assert.ok(durable.results.groupme.botAttemptedAt);calls.push('groupme');}};
  await dispatch({root,now:'2026-10-21T11:40:00Z',services,checkpoint});
  assert.deepEqual(calls,[]);
  // Observed insights creation: 15:31Z, between the 11:40Z and 16:08Z dispatches.
  await dispatch({root,now:'2026-10-21T15:31:00Z',services,checkpoint});
  assert.deepEqual(calls,['feed','story','groupme']);
  const delivered=JSON.parse(await readFile(file,'utf8'));
  await dispatch({root,now:'2026-10-21T16:08:00Z',services,checkpoint});
  assert.deepEqual(calls,['feed','story','groupme']);
  assert.deepEqual(JSON.parse(await readFile(file,'utf8')).results,delivered.results);
  assert.equal(JSON.parse(await readFile(path.join(root,'data/dispatcher-health.json'),'utf8')).lastLiveRunStatus,'success');
});
