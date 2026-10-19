import test from 'node:test';
import assert from 'node:assert/strict';
import {flyerSources,validateFlyerSources,mediaName,feedImageUrls,matchingFeedIssue} from '../docs/carousel.mjs';
import {createInstagramClient} from '../scripts/ig.mjs';
const a='https://example.org/a.jpg',b='https://example.org/b.jpg';
const jpeg=(width=1080,height=1350)=>new Uint8Array([255,216,255,192,0,17,8,height>>8,height&255,width>>8,width&255,3,1,17,0,2,17,0,3,17,0,255,217]);
test('ordered images keep the first as cover and produce stable media paths',()=>{
 const c={id:'meeting',year:'2026-27',flyerUrl:b,flyerUrls:[b,a]};validateFlyerSources(c);assert.deepEqual(flyerSources(c),[b,a]);assert.deepEqual(flyerSources({flyerUrl:a}),[a]);assert.equal(mediaName(c,'story',1),'meeting-story.jpg');
 assert.deepEqual(feedImageUrls(c,{siteUrl:'https://example.org/hub/'}),['https://example.org/hub/media/2026-27/meeting-feed.jpg','https://example.org/hub/media/2026-27/meeting-feed-2.jpg']);
 assert.deepEqual(feedImageUrls({...c,images:{feed:a}},{siteUrl:'https://example.org'}),[a]);
 for(const flyerUrls of [[],Array(11).fill(a),['http://example.org/a'],['https://user:secret@example.org/a']])assert.throws(()=>validateFlyerSources({flyerUrls}));
 assert.throws(()=>validateFlyerSources({...c,flyerUrl:a}),/first ordered/);
 assert.equal(matchingFeedIssue([{width:1080,height:1350},{width:800,height:1000}]),'');assert.match(matchingFeedIssue([{width:1080,height:1350},{width:1080,height:1080}]),/matching proportions/);
});
test('Instagram preflights every image then creates ordered children and one carousel parent',async()=>{
 const calls=[];let count=0;const client=createInstagramClient({env:{IG_USER_ID:'1',IG_ACCESS_TOKEN:'secret'},fetchImpl:async(url,options)=>{
  calls.push({url:String(url),method:options?.method,fields:options?.body?Object.fromEntries(options.body):null});
  if(String(url).startsWith('https://example.org/'))return new Response(jpeg(),{headers:{'content-type':'image/jpeg'}});
  if(options.method==='POST')return Response.json({id:++count<3?'child'+count:'parent'});return Response.json({status_code:'FINISHED'});
 }});
 assert.equal(await client.createContainer({channel:'feed',imageUrls:[b,a],caption:'Event'}),'parent');
 assert.deepEqual(calls.slice(0,2).map(x=>x.url),[b,a]);
 const writes=calls.filter(x=>x.method==='POST');assert.deepEqual(writes.map(x=>x.fields),[{image_url:b,is_carousel_item:'true'},{image_url:a,is_carousel_item:'true'},{media_type:'CAROUSEL',children:'child1,child2',caption:'Event'}]);assert.equal(calls.some(x=>x.url.includes('media_publish')),false);
});
test('bad second image prevents every container write; Story uses only its first image',async()=>{
 let writes=0;const client=createInstagramClient({env:{IG_USER_ID:'1',IG_ACCESS_TOKEN:'secret'},fetchImpl:async(url,options)=>{
  if(options?.method==='POST'){writes++;assert.equal(options.body.get('media_type'),'STORIES');assert.equal(options.body.get('image_url'),a);return Response.json({id:'story'});}
  return new Response(jpeg(String(url)===b?1080:1080,String(url)===b?1080:1350),{headers:{'content-type':'image/jpeg'}});
 }});
 await assert.rejects(()=>client.createContainer({channel:'feed',imageUrls:[a,b]}),/matching proportions/);assert.equal(writes,0);
 assert.equal(await client.createContainer({channel:'story',imageUrl:a,imageUrls:[a,b]}),'story');assert.equal(writes,1);
});
