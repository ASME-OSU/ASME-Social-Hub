import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {scheduleWarnings} from '../docs/schedule-warning.mjs';
import {visibleWarnings,dismissMissedWarning} from '../docs/warning-dismissals.mjs';
import {mergeCampaignEdit} from '../docs/campaign-save.mjs';
const config={activeYear:'2026-27',timezone:'America/New_York'};
const now='2026-11-02T16:00:00Z';
const campaign=JSON.parse(await readFile(new URL('./fixtures/missed-campaign.json',import.meta.url)));
test('A past event missed story can be acknowledged without changing publishing history',()=>{
 const warnings=scheduleWarnings(campaign,config,now);
 assert.equal(warnings.length,1);assert.equal(warnings[0].channel,'story');
 assert.match(warnings[0].message,/Dismiss this warning once reviewed/);
 assert.doesNotMatch(warnings[0].message,/Choose a future/);
 const next=dismissMissedWarning(campaign,warnings[0],now);
 assert.deepEqual(visibleWarnings(next,scheduleWarnings(next,config,now)),[]);
 assert.deepEqual(next.status,campaign.status);assert.deepEqual(next.results,campaign.results);
 assert.deepEqual(next.log.slice(0,-1),campaign.log);assert.equal(next.log.at(-1).channel,'story');
 assert.equal(campaign.warningDismissals,undefined);
 const merged=mergeCampaignEdit(campaign,{...campaign,notes:'Reviewed'},next,config,now);
 assert.deepEqual(merged.warningDismissals,next.warningDismissals);
});
test('dismissals do not hide changed schedules, other sends, or failures',()=>{
 const warning=scheduleWarnings(campaign,config,now)[0],next=dismissMissedWarning(campaign,warning,now);
 for(const change of [{channel:'feed'},{messageKind:'followUp'},{due:'2026-10-23T18:30:00Z'},{state:'failed'},{state:'late'}])assert.equal(visibleWarnings(next,[{...warning,...change}]).length,1);
 assert.equal(visibleWarnings({...next,start:'2026-11-03T21:30:00Z'},[warning]).length,1);
 assert.throws(()=>dismissMissedWarning(campaign,{...warning,state:'failed'},now),/Only missed/);
});
