import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {dispatch} from '../scripts/dispatch.mjs';
import {writeJson,validateCampaign} from '../scripts/core.mjs';
import {createLinkedInClient,linkedinReadiness} from '../scripts/linkedin.mjs';
import {linkedinCaption,linkedinCommentary} from '../docs/linkedin.mjs';
import {linkedinTokenWarning} from '../scripts/linkedin-token-warning.mjs';
import {mergeCampaignEdit} from '../docs/campaign-save.mjs';
import {postingHealth} from '../scripts/posting-health.mjs';
import {nextCampaignAction} from '../docs/campaign-overview.mjs';
import {scheduleWarnings} from '../docs/schedule-warning.mjs';
const config={chapterName:'Chapter',activeYear:'2026-27',timezone:'America/New_York',siteUrl:'https://example.org/hub',defaultCadence:{feed:{daysBefore:7,time:'12:00'},story:{daysBefore:3,time:'12:00'}},integrations:{groupme:{enabled:false},linkedin:{enabled:true,organizationUrn:'urn:li:organization:123'}}};
const campaign={id:'meeting',year:'2026-27',title:'Workshop (members)',start:'2026-11-08T18:00:00-05:00',end:'2026-11-08T19:00:00-05:00',food:false,revision:1,campaign:{feed:{enabled:false,daysBefore:7,time:'12:00'},story:{enabled:false,daysBefore:3,time:'12:00'},linkedin:{enabled:true,daysBefore:7,time:'12:00'}},results:{},status:{}};
const env={LINKEDIN_ACCESS_TOKEN:'PRIVATE_TOKEN',LINKEDIN_ORGANIZATION_URN:'urn:li:organization:123',LINKEDIN_TOKEN_EXPIRES_AT:'2099-01-01T00:00:00Z'};
const at='2026-11-01T17:00:00Z';
async function fixture(t,chapter=config,c=campaign){const root=await mkdtemp(path.join(tmpdir(),'linkedin-'));t.after(()=>rm(root,{recursive:true,force:true}));await writeJson(path.join(root,'config/chapter.json'),chapter);const file=path.join(root,'data/campaigns/2026-27/meeting.json');await writeJson(file,c);return {root,file,read:async()=>JSON.parse(await readFile(file))};}
function service(overrides={}){return {linkedin:{checkReady:()=>({owner:env.LINKEDIN_ORGANIZATION_URN}),uploadImage:async()=> 'urn:li:image:image1',waitForImage:async()=>{},publish:async()=>({postId:'urn:li:share:123',permalink:'https://www.linkedin.com/feed/update/urn:li:share:123/'}),...overrides}};}
test('LinkedIn requires chapter and campaign opt-in; old campaigns never acquire a new channel',async t=>{
 for(const [chapter,c] of [[{...config,integrations:{...config.integrations,linkedin:{enabled:false}}},campaign],[config,{...campaign,campaign:{...campaign.campaign,linkedin:undefined}}],[config,{...campaign,campaign:{...campaign.campaign,linkedin:{...campaign.campaign.linkedin,enabled:false}}}],[config,{...campaign,demo:true}],[config,{...campaign,cancelled:true}],[config,{...campaign,archived:true}],[config,{...campaign,deletedAt:at}]]){
  const {root}=await fixture(t,chapter,c);const result=await dispatch({root,now:at,services:new Proxy({},{get(){throw Error('unexpected service');}})});assert.equal(result.some(a=>a.channel==='linkedin'),false);
 }
});
test('dry run preserves files, makes no requests, and uses DST-aware independent schedule',async t=>{
 const {root,file}=await fixture(t),before=await readFile(file,'utf8');const actions=await dispatch({root,now:at,dryRun:true,services:new Proxy({},{get(){throw Error('network');}})});
 assert.deepEqual(actions,[{id:'meeting',channel:'linkedin',action:'publish',fireAt:at.replace('Z','.000Z'),caption:linkedinCaption(campaign,config),images:['https://example.org/hub/media/2026-27/meeting-feed.jpg']}]);assert.equal(await readFile(file,'utf8'),before);
 assert.equal((await dispatch({root,now:'2026-11-01T16:59:59Z',dryRun:true})).length,0);
});
test('checkpoint precedes post creation, receipts suppress repeats and survive concurrent editor saves',async t=>{
 const {root,read}=await fixture(t);let sends=0;
 const services=service({publish:async()=>{assert.ok((await read()).results.linkedin.publishAttemptedAt);sends++;return {postId:'urn:li:share:123'};}});
 await dispatch({root,now:at,services});await dispatch({root,now:at,services});assert.equal(sends,1);const delivered=await read();assert.equal(delivered.status.linkedin,'done');
 const edited=mergeCampaignEdit(campaign,{...campaign,title:'Edited'},delivered,config,new Date(at));assert.equal(edited.results.linkedin.postId,'urn:li:share:123');assert.equal(edited.status.linkedin,'done');
});
test('unknown post outcomes and missing response IDs never publish again or leak provider errors',async t=>{
 for(const publish of [async()=>{throw Error('PRIVATE_TOKEN');},async()=>({})]){
  const {root,file,read}=await fixture(t);let sends=0;const services=service({publish:async()=>{sends++;return publish();}});
  await dispatch({root,now:at,services});await dispatch({root,now:'2026-11-06T18:00:00Z',services});assert.equal(sends,1);assert.equal((await read()).status.linkedin,'failed');assert.ok((await read()).results.linkedin.publishAttemptedAt);assert.doesNotMatch(await readFile(file,'utf8'),/PRIVATE_TOKEN/);
 }
});
test('failed durable checkpoint prevents publication; stale prepared assets refresh after edits',async t=>{
 const {root,file,read}=await fixture(t);let sends=0,uploads=0;
 const services=service({uploadImage:async()=>`urn:li:image:asset${++uploads}`,publish:async()=>{sends++;return {postId:'urn:li:share:123'};}});
 await assert.rejects(dispatch({root,now:at,services,checkpoint:async({campaign:c})=>{if(c.results?.linkedin?.publishAttemptedAt)throw Error('push failed');}}),/checkpoint/);assert.equal(sends,0);
 await dispatch({root,now:at,services});assert.equal(sends,0);
 const c=await read();delete c.results.linkedin.publishAttemptedAt;c.revision++;c.campaign.linkedin.caption='Revised copy';await writeJson(file,c);
 await dispatch({root,now:at,services});assert.equal(uploads,2);assert.equal(sends,1);assert.equal((await read()).results.linkedin.caption,'Revised copy');
});
test('safe rejection retries with prepared assets; processing failures resume; missed windows skip',async t=>{
 const {root,read}=await fixture(t);let uploads=0,sends=0,waits=0;
 const services=service({uploadImage:async()=>{uploads++;return 'urn:li:image:asset';},waitForImage:async()=>{if(!waits++)throw Error('processing');},publish:async()=>{if(!sends++){const e=Error('rejected');e.retrySafe=true;throw e;}return {postId:'urn:li:share:123'};}});
 for(let i=0;i<4;i++)await dispatch({root,now:at,services});assert.equal(uploads,1);assert.equal(sends,2);assert.equal((await read()).status.linkedin,'done');
 const missed=await fixture(t);await dispatch({root:missed.root,now:'2026-11-02T17:00:01Z',services:new Proxy({},{get(){throw Error('must skip');}})});assert.equal((await missed.read()).results.linkedin.skipReason,'publishing-window-missed');
});
test('adapter uploads without leaking credentials to flyer source, polls, and publishes multi-image Posts API payload',async()=>{
 const calls=[];const fetchImpl=async(url,options)=>{
  calls.push({url:String(url),options});
  if(String(url)==='https://example.org/flyer.jpg')return new Response(new Uint8Array([255,216,255,0]),{headers:{'content-type':'image/jpeg'}});
  if(String(url).includes('initializeUpload'))return Response.json({value:{image:'urn:li:image:asset',uploadUrl:'https://www.linkedin.com/dms-uploads/asset'}});
  if(options.method==='PUT')return new Response(null,{status:201});
  if(String(url).includes('/images/'))return Response.json({status:'AVAILABLE'});
  return new Response(null,{status:201,headers:{'x-restli-id':'urn:li:share:123'}});
 };
 const client=createLinkedInClient({env,fetchImpl});const id=await client.uploadImage('https://example.org/flyer.jpg');await client.waitForImage(id);
 const receipt=await client.publish({caption:'Join us (free) #ASME',title:'Workshop',imageUrns:[id,'urn:li:image:asset2']});assert.equal(receipt.postId,'urn:li:share:123');
 assert.equal(calls[0].options.headers,undefined);const request=calls.at(-1);assert.equal(request.options.redirect,'error');assert.equal(request.options.headers['LinkedIn-Version'],'202610');
 const body=JSON.parse(request.options.body);assert.equal(body.author,env.LINKEDIN_ORGANIZATION_URN);assert.equal(body.content.multiImage.images.length,2);assert.equal(body.commentary,linkedinCommentary('Join us (free) #ASME'));
});
test('multiple ordered images resume preparation without reuploading earlier assets',async t=>{
 const c={...campaign,flyerUrl:'https://example.org/cover.png',flyerUrls:['https://example.org/cover.png','https://example.org/second.png']};
 const {root,read}=await fixture(t,config,c);const uploads=[];let waits=0,sends=0;
 const services=service({uploadImage:async url=>{uploads.push(url);return `urn:li:image:asset${uploads.length}`;},waitForImage:async id=>{if(id.endsWith('2')&&!waits++)throw Error('processing');},publish:async({imageUrns})=>{assert.deepEqual(imageUrns,['urn:li:image:asset1','urn:li:image:asset2']);sends++;return {postId:'urn:li:share:123'};}});
 await dispatch({root,now:at,services});assert.equal(sends,0);await dispatch({root,now:at,services});assert.equal(sends,1);assert.deepEqual(uploads,['https://example.org/hub/media/2026-27/meeting-feed.jpg','https://example.org/hub/media/2026-27/meeting-feed-2.jpg']);assert.equal((await read()).results.linkedin.imageUrns.length,2);
});
test('wrong Page credentials fail before upload and missed schedules can be moved into the future',async t=>{
 const {root,file,read}=await fixture(t);let uploads=0;
 await dispatch({root,now:at,services:service({checkReady:()=>({owner:'urn:li:organization:999'}),uploadImage:async()=>{uploads++;}})});assert.equal(uploads,0);assert.equal((await read()).status.linkedin,'failed');
 const missed=await fixture(t);await dispatch({root:missed.root,now:'2026-11-02T17:00:01Z',services:service()});const before=await missed.read(),draft=structuredClone(before);draft.campaign.linkedin.daysBefore=3;
 const moved=mergeCampaignEdit(before,draft,before,config,new Date('2026-11-02T18:00:00Z'));assert.equal(moved.status.linkedin,'pending');assert.equal(moved.results.linkedin.skipReason,undefined);
});
test('adapter rejects expired credentials, foreign upload hosts, and ambiguous POST responses',async()=>{
 assert.throws(()=>linkedinReadiness({...env,LINKEDIN_TOKEN_EXPIRES_AT:'2020-01-01'}),/renew/);
 assert.throws(()=>linkedinReadiness({...env,LINKEDIN_ORGANIZATION_URN:'urn:li:person:123'}),/chapter Page/);
 let calls=0;
 const client=createLinkedInClient({env,fetchImpl:async url=>{calls++;return String(url).includes('example.org')?new Response(new Uint8Array([255,216,255]),{headers:{'content-type':'image/jpeg'}}):Response.json({value:{image:'urn:li:image:asset',uploadUrl:'https://evil.example/upload'}});}});
 await assert.rejects(client.uploadImage('https://example.org/a.jpg'),/invalid/);assert.equal(calls,2);
 for(const status of [408,500]){const c=createLinkedInClient({env,fetchImpl:async()=>new Response(null,{status})});await assert.rejects(c.publish({caption:'hello',title:'Hi',imageUrns:['urn:li:image:asset']}),error=>!error.retrySafe);}
 const c=createLinkedInClient({env,fetchImpl:async()=>new Response(null,{status:201})});await assert.rejects(c.publish({caption:'hello',title:'Hi',imageUrns:['urn:li:image:asset']}),/identifier missing/);
});
test('caption limits, public health redaction, paused warnings and next action agree with opt-in',()=>{
 assert.throws(()=>validateCampaign({...campaign,campaign:{...campaign.campaign,linkedin:{...campaign.campaign.linkedin,caption:'x'.repeat(3001)}}}),/3000/);
 const c={...campaign,campaign:{...campaign.campaign,linkedin:{...campaign.campaign.linkedin,caption:'CUSTOM_COPY'}},results:{linkedin:{postId:'urn:li:share:123',caption:'SECRET_COPY',uploadUrl:'PRIVATE_URL'}}};
 const health=postingHealth({config,campaigns:[c]}).campaigns[0].channels.linkedin;assert.equal(health.enabled,true);assert.equal(health.postId,'urn:li:share:123');assert.doesNotMatch(JSON.stringify(health),/COPY|PRIVATE_URL/);
 assert.equal(nextCampaignAction(campaign,config,new Date('2026-11-01T16:00:00Z')).channel,'linkedin');
 const paused={...config,integrations:{...config.integrations,linkedin:{enabled:false}}};assert.equal(nextCampaignAction(campaign,paused,new Date(at)),null);assert.equal(scheduleWarnings(campaign,paused,new Date('2026-11-02T18:00:00Z')).length,0);
 const warning=linkedinTokenWarning({env,enabled:true,now:new Date('2098-12-25')});assert.equal(warning.status,'warning');assert.doesNotMatch(JSON.stringify(warning),/PRIVATE_TOKEN/);
 assert.equal(linkedinTokenWarning({env:{},enabled:false}).status,'paused');
});
