import test from 'node:test';
import assert from 'node:assert/strict';
import {memberEvent} from '../docs/event.mjs';
import {eventPageUrl,eventIdentity} from '../docs/event-links.mjs';
import {botAnnouncementText} from '../docs/groupme-message.mjs';
const config={siteUrl:'https://example.org/hub/',timezone:'America/New_York',eventTypes:[{id:'workshop',name:'Workshop'}]};
const campaign={id:'workshop',year:'2026-27',type:'workshop',title:'Build night',start:'2026-11-20T23:30:00Z',end:'2026-11-21T01:00:00Z',location:{name:'Scott Lab',address:'201 W 19th Ave'},description:'Meet & build.',food:true,advertising:{foodDetails:'Pizza',rsvpUrl:'https://example.org/register',rsvpDeadline:'2026-11-19T23:00:00Z',preparation:'Bring a laptop',audience:'All majors'}};
test('announcements share one member destination with safe identity and HTTPS site handling',()=>{
 const link=eventPageUrl(campaign,config);assert.equal(link,'https://example.org/hub/event.html?year=2026-27&id=workshop');assert.deepEqual(eventIdentity(new URL(link).search),{year:'2026-27',id:'workshop'});assert.equal(eventIdentity('?year=2026-27&id=build_night').id,'build_night');
 const message=botAnnouncementText(campaign,config);assert.ok(message.includes(`Event details: ${link}`));assert.doesNotMatch(message,/Calendar:|Flyer:/);
 for(const siteUrl of ['javascript:alert(1)','http://example.org','https://secret:pass@example.org'])assert.equal(eventPageUrl(campaign,{...config,siteUrl}),'');
 for(const search of ['','?year=2026-27&id=../config','?year=../../&id=workshop','?year=2026-27&id=%3Cscript%3E'])assert.throws(()=>eventIdentity(search),/invalid/);
});
test('member details use chapter time, preserve logistics, and offer calendar and RSVP actions',()=>{
 const model=memberEvent(campaign,config);assert.equal(model.day,'20');assert.equal(model.weekday,'Friday');assert.equal(model.timeRange,'6:30–8:00 PM');assert.match(model.when,/Friday, November 20, 2026/);assert.equal(model.address,'201 W 19th Ave');assert.equal(model.type,'Workshop');assert.equal(model.calendar,'./calendar/2026-27/workshop.ics');assert.equal(model.timezoneLabel,'Columbus time · EST');const google=new URL(model.googleCalendar);assert.equal(google.searchParams.get('dates'),'20261120T233000Z/20261121T010000Z');assert.equal(google.searchParams.get('text'),campaign.title);assert.equal(model.rsvp,'https://example.org/register');assert.ok(model.advertising.includes('Food provided! Pizza'));assert.ok(model.advertising.includes('Bring / dress: Bring a laptop'));assert.ok(model.advertising.some(x=>x.startsWith('RSVP by:')));
});
test('cancelled events retain readable details with no attendance actions; deleted events are unavailable',()=>{
 const cancelled=memberEvent({...campaign,cancelled:true},config);assert.equal(cancelled.cancelled,true);assert.equal(cancelled.calendar,'');assert.equal(cancelled.googleCalendar,'');assert.equal(cancelled.rsvp,'');assert.equal(cancelled.title,campaign.title);
 assert.throws(()=>memberEvent({...campaign,deletedAt:'2026-10-21'},config),/no longer available/);
});
test('member page handles overnight and all-day events and rejects unsafe media/RSVP links',()=>{
 const overnight=memberEvent({...campaign,end:'2026-11-21T13:00:00Z'},config);assert.match(overnight.when,/Nov 21, 2026/);
 const allDay=memberEvent({...campaign,allDay:true,start:'2026-11-20T00:00:00Z',end:'2026-11-21T00:00:00Z'},config);assert.match(allDay.when,/All day/);assert.equal(allDay.day,'20');assert.equal(allDay.timezoneLabel,'');
 assert.equal(memberEvent({...campaign,images:{feed:'javascript:alert(1)'},advertising:{}},config).flyer,'./media/2026-27/workshop-feed.jpg');
 assert.throws(()=>memberEvent({...campaign,advertising:{rsvpUrl:'javascript:alert(1)'}},config),/HTTPS/);
 assert.throws(()=>memberEvent({...campaign,start:''},config),/date is not available/);
});
