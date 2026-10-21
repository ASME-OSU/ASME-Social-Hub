import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {publicEventURL,renderEventPage} from '../docs/event-page.mjs';
import {writeEventPages} from '../scripts/event-pages.mjs';
import {groupMeAnnouncementDraft} from '../docs/groupme-message.mjs';
const config={chapterName:'ASME',timezone:'America/New_York',siteUrl:'https://example.org/hub'};
const c={id:'meeting',year:'2026-27',title:'Meeting <script>',description:'Details & more',start:'2026-11-20T18:00:00-05:00',end:'2026-11-20T19:00:00-05:00',location:{name:'Scott E100'},advertising:{rsvpUrl:'https://example.org/rsvp'}};
test('member page escapes event content and offers accurate calendar and RSVP actions',()=>{
 const html=renderEventPage(c,config);assert.match(html,/Meeting &lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/20261120T230000Z%2F20261121T000000Z/);assert.match(html,/https:\/\/example.org\/hub\/calendar\/2026-27\/meeting.ics/);assert.match(html,/https:\/\/example.org\/rsvp/);
 const cancelled=renderEventPage({...c,cancelled:true},config);assert.match(cancelled,/has been cancelled/);assert.doesNotMatch(cancelled,/Add to Google Calendar|>RSVP/);
});
test('event links require HTTPS, with loopback allowed only in local preview',()=>{
 assert.equal(publicEventURL(c,{...config,siteUrl:'javascript:alert(1)'}),'');assert.equal(publicEventURL(c,{...config,siteUrl:'http://localhost:4275'}),'');assert.equal(publicEventURL(c,{...config,siteUrl:'http://localhost:4275',previewOnly:true}),'http://localhost:4275/events/2026-27/meeting/');
});
test('one event link is opt-in; legacy GroupMe calendar and flyer copy remain unchanged',()=>{
 const legacy=groupMeAnnouncementDraft(c,config);assert.match(legacy,/Calendar: https:/);assert.match(legacy,/Flyer: https:/);
 const text=groupMeAnnouncementDraft({...c,campaign:{groupme:{includeEventPage:true}}},config);assert.match(text,/Details & add to calendar: https:\/\/example.org\/hub\/events\/2026-27\/meeting\//);assert.doesNotMatch(text,/\nCalendar:|\nFlyer:/);assert.ok(text.startsWith(legacy.split('\nCalendar:')[0]));
});
test('build generates member pages, excludes deleted/demo campaigns, and rejects unsafe paths',async()=>{
 const root=await mkdtemp(join(tmpdir(),'asme-events-'));try{
 await writeEventPages(root,[c,{...c,id:'deleted',deletedAt:'2026-10-20'},{...c,id:'demo',demo:true}],config);
 assert.match(await readFile(join(root,'docs/events/2026-27/meeting/index.html'),'utf8'),/Meeting/);await assert.rejects(access(join(root,'docs/events/2026-27/deleted/index.html')));
 await assert.rejects(writeEventPages(root,[{...c,id:'../../escape'}],config),/Invalid event page path/);
 await writeEventPages(root,[c],{...config,siteUrl:undefined});await assert.rejects(access(join(root,'docs/events')));
 }finally{await rm(root,{recursive:true,force:true});}
});
