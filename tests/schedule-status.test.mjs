import test from 'node:test';
import assert from 'node:assert/strict';
import {reopenMissedChannels} from '../docs/schedule-status.mjs';
const config={activeYear:'2026-27',timezone:'America/New_York',integrations:{groupme:{enabled:true,mode:'bot'}}};
const now=new Date('2026-10-19T20:00:00Z');
function fixture(){const base={id:'fixture',year:'2026-27',start:'2026-10-23T22:00:00Z',campaign:{feed:{enabled:true,daysBefore:7,time:'18:45'},story:{enabled:true,daysBefore:7,time:'18:45'},groupme:{enabled:true,announce:true}},status:{feed:'skipped',story:'skipped',groupme:'skipped'},results:{feed:{skipReason:'publishing-window-missed'},story:{skipReason:'publishing-window-missed'},groupme:{skipReason:'announcement-window-missed'}}};const draft=structuredClone(base);draft.campaign.feed.daysBefore=3;draft.campaign.story.daysBefore=3;return {base,draft};}
test('future schedule edits reopen only missed channels, without mutating originals',()=>{const {base,draft}=fixture();const c=reopenMissedChannels(draft,base,config,now);for(const k of ['feed','story','groupme']){assert.equal(c.status[k],'pending');assert.equal(c.results[k].skipReason,undefined);}assert.equal(draft.status.feed,'skipped');});
test('unchanged, past, disabled, cancelled and unrelated skips remain skipped',()=>{for(const change of [d=>d.campaign.feed.daysBefore=7,d=>d.campaign.feed.daysBefore=5,d=>d.campaign.feed.enabled=false,d=>d.cancelled=true,d=>d.archived=true,d=>d.year='2025-26',d=>d.results.feed.skipReason='disabled',d=>delete d.results.feed.skipReason]){const {base,draft}=fixture();change(draft);assert.equal(reopenMissedChannels(draft,base,config,now).status.feed,'skipped');}});
test('all attempts, preparation and receipts prevent reopening',()=>{for(const key of ['publishAttemptedAt','containerId','mediaId','postedAt','botAttemptedAt','botSentAt','createAttemptedAt','eventId','createdAt','deletedAt']){const {base,draft}=fixture();for(const k of ['feed','story','groupme'])draft.results[k][key]='recorded';assert.deepEqual(reopenMissedChannels(draft,base,config,now),draft);}});
test('successful and failed states are preserved and bot opt-out is preserved',()=>{const {base,draft}=fixture();draft.status.feed='done';draft.status.story='failed';draft.campaign.groupme.announce=false;assert.deepEqual(reopenMissedChannels(draft,base,config,now),draft);});

test('legacy Instagram skips require an explicit last missed-window log',()=>{const {base,draft}=fixture();delete base.results.feed.skipReason;delete draft.results.feed.skipReason;base.log=[{channel:'feed',message:'Publishing window missed'}];assert.equal(reopenMissedChannels(draft,base,config,now).status.feed,'pending');base.log.push({channel:'feed',message:'Channel disabled'});assert.equal(reopenMissedChannels(draft,base,config,now).status.feed,'skipped');});

import {scheduleWarning} from '../docs/schedule-status.mjs';
const zone='America/New_York';
const legacyBase=(feedDays,extra={})=>({start:'2026-10-23T22:30:00.000Z',campaign:{feed:{enabled:true,daysBefore:feedDays,time:'14:30'},story:{enabled:true,daysBefore:1,time:'12:00'},groupme:{enabled:true,announce:true}},...extra});
test('schedule warning follows the dispatcher 24 hour rule',()=>{
  const now=new Date('2026-10-19T20:00:00Z');
  assert.equal(scheduleWarning('2026-10-16T18:30:00.000Z',now).level,'skipped');
  assert.equal(scheduleWarning('2026-10-19T12:00:00.000Z',now).level,'late');
  assert.equal(scheduleWarning('2026-10-21T18:30:00.000Z',now),null);
  assert.equal(scheduleWarning(null,now),null);
});
test('editing the schedule reopens a feed and GroupMe announcement skipped for a missed window',()=>{
  const previous={...legacyBase(7),status:{feed:'skipped',story:'pending',groupme:'skipped'},results:{feed:{skipReason:'publishing-window-missed'},story:{},groupme:{skipReason:'announcement-window-missed'}}};
  const next=legacyBase(2);
  const status=reopenMissedChannels({previous,next,status:previous.status,zone,groupmeBot:true,now});
  assert.deepEqual(status,{feed:'pending',story:'pending',groupme:'pending'});
});
test('an unchanged schedule stays skipped, and published or attempted channels are never reopened',()=>{
  const skipped={feed:'skipped',story:'pending',groupme:'skipped'};
  const same={...legacyBase(7),status:skipped,results:{feed:{},groupme:{}}};
  assert.deepEqual(reopenMissedChannels({previous:same,next:legacyBase(7),status:skipped,zone,groupmeBot:true,now}),skipped);
  const posted={...legacyBase(7),status:{feed:'skipped',groupme:'skipped'},results:{feed:{mediaId:'1'},groupme:{botSentAt:'2026-10-16T18:30:00Z'}}};
  assert.deepEqual(reopenMissedChannels({previous:posted,next:legacyBase(2),status:posted.status,zone,groupmeBot:true,now}),posted.status);
  const attempted={...legacyBase(7),status:{feed:'skipped'},results:{feed:{publishAttemptedAt:'2026-10-16T18:30:00Z'}}};
  assert.equal(reopenMissedChannels({previous:attempted,next:legacyBase(2),status:attempted.status,zone,now}).feed,'skipped');
});
test('a disabled channel is not reopened by schedule edits and a new campaign passes through',()=>{
  const previous={...legacyBase(7),campaign:{...legacyBase(7).campaign,feed:{enabled:false,daysBefore:7,time:'14:30'}},status:{feed:'skipped'},results:{feed:{}}};
  assert.equal(reopenMissedChannels({previous,next:legacyBase(2),status:previous.status,zone,now}).feed,'skipped');
  const status={feed:'pending'};assert.equal(reopenMissedChannels({previous:null,next:legacyBase(2),status,zone,now}),status);
});

test('a stale draft cannot hide an existing publishing attempt or disable marker',()=>{
 const {base,draft}=fixture();base.results.feed.publishAttemptedAt='recorded';
 assert.equal(reopenMissedChannels(draft,base,config,now).status.feed,'skipped');
 delete base.results.feed.publishAttemptedAt;base.campaign.feed.enabled=false;
 assert.equal(reopenMissedChannels(draft,base,config,now).status.feed,'skipped');
});
test('deleted campaigns and unrelated legacy skips are never reopened',()=>{
 const {base,draft}=fixture();draft.deletedAt=now.toISOString();
 assert.equal(reopenMissedChannels(draft,base,config,now).status.feed,'skipped');
 const before=legacyBase(7,{status:{feed:'skipped'},results:{feed:{}}});
 assert.equal(reopenMissedChannels({previous:before,next:legacyBase(2),status:before.status,zone,now}).feed,'skipped');
});
test('legacy adapter preserves newest receipts and does not mutate input status',()=>{
 const before=legacyBase(7,{status:{feed:'skipped'},results:{feed:{skipReason:'publishing-window-missed'}}});
 const next=legacyBase(2,{results:{feed:{mediaId:'receipt'}}});
 const status=reopenMissedChannels({previous:before,next,status:before.status,zone,now});
 assert.equal(status.feed,'skipped');assert.equal(before.status.feed,'skipped');
});

test('a completed previous status cannot be reopened by a stale skipped draft',()=>{const {base,draft}=fixture();base.status.feed='done';assert.equal(reopenMissedChannels(draft,base,config,now).status.feed,'skipped');});
