import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarSnapshot,calendarChange} from '../docs/calendar-changes.mjs';
const event={source:{uid:'calendar-event'},title:'Social',start:'2026-10-23T22:30:00Z',end:'2026-10-24T00:30:00Z',location:'Horseshoe Bar',description:'',updated:'2026-10-18T22:24:48Z'};
const campaign={...event,location:{name:'Horseshoe Bar'},description:'Our customized social caption.',source:{kind:'ical',uid:'calendar-event'}};
test('legacy edited social copy is not incorrectly described as a calendar update',()=>{assert.equal(calendarChange(event,campaign),null);});
test('legacy changes still surface scheduling and location differences',()=>{for(const [field,current]of [['title','New title'],['end','2026-10-24T01:30:00Z'],['location','Different room']]){const change=calendarChange({...event,[field]:current},campaign);assert.equal(change.comparison,'campaign-details');assert.deepEqual(change.differences.map(x=>x.field),[field]);assert.equal(change.differences[0].current,field==='end'?new Date(current).toISOString():current);}});
test('a baseline distinguishes intentional social edits from subsequent source edits',()=>{const c={...campaign,source:{...campaign.source,snapshot:calendarSnapshot(event)}};assert.equal(calendarChange(event,c),null);const change=calendarChange({...event,description:'New calendar instructions'},c);assert.equal(change.comparison,'calendar-baseline');assert.equal(change.differences[0].field,'description');assert.equal(change.differences[0].campaign,c.description);});
test('equivalent timestamps and object locations compare consistently',()=>{assert.equal(calendarChange({...event,start:'2026-10-23T18:30:00-04:00',location:{name:'Horseshoe Bar'}},campaign),null);});
test('calendar refresh publishes structured differences and ignores legacy custom descriptions',async()=>{
 const {mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {refreshCandidates}=await import('../scripts/ical.mjs');
 const root=await mkdtemp(join(tmpdir(),'asme-calendar-comparison-'));try{
 await mkdir(join(root,'config'),{recursive:true});await mkdir(join(root,'data/campaigns/2026-27'),{recursive:true});await writeFile(join(root,'config/chapter.json'),JSON.stringify({icalUrl:'https://calendar.example/test.ics'}));
 const uid='fixture::2026-10-23T22:30:00.000Z',record={...campaign,source:{kind:'ical',uid}},file=join(root,'data/campaigns/2026-27/fixture.json');await writeFile(file,JSON.stringify(record));
 const ics=['BEGIN:VCALENDAR','VERSION:2.0','BEGIN:VEVENT','UID:fixture','DTSTART:20261023T223000Z','DTEND:20261024T003000Z','SUMMARY:Social','LOCATION:Horseshoe Bar','END:VEVENT','END:VCALENDAR'].join('\r\n'),fetchImpl=async()=>({ok:true,text:async()=>ics}),options={root,fetchImpl,now:new Date('2026-10-20')};
 assert.deepEqual((await refreshCandidates(options)).changes,[]);
 await writeFile(file,JSON.stringify({...record,location:{name:'Original room'}}));const changes=(await refreshCandidates(options)).changes;assert.equal(changes.length,1);assert.deepEqual(changes[0].differences.map(x=>x.field),['location']);assert.equal(changes[0].differences[0].current,'Horseshoe Bar');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('a source change already applied to the campaign does not remain an alert',()=>{const newer={...event,location:'New room'},c={...campaign,location:{name:'New room'},source:{...campaign.source,snapshot:calendarSnapshot(event)}};assert.equal(calendarChange(newer,c),null);});
