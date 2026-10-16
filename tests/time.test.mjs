import test from 'node:test';
import assert from 'node:assert/strict';
import {fromLocal,localInput,fireTime} from '../docs/time.mjs';
import {fireAt} from '../scripts/core.mjs';
import {calendarFile} from '../scripts/ics.mjs';
const zone='America/New_York';
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
