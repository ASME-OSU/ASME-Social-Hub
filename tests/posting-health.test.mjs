import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {postingHealth} from '../scripts/posting-health.mjs';
import {build} from '../scripts/build.mjs';

const config={chapterName:'Chapter',activeYear:'2026-27',timezone:'America/New_York',icalUrl:'https://example.org/public.ics',defaultCadence:{feed:{daysBefore:7,time:'12:00'},story:{daysBefore:3,time:'12:00'}},integrations:{groupme:{enabled:true,mode:'bot'}}};
const campaign={id:'workshop',year:'2026-27',title:'Workshop',start:'2026-11-08T18:00:00-05:00',end:'2026-11-08T19:00:00-05:00',food:false,revision:3,source:{uid:'occurrence',calendarUid:'series'}};
const now=new Date('2026-10-19T12:00:00Z');
const health=(overrides={})=>postingHealth({config,campaigns:[campaign],now,...overrides});

test('public feed computes actual local-time deadlines and exact dispatcher enabled semantics',()=>{
 const feed=health({campaigns:[{...campaign,campaign:{feed:{enabled:false},groupme:{enabled:true,announce:true}}}]});
 const channels=feed.campaigns[0].channels;
 assert.equal(channels.feed.enabled,false);assert.equal(channels.story.enabled,true);assert.equal(channels.groupme.enabled,true);
 assert.equal(channels.feed.dueAt,'2026-11-01T17:00:00.000Z');assert.equal(channels.groupme.dueAt,channels.feed.dueAt);
 assert.equal(health().campaigns[0].channels.groupme.enabled,false);
 assert.equal(health({campaigns:[{...campaign,campaign:{groupme:{enabled:true}}}]}).campaigns[0].channels.groupme.enabled,false);
 const disabled={...config,integrations:{groupme:{enabled:false,mode:'bot'}}};
 assert.equal(health({config:disabled,campaigns:[{...campaign,campaign:{groupme:{enabled:true,announce:true}}}]}).campaigns[0].channels.groupme.enabled,false);
 const native={...config,integrations:{groupme:{mode:'native'}}};
 const immediate=health({config:native}).campaigns[0].channels.groupme;
 assert.equal(immediate.enabled,true);assert.equal(immediate.immediate,true);assert.equal(immediate.dueAt,null);
 assert.equal(health({config:native,campaigns:[{...campaign,campaign:{groupme:{enabled:false}}}]}).campaigns[0].channels.groupme.enabled,false);
});

test('calendar heartbeat and default candidate deadlines survive empty candidate lists',()=>{
 const candidates={generatedAt:'2026-10-19T10:00:00Z',events:[{...campaign,id:'candidate',allDay:false,description:'private candidate detail'}]};
 const feed=health({candidates});
 assert.equal(feed.schemaVersion,1);assert.equal(feed.generatedAt,now.toISOString());assert.equal(feed.calendar.generatedAt,'2026-10-19T10:00:00.000Z');
 assert.equal(feed.calendar.feedUrl,config.icalUrl);assert.equal(feed.calendar.candidates[0].uid,'occurrence');assert.equal(feed.calendar.candidates[0].source.calendarUid,'series');
 assert.equal(feed.calendar.candidates[0].dueAt.feed,'2026-11-01T17:00:00.000Z');assert.equal('description' in feed.calendar.candidates[0],false);
 assert.deepEqual(health({candidates:{...candidates,events:[]}}).calendar.candidates,[]);
 assert.equal(health().calendar.generatedAt,null);
});

test('DST ambiguous deadlines match fireAt and nonexistent local times become explicit invalid channels',()=>{
 const ambiguous={...campaign,start:'2026-11-01T18:00:00-05:00',campaign:{feed:{daysBefore:0,time:'01:30'}}};
 assert.equal(health({campaigns:[ambiguous]}).campaigns[0].channels.feed.dueAt,'2026-11-01T05:30:00.000Z');
 const nonexistent={...campaign,start:'2027-03-14T18:00:00-04:00',campaign:{feed:{daysBefore:0,time:'02:30'}}};
 const record=health({campaigns:[nonexistent]}).campaigns[0];
 assert.equal(record.channels.feed.dueAt,null);assert.equal(record.channels.feed.scheduleInvalid,true);assert.equal(record.channels.story.scheduleInvalid,false);
 assert.equal(health({config:{...config,timezone:'invalid-zone'}}).campaigns[0].channels.feed.scheduleInvalid,true);
});

test('only allowlisted status, receipts, attempt timestamps and revision cross the public boundary',()=>{
 const secret='PRIVATE_SENTINEL';
 const record={...campaign,notes:secret,log:[secret],token:secret,demo:true,cancelled:true,archived:true,source:{...campaign.source,secret},campaign:{feed:{enabled:false,secret}},status:{feed:'failed'},results:{feed:{mediaId:'media-1',postedAt:'2026-10-19T10:00:00Z',publishAttemptedAt:'2026-10-19T09:59:00Z',error:{hint:secret},caption:secret},groupme:{eventId:'event-1',syncedRevision:2,botSentAt:'2026-10-19T10:01:00Z',createAttemptedAt:'2026-10-19T09:58:00Z',botAttemptedAt:'2026-10-19T10:00:00Z',botText:secret}}};
 const feed=health({campaigns:[record],config:{...config,accessToken:secret},tokenWarning:{status:'warning',warning:true,configured:true,checkedAt:'2026-10-19T10:00:00Z',daysRemaining:2,accessToken:secret,error:secret}});
 assert.equal(JSON.stringify(feed).includes(secret),false);
 assert.equal(feed.campaigns[0].revision,3);assert.equal(feed.campaigns[0].channels.feed.status,'failed');assert.equal(feed.campaigns[0].channels.feed.mediaId,'media-1');assert.equal(feed.campaigns[0].channels.groupme.syncedRevision,2);
 assert.equal(feed.campaigns[0].channels.groupme.botAttemptedAt,'2026-10-19T10:00:00.000Z');assert.equal(feed.tokenWarning.daysRemaining,2);
 assert.equal(feed.campaigns[0].demo,true);assert.equal(feed.campaigns[0].archived,true);assert.equal(feed.campaigns[0].cancelled,true);
});

test('every build reads current campaign receipts even when archive-index is stale',async()=>{
 const root=await mkdtemp(join(tmpdir(),'posting-health-'));
 try {
  await cp(new URL('../docs/',import.meta.url),join(root,'docs'),{recursive:true});
  for(const dir of ['config','data/campaigns/2026-27','templates'])await mkdir(join(root,dir),{recursive:true});
  await writeFile(join(root,'config/chapter.json'),JSON.stringify(config));
  await writeFile(join(root,'data/candidates.json'),JSON.stringify({generatedAt:'2026-10-19T11:00:00Z',events:[]}));
  await writeFile(join(root,'data/archive-index.json'),JSON.stringify([{...campaign,status:{feed:'pending'}}]));
  const file=join(root,'data/campaigns/2026-27/workshop.json');
  await writeFile(file,JSON.stringify({...campaign,status:{feed:'done'},results:{feed:{mediaId:'receipt-1',postedAt:'2026-10-19T11:01:00Z'}}}));
  await build(root);
  let feed=JSON.parse(await readFile(join(root,'docs/data/posting-health.json'),'utf8'));
  assert.equal(feed.campaigns[0].channels.feed.mediaId,'receipt-1');assert.equal(feed.campaigns[0].channels.feed.status,'done');assert.equal(feed.tokenWarning,null);
  await writeFile(file,JSON.stringify({...campaign,status:{feed:'failed'}}));
  await build(root);feed=JSON.parse(await readFile(join(root,'docs/data/posting-health.json'),'utf8'));
  assert.equal(feed.campaigns[0].channels.feed.status,'failed');assert.equal(feed.campaigns[0].channels.feed.mediaId,null);
 } finally {await rm(root,{recursive:true,force:true});}
});
