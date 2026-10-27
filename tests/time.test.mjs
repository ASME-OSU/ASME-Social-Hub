import test from 'node:test';
import assert from 'node:assert/strict';
import {fromLocal,localInput,fireTime} from '../docs/time.mjs';
import {fireAt} from '../scripts/core.mjs';
import {calendarFile} from '../scripts/ics.mjs';
import {eventTiming} from '../docs/event-timing.mjs';
const zone='America/New_York';
test('event end must be strictly later, including overnight and DST events',()=>{
 for(const end of ['2026-10-28T18:29','2026-10-28T18:30','2026-10-27T20:00'])assert.throws(()=>eventTiming('2026-10-28T18:30',end,zone),/End time must be after/);
 assert.equal(eventTiming('2026-10-28T23:30','2026-10-29T00:30',zone).end,'2026-10-29T04:30:00.000Z');
 const spring=eventTiming('2026-03-08T01:30','2026-03-08T03:30',zone);
 assert.equal(Date.parse(spring.end)-Date.parse(spring.start),3600000);
 assert.throws(()=>eventTiming('2026-11-01T00:30','2026-11-01T01:30',zone),/occurs twice/);
});
test('invalid dates produce a useful error before timezone conversion',()=>{
 for(const value of ['2026-02-30T12:00','2026-13-01T12:00','2026-10-28T24:00'])assert.throws(()=>fromLocal(value,zone),/valid date and time/);
});
test('browser inputs use chapter timezone and reject DST ambiguity',()=>{
  assert.equal(fromLocal('2026-10-28T18:30',zone),'2026-10-28T22:30:00.000Z');
  assert.equal(fromLocal('2026-11-04T18:30',zone),'2026-11-04T23:30:00.000Z');
  assert.equal(localInput('2026-11-04T23:30:00Z',zone),'2026-11-04T18:30');
  assert.throws(()=>fromLocal('2026-03-08T02:30',zone),/does not exist/);
  assert.throws(()=>fromLocal('2026-11-01T01:30',zone),/occurs twice/);
});
test('browser schedule preview agrees with dispatcher across DST',()=>{
 const c={start:'2026-11-04T18:00:00-05:00',campaign:{feed:{daysBefore:7,time:'12:00',enabled:true}}};
 assert.equal(fireTime(c,'feed',zone),fireAt(c,'feed',{timezone:zone,defaultCadence:{feed:c.campaign.feed}}).toISOString());
});
test('calendar files escape content, fold unicode and preserve cancellation revision',()=>{
 const output=calendarFile({id:'test',title:'Test, event; '+ '🔧'.repeat(30),description:'Line 1\nLine 2',start:'2026-10-28T18:00:00-04:00',end:'2026-10-28T19:00:00-04:00',location:{name:'Scott, E100'},revision:2,cancelled:true},new Date('2026-10-15T12:00:00Z'));
 assert.match(output,/DTSTART:20261028T220000Z/);assert.match(output,/SUMMARY:Test\\, event\\;/);assert.match(output,/STATUS:CANCELLED/);assert.match(output,/SEQUENCE:2/);assert.ok(output.split('\r\n').every(l=>Buffer.byteLength(l)<=75));
});
