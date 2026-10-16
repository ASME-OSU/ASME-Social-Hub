import test from 'node:test';
import assert from 'node:assert/strict';
import {fireAt,captionFor,validateCampaign} from '../scripts/core.mjs';
const config={timezone:'America/New_York',defaultCadence:{feed:{daysBefore:7,time:'12:00'},story:{daysBefore:3,time:'12:00'}}};
test('calendar subtraction crosses spring and autumn DST correctly',()=>{
 assert.equal(fireAt({start:'2026-03-10T18:00:00-04:00'},'feed',config).toISOString(),'2026-03-03T17:00:00.000Z');
 assert.equal(fireAt({start:'2026-11-04T18:00:00-05:00'},'feed',config).toISOString(),'2026-10-28T16:00:00.000Z');
});
test('nonexistent local times fail explicitly',()=>assert.throws(()=>fireAt({start:'2026-03-08T18:00:00-04:00',campaign:{feed:{daysBefore:0,time:'02:30'}}},'feed',config),/does not exist/));
test('food line only appears when enabled',()=>{
 const c={title:'Meeting',start:'2026-10-21T18:30:00-04:00',food:false};
 assert.doesNotMatch(captionFor(c,config),/Food/); assert.match(captionFor({...c,food:true},config),/Food provided/);
});
test('rejects unsafe identifiers and offsetless dates',()=>assert.throws(()=>validateCampaign({id:'../bad'}),/id/));
