import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareCampaignDeletion,campaignIsDeleted} from '../docs/campaign-delete.mjs';
import {buildArchive} from '../scripts/archive.mjs';
import {dispatch} from '../scripts/dispatch.mjs';
import {writeJson} from '../scripts/core.mjs';
import {calendarFile} from '../scripts/ics.mjs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const config={chapterName:'Fixture',activeYear:'2026-27',timezone:'America/New_York',integrations:{groupme:{enabled:true,mode:'bot'}},defaultCadence:{feed:{daysBefore:7,time:'12:00'},story:{daysBefore:3,time:'12:00'}}};
const base={id:'delete-fixture',year:'2026-27',title:'Delete fixture',start:'2026-11-21T23:00:00Z',end:'2026-11-22T00:00:00Z',food:false,revision:1,campaign:{feed:{enabled:true,daysBefore:7,time:'12:00'},story:{enabled:false,daysBefore:3,time:'12:00'},groupme:{enabled:true,announce:true}},status:{feed:'pending',groupme:'pending'},results:{feed:{},groupme:{}},log:[]};
test('deletion stops pending delivery, retaining newest runtime evidence',()=>{
 const current={...base,revision:5,status:{feed:'done',groupme:'failed'},results:{feed:{mediaId:'published-id'},groupme:{botAttemptedAt:'attempt-recorded'}},log:[{message:'Existing log'}]};
 const deleted=prepareCampaignDeletion(base,current,config,'2026-10-20T12:00:00Z');
 assert.equal(campaignIsDeleted(deleted),true);assert.equal(deleted.cancelled,true);assert.equal(deleted.revision,6);assert.deepEqual(deleted.results,current.results);assert.deepEqual(deleted.status,current.status);assert.equal(deleted.log.length,2);assert.equal(deleted.log[0].message,'Existing log');assert.equal(base.deletedAt,undefined);
});
test('deletion refuses content changes and prior deletions',()=>{
 for(const change of [{title:'Another officer'},{cancelled:true},{deletedAt:'2026-10-20T10:00:00Z'}])assert.throws(()=>prepareCampaignDeletion(base,{...base,...change},config),/edited since/);
});
async function fixture(t,campaign,chapter=config){const root=await mkdtemp(join(tmpdir(),'campaign-delete-'));t.after(()=>rm(root,{recursive:true,force:true}));await writeJson(join(root,'config/chapter.json'),chapter);const file=join(root,'data/campaigns',campaign.year,campaign.id+'.json');await writeJson(file,campaign);return {root,file};}
test('deleted campaigns stay out of archive and never publish even if cancelled flag is missing',async t=>{
 const deleted=prepareCampaignDeletion(base,base,config);delete deleted.cancelled;
 const {root}=await fixture(t,deleted);
 await dispatch({root,now:'2026-11-14T17:00:00Z',services:new Proxy({},{get(){throw Error('Must not publish deleted campaign');}})});
 assert.deepEqual((await buildArchive(root)).campaigns,[]);assert.match(calendarFile(deleted),/STATUS:CANCELLED/);
});
test('deleted native GroupMe campaign still removes its existing remote event once',async t=>{
 const chapter={...config,integrations:{groupme:{enabled:true,mode:'native'}}};
 const current={...base,results:{groupme:{eventId:'existing',syncedRevision:1}}};
 const deleted=prepareCampaignDeletion(base,current,chapter);const {root,file}=await fixture(t,deleted,chapter);let deletes=0;
 const services={groupme:{deleteEvent:async id=>{assert.equal(id,'existing');deletes++;}}};
 await dispatch({root,now:'2026-11-14T17:00:00Z',services});await dispatch({root,now:'2026-11-14T18:00:00Z',services});assert.equal(deletes,1);assert.ok(JSON.parse(await readFile(file)).results.groupme.deletedAt);
});
