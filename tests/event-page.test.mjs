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
 const html=renderEventPage(c,config);assert.match(html,/Meeting &lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/20261120T230000Z%2F20261121T000000Z/);assert.match(html,/https:\/\/example.org\/hub\/calendar\/2026-27\/meeting.ics/);assert.match(html,/https:\/\/example.org\/rsvp/);assert.match(html,/Add to Apple Calendar/);assert.match(html,/Columbus time · EST/);assert.doesNotMatch(html,/>America\/New_York</);
 const cancelled=renderEventPage({...c,cancelled:true},config);assert.match(cancelled,/has been cancelled/);assert.doesNotMatch(cancelled,/Add to Google Calendar|Add to Apple Calendar|>RSVP/);
});
test('event links require HTTPS, with loopback allowed only in local preview',()=>{
 assert.equal(publicEventURL(c,{...config,siteUrl:'https://example.org/hub?old=1#top'}),'https://example.org/hub/events/2026-27/meeting/');
 assert.equal(publicEventURL(c,{...config,siteUrl:'javascript:alert(1)'}),'');assert.equal(publicEventURL(c,{...config,siteUrl:'http://localhost:4275'}),'');assert.equal(publicEventURL(c,{...config,siteUrl:'http://localhost:4275',previewOnly:true}),'http://localhost:4275/events/2026-27/meeting/');
});
test('announcements use one rich member link by default and retain legacy opt-in records',()=>{
 const text=groupMeAnnouncementDraft(c,config);assert.match(text,/Event details: https:\/\/example.org\/hub\/events\/2026-27\/meeting\//);assert.doesNotMatch(text,/\nCalendar:|\nFlyer:/);
 const optedIn=groupMeAnnouncementDraft({...c,campaign:{groupme:{includeEventPage:true}}},config);assert.equal(optedIn,text);
 const optedOut=groupMeAnnouncementDraft({...c,campaign:{groupme:{includeEventPage:false}}},config);assert.equal(optedOut,text);
 const local=groupMeAnnouncementDraft(c,{...config,siteUrl:'http://127.0.0.1:4273',previewOnly:true});assert.match(local,/Event details: http:\/\/127.0.0.1:4273\/events\/2026-27\/meeting\//);
});
test('build generates member pages, excludes deleted/demo campaigns, and rejects unsafe paths',async()=>{
 const root=await mkdtemp(join(tmpdir(),'asme-events-'));try{
 await writeEventPages(root,[c,{...c,id:'deleted',deletedAt:'2026-10-20'},{...c,id:'demo',demo:true}],config);
 assert.match(await readFile(join(root,'docs/events/2026-27/meeting/index.html'),'utf8'),/Meeting/);assert.match(await readFile(join(root,'docs/404.html'),'utf8'),/Chapter events and contact/);await assert.rejects(access(join(root,'docs/events/2026-27/deleted/index.html')));
 await assert.rejects(writeEventPages(root,[{...c,id:'../../escape'}],config),/Invalid event page path/);
 await writeEventPages(root,[{...c,deletedAt:'2026-11-01'}],config);await assert.rejects(access(join(root,'docs/events/2026-27/meeting/index.html')));
 await writeEventPages(root,[c],{...config,siteUrl:undefined});await assert.rejects(access(join(root,'docs/events')));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('canonical sharing page pre-renders the full member experience with metadata and resilient artwork',()=>{
 const campaign={...c,title:'Scheduling/BuckeyeLink Tour',location:{name:'Scott Lab',address:'201 W 19th Ave'},food:true,advertising:{...c.advertising,foodDetails:'Pizza',preparation:'Bring a laptop'}};
 const html=renderEventPage(campaign,config);
 assert.match(html,/<meta property="og:title" content="Scheduling\/BuckeyeLink Tour">/);
 assert.match(html,/<meta property="og:url" content="https:\/\/example.org\/hub\/events\/2026-27\/meeting\/">/);
 assert.match(html,/<meta property="og:image" content="https:\/\/example.org\/hub\/media\/2026-27\/meeting-feed.jpg">/);
 assert.match(html,/Scheduling\/<wbr>BuckeyeLink Tour/);
 for(const text of ['201 W 19th Ave','Food provided! Pizza','Bring \/ dress: Bring a laptop','id="event-poster"','data-event-rendered="true"','https://example.org/hub/event.css'])assert.ok(html.includes(text),text);
 const preview=renderEventPage(campaign,{...config,previewOnly:true,siteUrl:'http://127.0.0.1:4273'},{flyerUrl:null});
 assert.match(preview,/LOCAL PREVIEW/);assert.match(preview,/id="event-title"/);assert.match(preview,/id="event-flyer-link"[^>]* hidden/);assert.doesNotMatch(preview,/<meta property="og:image"/);
});
