import test from 'node:test';
import assert from 'node:assert/strict';
import {googleCalendarLink} from '../docs/calendar-links.mjs';
import {chapterTimeLabel,timeZoneName} from '../docs/display-time.mjs';
const event={title:'Tour & lunch',description:'Bring a laptop.',start:'2026-10-22T17:30:00Z',end:'2026-10-22T19:00:00Z',location:{name:'Scott Lab'}};
test('Google Calendar carries exact event instants, title, location and chapter timezone',()=>{
 const url=new URL(googleCalendarLink(event));assert.equal(url.origin,'https://calendar.google.com');assert.equal(url.searchParams.get('action'),'TEMPLATE');assert.equal(url.searchParams.get('dates'),'20261022T173000Z/20261022T190000Z');assert.equal(url.searchParams.get('text'),event.title);assert.equal(url.searchParams.get('details'),event.description);assert.equal(url.searchParams.get('location'),'Scott Lab');assert.equal(url.searchParams.get('ctz'),'America/New_York');
});
test('all-day Google links preserve date-only source days and their exclusive end',()=>{
 const url=new URL(googleCalendarLink({...event,allDay:true,start:'2026-10-22T00:00:00Z',end:'2026-10-23T00:00:00Z'}));assert.equal(url.searchParams.get('dates'),'20261022/20261023');
});
test('calendar actions are unavailable for cancelled, deleted or incomplete events',()=>{
 for(const changes of [{cancelled:true},{deletedAt:'2026-10-21'},{end:''},{start:'invalid'},{end:event.start}])assert.equal(googleCalendarLink({...event,...changes}),'');
});
test('display timezone follows daylight saving on the event date rather than a fixed EST label',()=>{
 assert.equal(chapterTimeLabel('America/New_York'),'Columbus time');assert.equal(chapterTimeLabel('America/Los_Angeles'),'Los Angeles time');assert.equal(chapterTimeLabel('UTC'),'UTC');
 assert.equal(timeZoneName('2026-10-22T17:30:00Z'),'EDT');assert.equal(timeZoneName('2026-11-20T23:30:00Z'),'EST');assert.equal(timeZoneName('2026-03-08T06:30:00Z'),'EST');assert.equal(timeZoneName('2026-03-08T07:30:00Z'),'EDT');assert.equal(timeZoneName('invalid'),'');
});
