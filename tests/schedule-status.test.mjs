import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduleWarning,reopenMissedChannels} from '../docs/schedule-status.mjs';
const zone='America/New_York';
const base=(feedDays,extra={})=>({start:'2026-10-23T22:30:00.000Z',campaign:{feed:{enabled:true,daysBefore:feedDays,time:'14:30'},story:{enabled:true,daysBefore:1,time:'12:00'},groupme:{enabled:true,announce:true}},...extra});
test('schedule warning follows the dispatcher 24 hour rule',()=>{
  const now=new Date('2026-10-19T20:00:00Z');
  assert.equal(scheduleWarning('2026-10-16T18:30:00.000Z',now).level,'skipped');
  assert.equal(scheduleWarning('2026-10-19T12:00:00.000Z',now).level,'late');
  assert.equal(scheduleWarning('2026-10-21T18:30:00.000Z',now),null);
  assert.equal(scheduleWarning(null,now),null);
});
test('editing the schedule reopens a feed and GroupMe announcement skipped for a missed window',()=>{
  const previous={...base(7),status:{feed:'skipped',story:'pending',groupme:'skipped'},results:{feed:{},story:{},groupme:{skipReason:'announcement-window-missed'}}};
  const next=base(2);
  const status=reopenMissedChannels({previous,next,status:previous.status,zone,groupmeBot:true});
  assert.deepEqual(status,{feed:'pending',story:'pending',groupme:'pending'});
});
test('an unchanged schedule stays skipped, and published or attempted channels are never reopened',()=>{
  const skipped={feed:'skipped',story:'pending',groupme:'skipped'};
  const same={...base(7),status:skipped,results:{feed:{},groupme:{}}};
  assert.deepEqual(reopenMissedChannels({previous:same,next:base(7),status:skipped,zone,groupmeBot:true}),skipped);
  const posted={...base(7),status:{feed:'skipped',groupme:'skipped'},results:{feed:{mediaId:'1'},groupme:{botSentAt:'2026-10-16T18:30:00Z'}}};
  assert.deepEqual(reopenMissedChannels({previous:posted,next:base(2),status:posted.status,zone,groupmeBot:true}),posted.status);
  const attempted={...base(7),status:{feed:'skipped'},results:{feed:{publishAttemptedAt:'2026-10-16T18:30:00Z'}}};
  assert.equal(reopenMissedChannels({previous:attempted,next:base(2),status:attempted.status,zone}).feed,'skipped');
});
test('a disabled channel is not reopened by schedule edits and a new campaign passes through',()=>{
  const previous={...base(7),campaign:{...base(7).campaign,feed:{enabled:false,daysBefore:7,time:'14:30'}},status:{feed:'skipped'},results:{feed:{}}};
  assert.equal(reopenMissedChannels({previous,next:base(2),status:previous.status,zone}).feed,'skipped');
  const status={feed:'pending'};assert.equal(reopenMissedChannels({previous:null,next:base(2),status,zone}),status);
});
