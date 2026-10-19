import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {writeJson} from '../scripts/core.mjs';
import {dispatch} from '../scripts/dispatch.mjs';
async function fixture(t) {
 const root=await mkdtemp(path.join(os.tmpdir(),'scheduler-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await writeJson(path.join(root,'config/chapter.json'),{chapterName:'Chapter',activeYear:'2026-27',timezone:'America/New_York',defaultCadence:{feed:{daysBefore:7,time:'12:00'},story:{daysBefore:3,time:'12:00'}}});
 const file=path.join(root,'data/campaigns/2026-27/meeting.json');
 await writeJson(file,{id:'meeting',year:'2026-27',title:'Meeting',start:'2026-10-21T18:00:00-04:00',end:'2026-10-21T19:00:00-04:00',food:true,flyers:{feed:'https://example.org/feed.jpg'},campaign:{story:{enabled:false,daysBefore:3,time:'12:00'}},revision:1});
 return {root,file};
}
test('dry run writes nothing and calls no services',async t=>{
 const {root,file}=await fixture(t),before=await readFile(file,'utf8');
 const actions=await dispatch({root,now:'2026-10-14T17:00:00Z',dryRun:true,services:new Proxy({},{get(){throw Error('network');}})});
 assert.equal(actions.length,2);assert.equal(await readFile(file,'utf8'),before);
});
test('stored identifiers suppress repeat publication and sync revisions',async t=>{
 const {root,file}=await fixture(t);let published=0,created=0,updated=0;
 const services={ig:{createContainer:async()=> 'container',waitForContainer:async()=>{},publishContainer:async()=>{published++;return 'media';},getMedia:async()=>({permalink:'https://example.org/post'})},groupme:{createEvent:async()=>{created++;return {eventId:'event'};},updateEvent:async()=>{updated++;}}};
 const run=()=>dispatch({root,now:'2026-10-14T17:00:00Z',services});await run();await run();
 assert.equal(published,1);assert.equal(created,1);
 const c=JSON.parse(await readFile(file));c.revision=2;await writeJson(file,c);await run();assert.equal(updated,1);
});
test('ambiguous publication failure never blindly republishes',async t=>{
 const {root}=await fixture(t);let count=0;
 const services={ig:{createContainer:async()=> 'container',waitForContainer:async()=>{},publishContainer:async()=>{count++;throw Error('token=SECRET');}},groupme:{createEvent:async()=>({eventId:'event'})}};
 await dispatch({root,now:'2026-10-14T17:00:00Z',services});await dispatch({root,now:'2026-10-14T18:00:00Z',services});assert.equal(count,1);
});
test('missed feed windows skip publication and cancellation deletes once',async t=>{
 const {root,file}=await fixture(t);let deleted=0;
 const c=JSON.parse(await readFile(file));c.results={groupme:{eventId:'existing',syncedRevision:1}};await writeJson(file,c);
 const services={ig:new Proxy({},{get(){throw Error('should skip');}}),groupme:{deleteEvent:async()=>{deleted++;}}};
 await dispatch({root,now:'2026-10-16T17:00:00Z',services});
 const skipped=JSON.parse(await readFile(file));assert.equal(skipped.status.feed,'skipped');skipped.cancelled=true;await writeJson(file,skipped);
 await dispatch({root,now:'2026-10-16T18:00:00Z',services});await dispatch({root,now:'2026-10-16T19:00:00Z',services});assert.equal(deleted,1);
});
test('container processing failures retry using persisted container',async t=>{
 const {root}=await fixture(t);let containers=0,waits=0;
 const services={ig:{createContainer:async()=>{containers++;return 'container';},waitForContainer:async()=>{if(!waits++)throw Error('processing');},publishContainer:async()=> 'media',getMedia:async()=>({})},groupme:{createEvent:async()=>({eventId:'event'})}};
 await dispatch({root,now:'2026-10-14T17:00:00Z',services});await dispatch({root,now:'2026-10-14T18:00:00Z',services});assert.equal(containers,1);assert.equal(waits,2);
});
test('demo campaigns never call services or checkpoints',async t=>{
 const {root,file}=await fixture(t);const c=JSON.parse(await readFile(file));c.demo=true;await writeJson(file,c);
 const actions=await dispatch({root,now:'2026-10-14T17:00:00Z',services:new Proxy({},{get(){throw Error('demo network');}}),checkpoint:async()=>{throw Error('demo checkpoint');}});
 assert.deepEqual(actions,[]);
});
test('durable intent checkpoint is awaited before publishing',async t=>{
 const {root,file}=await fixture(t);let calls=0;
 const c=JSON.parse(await readFile(file));delete c.flyers;await writeJson(file,c);
 const configFile=path.join(root,'config/chapter.json');const config=JSON.parse(await readFile(configFile));config.siteUrl='https://example.org/chapter/';await writeJson(configFile,config);
 const services={ig:{createContainer:async({imageUrl})=>{assert.equal(imageUrl,'https://example.org/chapter/media/2026-27/meeting-feed.jpg');return 'container';},waitForContainer:async()=>{},publishContainer:async()=>{calls++;return 'media';}},groupme:{}};
 await assert.rejects(dispatch({root,now:'2026-10-14T17:00:00Z',services,checkpoint:async({campaign})=>{if(campaign.results.feed.publishAttemptedAt) throw Error('push conflict');}}),/checkpoint failed/);
 assert.equal(calls,0);assert.ok(JSON.parse(await readFile(file)).results.feed.publishAttemptedAt);
});
test('campaign filename mismatch fails before external calls',async t=>{
 const {root,file}=await fixture(t);const c=JSON.parse(await readFile(file));c.id='different';await writeJson(file,c);
 await assert.rejects(dispatch({root,now:'2026-10-14T17:00:00Z',dryRun:true}),/path does not match/);
});
test('opt-in fallback bot announcement persists intent and never blindly retries',async t=>{
 const {root,file}=await fixture(t);let sent=0;
 const c=JSON.parse(await readFile(file));c.campaign.feed={enabled:false,daysBefore:7,time:'12:00'};c.campaign.groupme={announce:true};await writeJson(file,c);
 const configFile=path.join(root,'config/chapter.json');const config=JSON.parse(await readFile(configFile));config.siteUrl='https://example.org';await writeJson(configFile,config);
 const services={groupme:{createEvent:async()=>{throw Error('token=SECRET');}},postBotMessage:async(text)=>{assert.match(text,/calendar\/2026-27\/meeting.ics/);assert.ok(JSON.parse(await readFile(file)).results.groupme.botAttemptedAt);sent++;throw Error('token=SECRET');}};
 await dispatch({root,now:'2026-10-14T17:00:00Z',services});await dispatch({root,now:'2026-10-14T18:00:00Z',services});assert.equal(sent,1);assert.doesNotMatch(await readFile(file,'utf8'),/SECRET/);
});
test('disabled channels become skipped and expired GroupMe is skipped',async t=>{
 const {root,file}=await fixture(t);const services=new Proxy({},{get(){throw Error('unexpected network');}});
 await dispatch({root,now:'2026-10-22T17:00:00Z',services});const c=JSON.parse(await readFile(file));
 assert.equal(c.status.story,'skipped');assert.equal(c.results.story.skipReason,'disabled');assert.equal(c.status.groupme,'skipped');assert.equal(c.results.groupme.skipReason,'event-started');
});
test('archived current year campaigns never dispatch',async t=>{
 const {root,file}=await fixture(t);const c=JSON.parse(await readFile(file));c.archived=true;await writeJson(file,c);
 assert.deepEqual(await dispatch({root,now:'2026-10-14T17:00:00Z',services:new Proxy({},{get(){throw Error('unexpected network');}})}),[]);
});
test('real integration factories expose scheduler contract without network',async()=>{
 const {createInstagramClient}=await import('../scripts/ig.mjs');const {createGroupMeClient}=await import('../scripts/groupme.mjs');
 const ig=createInstagramClient({env:{},fetchImpl:()=>{throw Error('network');}});const gm=createGroupMeClient({env:{},fetchImpl:()=>{throw Error('network');}});
 for(const key of ['createContainer','waitForContainer','publishContainer','getMedia','checkPublishingLimit']) assert.equal(typeof ig[key],'function');
 for(const key of ['createEvent','updateEvent','deleteEvent']) assert.equal(typeof gm[key],'function');
});
test('editing an unpublished campaign replaces stale prepared container content',async t=>{
 const {root,file}=await fixture(t);let containers=0;const captions=[];
 const services={ig:{createContainer:async({caption})=>{captions.push(caption);return `container-${++containers}`;},waitForContainer:async()=>{throw Error('processing');}},groupme:{createEvent:async()=>({eventId:'event'}),updateEvent:async()=>{}}};
 await dispatch({root,now:'2026-10-14T17:00:00Z',services});const c=JSON.parse(await readFile(file));c.revision=2;c.title='Revised event title';await writeJson(file,c);
 await dispatch({root,now:'2026-10-14T18:00:00Z',services});assert.equal(containers,2);assert.match(captions[1],/Revised event title/);assert.equal(JSON.parse(await readFile(file)).results.feed.preparedRevision,2);
});

test('chapter GroupMe switch blocks creation, updates, cancellation and bot announcements',async t=>{
 const {root,file}=await fixture(t);
 const configFile=path.join(root,'config/chapter.json');
 const config=JSON.parse(await readFile(configFile));
 config.integrations={groupme:{enabled:false}};await writeJson(configFile,config);
 const campaign=JSON.parse(await readFile(file));
 campaign.campaign.feed={enabled:false,daysBefore:7,time:'12:00'};
 campaign.campaign.groupme={enabled:true,announce:true};
 const services=new Proxy({},{get(){throw Error('Disabled integration must not access any service');}});
 for(const state of [{},{eventId:'existing',syncedRevision:0}]) {
  for(const cancelled of [false,true]) {
   campaign.cancelled=cancelled;campaign.results={groupme:state};
   await writeJson(file,campaign);
   assert.deepEqual(await dispatch({root,now:'2026-10-14T17:00:00Z',services}),[]);
  }
 }
});

async function botFixture(t,{enabled=true,announce=true}={}) {
 const f=await fixture(t),configFile=path.join(f.root,'config/chapter.json'),config=JSON.parse(await readFile(configFile));config.integrations={groupme:{enabled,mode:'bot'}};config.siteUrl='https://example.org/hub';await writeJson(configFile,config);
 const c=JSON.parse(await readFile(f.file));c.campaign.feed={daysBefore:7,time:'12:00',enabled:false};c.campaign.groupme={enabled:true,announce};await writeJson(f.file,c);return f;
}
test('bot-only mode sends once at feed schedule without native API',async t=>{
 const {root,file}=await botFixture(t);let calls=0;
 const services={groupme:new Proxy({},{get(){throw Error('native must not run');}}),postBotMessage:async text=>{calls++;assert.match(text,/Meeting/);assert.match(text,/Food provided/);assert.ok(JSON.parse(await readFile(file)).results.groupme.botAttemptedAt);}};
 await dispatch({root,now:'2026-10-14T15:59:00Z',services});assert.equal(calls,0);
 await dispatch({root,now:'2026-10-14T16:00:00Z',services});await dispatch({root,now:'2026-10-14T17:00:00Z',services});assert.equal(calls,1);assert.equal(JSON.parse(await readFile(file)).status.groupme,'done');
});
test('bot-only mode requires global switch and explicit announcement opt in',async t=>{
 for(const options of [{enabled:false},{announce:false}]) {const {root}=await botFixture(t,options);await dispatch({root,now:'2026-10-14T17:00:00Z',services:new Proxy({},{get(){throw Error('network');}})});}
});
test('feed, story and bot switches independently suppress every unchecked channel',async t=>{
 for(let mask=0;mask<8;mask++) {
  const {root,file}=await botFixture(t),c=JSON.parse(await readFile(file));
  for(const [index,channel] of ['feed','story','groupme'].entries())c.campaign[channel]={...c.campaign[channel],enabled:Boolean(mask&(1<<index)),...(channel==='groupme'?{announce:Boolean(mask&4)}:{daysBefore:7,time:'12:00'})};
  c.flyers.story='https://example.org/story.jpg';await writeJson(file,c);
  const sent=[];const services={ig:{createContainer:async({channel})=>channel,waitForContainer:async()=>{},publishContainer:async channel=>{sent.push(channel);return channel+'-media';},getMedia:async()=>({})},postBotMessage:async()=>{sent.push('groupme');}};
  await dispatch({root,now:'2026-10-14T17:00:00Z',services});await dispatch({root,now:'2026-10-14T18:00:00Z',services});
  assert.deepEqual(sent,['feed','story','groupme'].filter((_,index)=>mask&(1<<index)),`channel mask ${mask}`);
 }
});
test('bot-only dry run previews text without writes or network',async t=>{
 const {root,file}=await botFixture(t),before=await readFile(file,'utf8');const actions=await dispatch({root,now:'2026-10-14T17:00:00Z',dryRun:true,services:new Proxy({},{get(){throw Error('network');}})});assert.match(actions.find(a=>a.action==='announce').text,/Calendar:/);assert.equal(await readFile(file,'utf8'),before);
});
test('bot-only ambiguous failures never retry, and checkpoint failure prevents send',async t=>{
 const {root,file}=await botFixture(t);let calls=0;const services={postBotMessage:async()=>{calls++;throw Error('secret=TOKEN');}};
 await assert.rejects(dispatch({root,now:'2026-10-14T17:00:00Z',services,checkpoint:async({campaign})=>{if(campaign.results?.groupme?.botAttemptedAt)throw Error('push');}}),/checkpoint/);assert.equal(calls,0);
 await dispatch({root,now:'2026-10-14T17:00:00Z',services});assert.equal(calls,0);assert.equal(JSON.parse(await readFile(file)).status.groupme,'failed');
 const c=JSON.parse(await readFile(file));delete c.results.groupme.botAttemptedAt;await writeJson(file,c);await dispatch({root,now:'2026-10-14T17:00:00Z',services});await dispatch({root,now:'2026-10-14T18:00:00Z',services});assert.equal(calls,1);assert.doesNotMatch(await readFile(file,'utf8'),/TOKEN/);
});
test('bot-only late and cancelled campaigns skip without sending',async t=>{
 for(const cancelled of [false,true]) {const {root,file}=await botFixture(t);if(cancelled){const c=JSON.parse(await readFile(file));c.cancelled=true;await writeJson(file,c);}await dispatch({root,now:cancelled?'2026-10-14T17:00:00Z':'2026-10-15T16:00:01Z',services:new Proxy({},{get(){throw Error('network');}})});assert.equal(JSON.parse(await readFile(file)).status.groupme,'skipped');}
});
test('carousel dispatch keeps ordered public URLs and reuses its persisted parent on retry',async t=>{
 const {root,file}=await fixture(t),c=JSON.parse(await readFile(file));delete c.flyers;c.flyerUrl='https://example.org/b.png';c.flyerUrls=[c.flyerUrl,'https://example.org/a.png'];await writeJson(file,c);
 const configFile=path.join(root,'config/chapter.json'),config=JSON.parse(await readFile(configFile));config.siteUrl='https://example.org/hub';await writeJson(configFile,config);
 let creates=0,waits=0,publishes=0;const services={ig:{createContainer:async({imageUrls})=>{creates++;assert.deepEqual(imageUrls,['https://example.org/hub/media/2026-27/meeting-feed.jpg','https://example.org/hub/media/2026-27/meeting-feed-2.jpg']);return 'carousel-parent';},waitForContainer:async id=>{assert.equal(id,'carousel-parent');if(!waits++)throw Error('processing');},publishContainer:async id=>{assert.equal(id,'carousel-parent');publishes++;return 'carousel-post';}},groupme:{createEvent:async()=>({eventId:'event'})}};
 await dispatch({root,now:'2026-10-14T17:00:00Z',services});await dispatch({root,now:'2026-10-14T18:00:00Z',services});await dispatch({root,now:'2026-10-14T19:00:00Z',services});assert.equal(creates,1);assert.equal(publishes,1);assert.equal(JSON.parse(await readFile(file)).results.feed.images.length,2);
});
