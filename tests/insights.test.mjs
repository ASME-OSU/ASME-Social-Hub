import test from 'node:test';
import assert from 'node:assert/strict';
import {collectInsights} from '../scripts/insights.mjs';
const postedAt='2026-10-21T14:59:17.343Z';
const fixture=()=>({results:{feed:{mediaId:'fixture-feed',postedAt},insights:[]},log:[]});
test('feed snapshot eligibility starts exactly 24 hours after posting, not at the next calendar day',async()=>{
 const campaign=fixture(),calls=[],client={request:async(...args)=>{calls.push(args);return {data:[{name:'reach',values:[{value:0}]},{name:'likes',values:[{value:0}]}]};}};
 for(const now of ['2026-10-22T14:03:35.479Z','2026-10-22T14:59:17.342Z'])await collectInsights(campaign,{client,now:new Date(now)});
 assert.equal(calls.length,0,'The observed morning Insights run preceded the first eligible snapshot');assert.deepEqual(campaign.results.insights,[]);assert.deepEqual(campaign.log,[]);
 await collectInsights(campaign,{client,now:new Date('2026-10-22T14:59:17.343Z')});assert.equal(calls.length,1);assert.deepEqual(campaign.results.insights,[{channel:'feed',day:1,mediaId:'fixture-feed',recordedAt:'2026-10-22T14:59:17.343Z',metrics:{reach:0,likes:0}}]);
});
test('a delayed workflow records one actual day-1 observation and preserves it until day seven',async()=>{
 const campaign=fixture();let calls=0;const client={request:async()=>{calls++;return {data:[{name:'reach',total_value:{value:12}},{name:'likes',values:[{value:3}]}]};}};
 const delayed='2026-10-22T18:30:00.000Z';await collectInsights(campaign,{client,now:new Date(delayed)});await collectInsights(campaign,{client,now:new Date('2026-10-23T18:30:00Z')});assert.equal(calls,1);assert.equal(campaign.results.insights[0].recordedAt,delayed);
 await collectInsights(campaign,{client,now:new Date('2026-10-28T14:59:17.343Z')});assert.equal(calls,2);assert.deepEqual(campaign.results.insights.map(s=>s.day),[1,7]);assert.equal(campaign.results.insights[0].recordedAt,delayed);
});
test('an unavailable eligible snapshot stays missing and is retried without inventing metrics or leaking errors',async()=>{
 const campaign=fixture();let fail=true,calls=0;const client={request:async()=>{calls++;if(fail)throw Error('Synthetic error containing a fake token that must not persist');return {data:[{name:'likes',values:[{value:4}]}]};}};
 await collectInsights(campaign,{client,now:new Date('2026-10-22T18:30:00Z')});assert.deepEqual(campaign.results.insights,[]);assert.equal(campaign.log.length,1);assert.doesNotMatch(JSON.stringify(campaign),/fake token/);
 fail=false;await collectInsights(campaign,{client,now:new Date('2026-10-22T19:30:00Z')});assert.equal(calls,2);assert.deepEqual(campaign.results.insights[0].metrics,{likes:4});assert.equal(campaign.results.insights[0].metrics.reach,undefined,'Missing reach never becomes a fabricated zero');
});
test('a first run after seven days does not fabricate an earlier day-1 observation',async()=>{
 const campaign=fixture();await collectInsights(campaign,{now:new Date('2026-10-29T14:59:17.343Z'),client:{request:async()=>({data:[{name:'reach',values:[{value:12}]}]})}});assert.deepEqual(campaign.results.insights.map(s=>s.day),[7]);
});
