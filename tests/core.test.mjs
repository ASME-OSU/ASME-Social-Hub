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
const baseCampaign={id:'event',year:'2026-27',title:'Meeting',description:'Meet fellow engineers.',start:'2026-10-21T18:30:00-04:00',end:'2026-10-21T20:00:00-04:00',food:true};
test('advertising is optional but provided fields reject invalid types, lengths and URLs',()=>{
 assert.doesNotThrow(()=>validateCampaign(baseCampaign));
 for(const advertising of [null,[],{cost:42},{audience:'x'.repeat(201)},{foodDetails:'x'.repeat(161)},{rsvpUrl:'http://example.org'},{rsvpUrl:'https://officer:secret@example.org'},{rsvpDeadline:'2026-10-20T12:00'},{rsvpDeadline:'2026-02-30T12:00:00Z'},{unknown:'typo'}]) assert.throws(()=>validateCampaign({...baseCampaign,advertising}),/Advertising|advertising/);
 assert.doesNotThrow(()=>validateCampaign({...baseCampaign,advertising:{rsvpDeadline:'',rsvpUrl:'https://example.org/rsvp'}}));
});
test('advertising output includes filled details, chapter-local deadline, and preserves legacy food',async()=>{
 const {advertisingLines}=await import('../scripts/core.mjs');
 const advertising={foodDetails:'Pizza; vegetarian options.',rsvpUrl:'https://example.org/rsvp',rsvpDeadline:'2026-10-21T00:00:00Z',audience:'All majors',cost:'Free',preparation:'Closed-toe shoes',speaker:'Dr. Smith',benefit:'Find a project',accessibilityContact:'officers@example.org'};
 const c={...baseCampaign,advertising};const lines=advertisingLines(c,config);
 assert.equal(lines.length,9);assert.match(lines[0],/Food provided! Pizza/);assert.match(lines[2],/Tuesday, October 20, 2026 at 8:00 PM/);
 const caption=captionFor(c,{...config,hashtags:['ASME']});for(const line of lines)assert.ok(caption.includes(line));assert.ok(caption.endsWith('#ASME'));
 assert.deepEqual(advertisingLines({...c,food:false},config),lines.slice(1));assert.equal(advertisingLines(baseCampaign,config)[0],'Food provided!');
});
test('custom captions include advertising once, preserve literal braces, and enforce Instagram length',()=>{
 const c={...baseCampaign,advertising:{benefit:'Learn about {title}',foodDetails:'Pizza'}};
 const caption=captionFor(c,{...config,captionTemplate:'{title}\n{advertising}\n{food}'});assert.equal(caption.match(/Why attend:/g).length,1);assert.match(caption,/Learn about \{title\}/);
 const custom=captionFor(c,{...config,captionTemplate:'{title}\n{hashtags}'});assert.match(custom,/Food provided! Pizza/);assert.match(custom,/Learn about \{title\}/);
 assert.throws(()=>captionFor({...baseCampaign,description:'x'.repeat(2200)},config),/2200 characters/);
});
