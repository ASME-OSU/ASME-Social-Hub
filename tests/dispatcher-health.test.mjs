import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {dispatcherHealth,STALE_AFTER_MS,DELAYED_AFTER_MS} from '../docs/dispatcher-health.mjs';
import {dispatch} from '../scripts/dispatch.mjs';
import {writeJson} from '../scripts/core.mjs';
const at='2026-10-20T12:00:00Z';
test('health distinguishes a recent completion, scheduling delay, prolonged gap and recovery',()=>{
 const data={lastSuccessfulLiveRunAt:at};
 assert.equal(dispatcherHealth(data,Date.parse(at)+DELAYED_AFTER_MS).state,'healthy');
 const delayed=dispatcherHealth(data,Date.parse(at)+DELAYED_AFTER_MS+1);assert.equal(delayed.state,'delayed');assert.match(delayed.message,/1 hour ago/);assert.match(delayed.message,/no newer completion is recorded/i);assert.match(delayed.message,/cannot confirm whether a run is queued/);
 assert.equal(dispatcherHealth(data,Date.parse(at)+9*60*60*1000).state,'delayed');
 assert.equal(dispatcherHealth(data,Date.parse(at)+STALE_AFTER_MS).state,'delayed');
 assert.equal(dispatcherHealth(data,Date.parse(at)+STALE_AFTER_MS+1).state,'stale');
 const recovered='2026-10-20T21:10:00Z';assert.equal(dispatcherHealth({lastSuccessfulLiveRunAt:recovered,lastLiveRunAt:recovered,lastLiveRunStatus:'success'},Date.parse(recovered)).state,'healthy');
 for(const d of [null,{}, {lastSuccessfulLiveRunAt:'invalid'},{lastSuccessfulLiveRunAt:'2027-01-01'}])assert.equal(dispatcherHealth(d,Date.parse(at)).state,'unknown');
});
test('recorded publishing failures surface immediately without advancing last success',()=>{
 const failed='2026-10-20T12:15:00Z',data={lastSuccessfulLiveRunAt:at,lastLiveRunAt:failed,lastLiveRunStatus:'failed'};
 const health=dispatcherHealth(data,Date.parse(failed)+60000);assert.equal(health.state,'failed');assert.equal(health.at,at.replace('Z','.000Z'));assert.match(health.message,/publishing failure 1 minute ago/);
 assert.equal(dispatcherHealth({lastLiveRunAt:failed,lastLiveRunStatus:'failed'},Date.parse(failed)).state,'failed');
 assert.equal(dispatcherHealth({...data,lastSuccessfulLiveRunAt:'2026-10-20T12:30:00Z'},Date.parse('2026-10-20T12:31:00Z')).state,'healthy');
 for(const lastLiveRunAt of ['invalid','2027-01-01'])assert.equal(dispatcherHealth({...data,lastLiveRunAt},Date.parse(failed)).state,'healthy');
});
async function fixture(t){const root=await mkdtemp(path.join(tmpdir(),'dispatcher-health-'));t.after(()=>rm(root,{recursive:true,force:true}));await writeJson(path.join(root,'config/chapter.json'),{chapterName:'Fixture',activeYear:'2026-27',timezone:'America/New_York',defaultCadence:{feed:{daysBefore:7,time:'12:00'},story:{daysBefore:3,time:'12:00'}}});return {root,file:path.join(root,'data/dispatcher-health.json')};}
test('successful empty live runs record heartbeat; previews cannot advance it',async t=>{const {root,file}=await fixture(t);await dispatch({root,services:{}});const before=await readFile(file,'utf8');assert.ok(JSON.parse(before).lastSuccessfulLiveRunAt);await dispatch({root,dryRun:true});assert.equal(await readFile(file,'utf8'),before);});
test('failed publish does not advance successful live timestamp; lock prevents overlapping live runs',async t=>{const {root,file}=await fixture(t);await writeJson(file,{lastSuccessfulLiveRunAt:at});await writeJson(path.join(root,'data/campaigns/2026-27/fixture.json'),{id:'fixture',year:'2026-27',title:'Fixture',food:false,type:'meeting',start:'2026-10-21T22:00:00Z',end:'2026-10-21T23:00:00Z',location:{name:'Fixture room'},campaign:{feed:{enabled:true,daysBefore:7,time:'12:00'},story:{enabled:false,daysBefore:3,time:'12:00'},groupme:{enabled:false}},status:{feed:'pending'},results:{},log:[]});await dispatch({root,now:'2026-10-14T17:00:00Z',services:{ig:{createContainer:async()=>{await assert.rejects(dispatch({root,services:{}}),/lock exists/);throw Error('fixture failure');}}}});const data=JSON.parse(await readFile(file));assert.equal(data.lastSuccessfulLiveRunAt,at);assert.equal(data.lastLiveRunStatus,'failed');});
test('workflow keeps preview default, serialized durable publishing and half-hour schedule',async()=>{const workflow=await readFile('.github/workflows/dispatch.yml','utf8'),runner=await readFile('.github/workflows/run.yml','utf8');assert.match(workflow,/cron: '7,37 \* \* \* \*'/);assert.match(workflow,/default: true/);assert.match(runner,/group: campaign-repository/);assert.match(runner,/cancel-in-progress: false/);assert.match(runner,/CAMPAIGN_GIT_CHECKPOINT:/);});
