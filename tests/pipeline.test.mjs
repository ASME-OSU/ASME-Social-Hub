import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {calendarFile} from '../scripts/ics.mjs';
import {captionFor,validateCampaign} from '../scripts/core.mjs';
import {prepareImportedCampaign} from '../scripts/import-issue.mjs';
import {main as insights} from '../scripts/insights.mjs';
const campaign={id:'meeting',year:'2026-27',title:'Meeting',start:'2026-11-21T18:00:00Z',end:'2026-11-21T19:00:00Z',food:false};
test('ICS includes escaped string and object locations',()=>{
 for(const location of ['Lab, 100',{name:'Lab, 100'}]) assert.ok(calendarFile({...campaign,location}).includes('LOCATION:Lab\\, 100\r\n'));
});
test('captions retain paragraph breaks while removing empty field lines',()=>{
 const config={timezone:'UTC',captionTemplate:'{title}\n\n{description}\n{food}\n\n\n{hashtags}'};
 assert.equal(captionFor({...campaign,description:'First paragraph.\n\nSecond paragraph.'},config),'Meeting\n\nFirst paragraph.\n\nSecond paragraph.');
 assert.match(captionFor({...campaign,food:true,description:'First\n\nSecond'},config),/First\n\nSecond\nFood provided!/);
});
test('campaign templates use a closed allowlist',()=>{
 for(const template of ['blueprint','editorial','refined-blueprint','editorial-poster','assembly-card']) assert.doesNotThrow(()=>validateCampaign({...campaign,template}));
 for(const template of ['../secret','unknown',null]) assert.throws(()=>validateCampaign({...campaign,template}),/template/);
});
test('issue import skips disabled channels and requires bot opt-in',()=>{
 const config={activeYear:'2026-27',integrations:{groupme:{enabled:true,mode:'bot'}}};
 const now=Date.parse('2026-01-01');
 assert.deepEqual(prepareImportedCampaign({...campaign,campaign:{feed:{enabled:false,daysBefore:7,time:'12:00'},story:{enabled:false,daysBefore:3,time:'12:00'}}},config,now).status,{feed:'skipped',story:'skipped',groupme:'skipped'});
 const opted={...campaign,campaign:{groupme:{enabled:true,announce:true}}};
 assert.equal(prepareImportedCampaign(opted,config,now).status.groupme,'pending');
 assert.equal(prepareImportedCampaign(opted,{...config,integrations:{groupme:{enabled:false,mode:'bot'}}},now).status.groupme,'skipped');
 assert.equal(prepareImportedCampaign({...campaign,campaign:{groupme:{enabled:true}}},config,now).status.groupme,'skipped');
});
test('insights ignores loose files and validates campaign paths before requests',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'insights-'));
 try {
  const base=path.join(root,'data/campaigns');await mkdir(path.join(base,campaign.year),{recursive:true});
  await writeFile(path.join(base,'.DS_Store'),'noise');await writeFile(path.join(base,'loose.json'),'{}');
  const file=path.join(base,campaign.year,`${campaign.id}.json`);
  await writeFile(file,JSON.stringify({...campaign,results:{feed:{mediaId:'one',postedAt:'2026-01-01T00:00:00Z'}}}));
  let calls=0;const options={now:new Date('2026-01-03'),client:{request:async()=>{calls++;return {data:[{name:'reach',values:[{value:3}]}]};}}};
  await insights(root,options);assert.equal(calls,1);assert.equal(JSON.parse(await readFile(file)).results.insights[0].metrics.reach,3);
  await writeFile(file,JSON.stringify({...campaign,id:'wrong'}));await assert.rejects(insights(root,options),/path does not match/);assert.equal(calls,1);
 } finally {await rm(root,{recursive:true,force:true});}
});
