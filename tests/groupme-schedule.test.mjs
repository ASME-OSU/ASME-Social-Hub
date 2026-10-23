import test from 'node:test';
import assert from 'node:assert/strict';
import {groupMeDue,validateGroupMeTiming} from '../docs/groupme-schedule.mjs';
import {GROUPME_FORMATS,randomGroupMeFormat,botAnnouncementText} from '../docs/groupme-message.mjs';
import {groupMePreviewContent} from '../docs/groupme-preview.mjs';
import {validateCampaign} from '../scripts/core.mjs';
import {scheduleWarnings} from '../docs/schedule-warning.mjs';
import {reopenMissedChannels} from '../docs/schedule-status.mjs';
const config={activeYear:'2026-27',timezone:'America/New_York',defaultCadence:{feed:{daysBefore:7,time:'12:00'}},integrations:{groupme:{enabled:true,mode:'bot'}}};
const campaign={id:'fixture',year:'2026-27',title:'Design night',start:'2026-11-06T23:00:00Z',end:'2026-11-07T01:00:00Z',food:false,location:{name:'Scott E100'},campaign:{groupme:{enabled:true,announce:true,daysBefore:7,time:'12:00',format:'invite',followUp:{enabled:true,daysBefore:1,time:'12:00',format:'bulletin'}}}};
test('calendar-day scheduling crosses daylight saving time and preserves legacy feed timing',()=>{
 assert.equal(groupMeDue(campaign,config),'2026-10-30T16:00:00.000Z');assert.equal(groupMeDue(campaign,config,'followUp'),'2026-11-05T17:00:00.000Z');
 assert.equal(groupMeDue({...campaign,campaign:{feed:{daysBefore:2,time:'10:00'},groupme:{}}},config),'2026-11-04T15:00:00.000Z');
 validateGroupMeTiming(campaign,config);
 for(const followUp of [{daysBefore:8,time:'12:00'},{daysBefore:7,time:'12:00'},{daysBefore:0,time:'20:00'}])assert.throws(()=>validateGroupMeTiming({...campaign,campaign:{groupme:{...campaign.campaign.groupme,followUp:{...followUp,enabled:true}}}},config),/after the initial/);
});
test('all formats have stable publisher and preview text; shuffle chooses a different format',()=>{
 for(const format of Object.keys(GROUPME_FORMATS)){
  const c=structuredClone(campaign);c.campaign.groupme.format=format;c.campaign.groupme.followUp.format=format;
  assert.equal(groupMePreviewContent(c,config).text,botAnnouncementText(c,config));
  assert.equal(groupMePreviewContent(c,config,{kind:'followUp'}).text,botAnnouncementText(c,config,{kind:'followUp'}));
  assert.match(botAnnouncementText(c,config,{kind:'followUp'}),/Reminder|REMINDER|Coming up soon/);
  assert.notEqual(randomGroupMeFormat(format,()=>0),format);assert.notEqual(randomGroupMeFormat(format,()=>0.99),format);
 }
});
test('initial and follow-up previews preserve their own recorded text',()=>{
 const c={...campaign,results:{groupme:{botSentAt:'2026-10-30T16:00:00Z',botText:'Initial receipt',followUp:{botAttemptedAt:'2026-11-05T17:00:00Z',botText:'Follow-up receipt'}}}};
 assert.equal(groupMePreviewContent(c,config).text,'Initial receipt');assert.equal(groupMePreviewContent(c,config,{kind:'followUp'}).text,'Follow-up receipt');assert.equal(groupMePreviewContent(c,config,{kind:'followUp'}).state,'attempted');
});
test('schema rejects malformed cadences, follow-up flags, and unknown formats',()=>{
 validateCampaign(campaign);
 for(const gm of [{daysBefore:-1,time:'12:00'},{format:'unknown'},{followUp:{enabled:'yes',daysBefore:1,time:'12:00'}},{followUp:{enabled:true,daysBefore:1,time:'25:00'}}])assert.throws(()=>validateCampaign({...campaign,campaign:{groupme:{...campaign.campaign.groupme,...gm}}}),/GroupMe/);
});
test('a follow-up has its own warning and only a future schedule edit reopens a missed reminder',()=>{
 const base=structuredClone(campaign);base.results={groupme:{botSentAt:'2026-10-30T16:00:00Z',followUp:{status:'skipped',skipReason:'announcement-window-missed'}}};base.status={groupme:'done'};
 const warnings=scheduleWarnings(base,config,'2026-11-05T18:00:00Z');assert.equal(warnings.length,1);assert.match(warnings[0].message,/GroupMe follow-up/);
 const draft=structuredClone(base);draft.campaign.groupme.followUp.time='15:00';
 const saved=reopenMissedChannels(draft,base,config,'2026-11-05T18:00:00Z');assert.equal(saved.results.groupme.followUp.status,'pending');assert.equal(saved.status.groupme,'pending');assert.equal(saved.results.groupme.botSentAt,base.results.groupme.botSentAt);
});
