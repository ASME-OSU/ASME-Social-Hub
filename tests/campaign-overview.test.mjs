import test from 'node:test';
import assert from 'node:assert/strict';
import {nextCampaignAction,actionCountdown,orderedOverviewWarnings,overviewSummary,overviewIdleMessage} from '../docs/campaign-overview.mjs';
const config={activeYear:'2026-27',timezone:'America/New_York',defaultCadence:{feed:{daysBefore:7,time:'12:00'},story:{daysBefore:3,time:'12:00'}},integrations:{groupme:{enabled:true,mode:'bot'}}};
const campaign=()=>({year:'2026-27',start:'2026-11-20T23:00:00Z',campaign:{feed:{enabled:true,daysBefore:7,time:'12:00'},story:{enabled:true,daysBefore:3,time:'12:00'},groupme:{enabled:true,announce:true,daysBefore:5,time:'17:00',followUp:{enabled:true,daysBefore:1,time:'17:00'}}},status:{feed:'pending',story:'pending',groupme:'pending'},results:{}});
test('the next action follows chronology and receipts, including the GroupMe follow-up',()=>{
 const c=campaign(),now='2026-11-10T17:00:00Z';assert.equal(nextCampaignAction(c,config,now).channel,'feed');
 c.results.feed={mediaId:'sent'};assert.equal(nextCampaignAction(c,config,now).label,'GroupMe announcement');
 c.results.groupme={botSentAt:'2026-11-15T22:00:00Z'};c.status.groupme='done';assert.equal(nextCampaignAction(c,config,now).channel,'story');
 c.results.story={publishAttemptedAt:'unknown-outcome'};const next=nextCampaignAction(c,config,now);assert.equal(next.label,'GroupMe follow-up');assert.equal(next.due,'2026-11-19T22:00:00.000Z');
 c.results.groupme.followUp={botSentAt:'2026-11-19T22:00:01Z'};assert.equal(nextCampaignAction(c,config,now),null);
});
test('disabled, skipped, uncertain, expired and ineligible messages are never promised as next',()=>{
 const c=campaign(),now='2026-11-16T23:00:01Z';c.campaign.story.enabled=false;
 assert.equal(nextCampaignAction(c,config,now),null,'Past catch-up windows do not appear upcoming');
 for(const override of [{cancelled:true},{deletedAt:now},{archived:true},{demo:true},{year:'2025-26'},{start:'2026-11-10T18:00:00Z'}])assert.equal(nextCampaignAction({...campaign(),...override},config,now),null);
 const future=campaign();future.status.feed='skipped';future.results.groupme={botAttemptedAt:'unresolved'};future.campaign.story.enabled=false;assert.equal(nextCampaignAction(future,config,'2026-11-10T17:00:00Z'),null);
});
test('a late but eligible message shows that it is awaiting dispatch, without claiming delivery',()=>{
 const c=campaign(),now='2026-11-13T18:00:00Z',next=nextCampaignAction(c,config,now);assert.equal(next.late,true);assert.equal(actionCountdown(next.due,config.timezone,now),'Awaiting next dispatcher run');
 assert.equal(actionCountdown('2026-11-14T17:00:00Z',config.timezone,now),'Tomorrow');
 assert.equal(actionCountdown('2026-11-13T20:00:00Z',config.timezone,now),'In 2 hours');
 assert.equal(actionCountdown('2026-11-15T17:00:00Z',config.timezone,now),'In 2 days');
});
test('summary preserves readable copy while warnings prioritize failed sends above missed and late dates',()=>{
 assert.equal(overviewSummary({description:' Build an idea.\n Meet engineers. '}),'Build an idea. Meet engineers.');
 const warnings=[{state:'late',message:'Late'},{state:'missed',message:'Missed'},{state:'failed',message:'Inspect delivery'}];assert.deepEqual(orderedOverviewWarnings(warnings).map(w=>w.state),['failed','missed','late']);assert.equal(warnings[0].state,'late');
 assert.match(overviewIdleMessage({...campaign(),cancelled:true},config),/stopped/);assert.match(overviewIdleMessage({...campaign(),demo:true},config),/Example/);
});
