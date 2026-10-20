import test from 'node:test';
import assert from 'node:assert/strict';
import {botAnnouncementText,groupMeAnnouncementDraft} from '../docs/groupme-message.mjs';
import {botAnnouncementText as publisherText} from '../scripts/groupme.mjs';
import {groupMePreviewContent,groupMeBotAvatar} from '../docs/groupme-preview.mjs';
const config={chapterName:'ASME fixture',timezone:'America/New_York',siteUrl:'https://example.org/hub',integrations:{groupme:{enabled:true,mode:'bot',botName:'Gearley',botAvatar:'assets/logos/groupme-bot.png'}}};
const campaign={id:'fixture',year:'2026-27',title:'Fixture design night',description:'Build and meet engineers.',start:'2026-11-20T23:30:00Z',location:{name:'Fixture room'},food:true,advertising:{foodDetails:'Pizza',rsvpUrl:'https://example.org/rsvp',preparation:'Bring a laptop'},campaign:{groupme:{enabled:true,announce:true}}};
test('GroupMe preview exactly matches the live publisher including date, ads, and links',()=>{
 assert.equal(botAnnouncementText,publisherText);
 const content=groupMePreviewContent(campaign,config);assert.equal(content.text,publisherText(campaign,config));assert.equal(content.text,groupMeAnnouncementDraft(campaign,config));assert.equal(content.name,'Gearley');assert.equal(content.avatar,'assets/logos/groupme-bot.png');assert.equal(content.state,'preview');assert.equal(content.count,content.text.length);
 for(const part of ['6:30 PM (America/New_York)','Food provided! Pizza','Bring / dress: Bring a laptop','RSVP: https://example.org/rsvp','Calendar: https://example.org/hub/calendar/2026-27/fixture.ics','Flyer: https://example.org/hub/media/2026-27/fixture-feed.jpg'])assert.ok(content.text.includes(part),part);
});
test('sent and attempted message snapshots stay unchanged when event content is edited',()=>{
 for(const receipt of [{botSentAt:'2026-11-13T17:00:00Z'},{botAttemptedAt:'2026-11-13T17:00:00Z'}]){
  const changed={...campaign,title:'Edited title',results:{groupme:{...receipt,botText:'Original message\nOriginal link'}}};const content=groupMePreviewContent(changed,config);assert.equal(content.text,'Original message\nOriginal link');assert.equal(content.recorded,true);assert.equal(content.state,receipt.botSentAt?'sent':'attempted');assert.match(content.note,receipt.botSentAt?/recorded when/:/Delivery is unconfirmed/);
  const draft=groupMePreviewContent(changed,config,{useRecorded:false});assert.match(draft.text,/Edited title/);assert.equal(draft.recorded,false);
 }
});
test('oversized drafts remain readable with exact count while publishing validation rejects them',()=>{
 const huge={...campaign,description:'x'.repeat(1100)};const content=groupMePreviewContent(huge,config);assert.match(content.error,/1000 characters/);assert.match(content.text,/x{1100}/);assert.ok(content.count>1000);assert.equal(content.state,'invalid');assert.throws(()=>publisherText(huge,config),/1000 characters/);
});
test('chapter off, campaign opt-out, and cancellation accurately label non-sending previews',()=>{
 for(const [draft,cfg] of [[campaign,{...config,integrations:{groupme:{enabled:false,mode:'bot'}}}],[{...campaign,campaign:{groupme:{enabled:true,announce:false}}},config],[{...campaign,cancelled:true},config],[{...campaign,deletedAt:'2026-10-20'},config]]){
  const content=groupMePreviewContent(draft,cfg);assert.equal(content.enabled,false);assert.equal(content.state,'off');assert.match(content.label,/will not send/);assert.ok(content.text);
 }
});
test('incomplete drafts and other integration modes show actionable preview messages',()=>{
 assert.match(groupMePreviewContent({...campaign,start:''},config).error,/Choose an event date/);
 assert.match(groupMePreviewContent(campaign,{...config,integrations:{groupme:{enabled:true,mode:'event'}}}).error,/bot mode/);
});
test('bot identity defaults are stable and avatar values reject unsafe schemes and credentials',()=>{
 assert.equal(groupMePreviewContent(campaign,{...config,integrations:{groupme:{mode:'bot'}}}).name,'Gearley');
 for(const botAvatar of ['javascript:alert(1)','data:text/html,test','https://user:secret@example.org/p.png','assets/../secret','/tmp/image.png'])assert.equal(groupMeBotAvatar({integrations:{groupme:{botAvatar}}}),'');
 assert.equal(groupMeBotAvatar({integrations:{groupme:{botAvatar:'https://example.org/avatar.png'}}}),'https://example.org/avatar.png');
});

test('pending flyer uploads disclose that final public links are not available yet',()=>{const content=groupMePreviewContent(campaign,config,{pendingFlyerUpload:true});assert.match(content.note,/New flyer links are finalized when uploads are saved/);assert.doesNotMatch(content.note,/exact message/);assert.equal(content.text,publisherText(campaign,config));});

test('examples, archives, and inactive years never claim an announcement is scheduled',()=>{for(const draft of [{...campaign,demo:true},{...campaign,archived:true},{...campaign,year:'2025-26'}]){const content=groupMePreviewContent(draft,{...config,activeYear:'2026-27'});assert.equal(content.enabled,false);assert.equal(content.state,'off');assert.doesNotMatch(content.note,/exact message/);}});
