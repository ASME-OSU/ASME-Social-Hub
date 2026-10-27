import {checkGroupMeSchedule} from './check-groupme-schedule.mjs';
import {checkEventTiming} from './check-event-timing.mjs';
import {checkHomeRail} from './check-home-rail.mjs';
import {checkAcademicYears} from './check-academic-years.mjs';
import {checkCampaignModal} from './check-campaign-modal.mjs';
import {checkCampaignCards} from './check-campaign-cards.mjs';
import {checkUiRefinements} from './check-ui-refinements.mjs';
import {checkStoryEmptyMedia} from './check-story-empty-media.mjs';
import {checkPostingStatus} from './check-posting-status.mjs';
import {checkDispatcherAccess} from './check-dispatcher-access.mjs';
import {checkMemberEvent} from './check-member-event.mjs';
import {checkDashboardDesign} from './check-dashboard-design.mjs';
import {checkPreviewPane} from './check-preview-pane.mjs';
import {checkGroupMePreview} from './check-groupme-preview.mjs';
import {checkCampaignControls} from './check-campaign-controls.mjs';
import {checkEditorLayout} from './check-editor-layout.mjs';
import {checkStoryDesigns} from './check-story-designs.mjs';
import {checkThemes} from './check-themes.mjs';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFile,mkdir,mkdtemp,cp,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {renderFlyers,flyerHtml,fitFlyer,loadFlyerAssets} from './render-flyers.mjs';
const port=4281,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});
let browser;
try {
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true});
 await checkEventTiming(browser,base);
 await checkDispatcherAccess(browser,base);
 await checkPostingStatus(browser,base);
 await checkMemberEvent(browser,base);
 await checkDashboardDesign(browser,base);
 await checkCampaignCards(browser,base);
 await checkCampaignModal(browser,base);
 await checkHomeRail(browser,base);
 await checkAcademicYears(browser,base);
 await checkPreviewPane(browser,base);
 await checkCampaignControls(browser,base);
 await checkGroupMePreview(browser,base);
 await checkGroupMeSchedule(browser,base);
 await checkThemes(browser,base);
 await checkUiRefinements(browser,base);
 await checkEditorLayout(browser,base);
 await checkStoryDesigns(browser,base);
 await checkStoryEmptyMedia(browser,base);
 const page=await browser.newPage({viewport:{width:1440,height:1080},timezoneId:'America/Los_Angeles'});
 await page.clock.install({time:new Date('2026-10-15T16:00:00Z')});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Exercise only labeled examples, even when deployed Pages data includes live campaigns.
 await page.route('**/data/archive-index.json',async route=>{const response=await route.fetch(),archive=await response.json();await route.fulfill({json:{...archive,campaigns:(archive.campaigns||[]).filter(c=>c.demo===true)}});});
 await page.route('**/data/candidates.json',route=>route.fulfill({json:{events:[{uid:'browser-calendar-fixture',title:'Browser calendar suggestion',start:'2026-11-25T23:00:00Z',end:'2026-11-26T00:00:00Z',location:{name:'Fixture room'}}],changes:[]}}));
 let healthRecord={lastSuccessfulLiveRunAt:'2026-10-15T14:00:00Z'};
 await page.route('**/data/dispatcher-health.json',route=>healthRecord?route.fulfill({json:healthRecord}):route.fulfill({status:404,json:{}}));
 await page.goto(base);await page.waitForSelector('#campaign-list .empty');
 assert.match(await page.locator('#dispatcher-last-run').textContent(),/Oct 15/);
 assert.equal(await page.locator('#dispatcher-warning').getAttribute('data-state'),'delayed');assert.match(await page.locator('#dispatcher-warning').textContent(),/scheduled run is delayed/);
 healthRecord={lastSuccessfulLiveRunAt:'2026-10-15T02:00:00Z'};await page.clock.fastForward(60000);await page.waitForFunction(()=>document.querySelector('#dispatcher-warning').dataset.state==='stale');assert.match(await page.locator('#dispatcher-warning').textContent(),/more than 12 hours/);
 healthRecord={lastSuccessfulLiveRunAt:'2026-10-15T16:00:00Z',lastLiveRunAt:'2026-10-15T16:01:00Z',lastLiveRunStatus:'failed'};await page.clock.fastForward(60000);await page.waitForFunction(()=>document.querySelector('#dispatcher-warning').dataset.state==='failed');assert.match(await page.locator('#dispatcher-warning').textContent(),/publishing failure/);
 healthRecord={lastSuccessfulLiveRunAt:'2026-10-15T16:00:00Z'};await page.clock.fastForward(60000);await page.waitForFunction(()=>document.querySelector('#dispatcher-warning').hidden);
 healthRecord=null;await page.clock.fastForward(60000);await page.waitForFunction(()=>document.querySelector('.dispatcher-health').dataset.state==='unknown');assert.equal(await page.locator('#dispatcher-warning').isVisible(),false);assert.match(await page.locator('#dispatcher-health-title').textContent(),/unavailable/);
 assert.equal(await page.locator('.campaign-card').count(),0);
 assert.ok(await page.locator('#suggestions .suggestion').count()>0);
 await page.locator('#new-campaign').click();assert.equal(await page.locator('[name=groupmeAnnounce]').isDisabled(),false);assert.equal(await page.locator('[name=groupmeAnnounce]').isChecked(),false);
 const preview=page.frameLocator('#artwork-preview-frame');
 await page.waitForFunction(()=>document.querySelector('#artwork-preview-frame').style.visibility==='visible');
 assert.equal(await preview.locator('h1').textContent(),'Your event title');assert.match(await preview.locator('.block').textContent(),/Choose a date/);
 await page.locator('[name=title]').fill('Blueprint preview night');await page.locator('[name=location]').fill('Scott E100');await page.locator('[name=start]').fill('2026-11-20T18:30');
 await page.waitForFunction(()=>document.querySelector('#artwork-preview-frame').contentDocument?.querySelector('h1')?.textContent==='Blueprint preview night'&&document.querySelector('#artwork-preview-frame').style.visibility==='visible');
 assert.match(await preview.locator('.block').textContent(),/Fri, Nov 20/);assert.match(await preview.locator('.block').textContent(),/6:30 PM EST/);
 for(const name of ['editorial-poster','assembly-card','refined-blueprint']){
  await page.locator('[name=template]').selectOption(name);
  await page.waitForFunction(name=>{const frame=document.querySelector('#artwork-preview-frame');return frame.style.visibility==='visible'&&frame.srcdoc.includes(name==='assembly-card'?'assembly-art':name==='refined-blueprint'?'technical-art':'width:22px');},name);
  assert.equal(await preview.locator('h1').textContent(),'Blueprint preview night');
 }
 const overrideJpeg=await page.screenshot({type:'jpeg'});
 await page.route('https://preview.example/custom.jpg',route=>route.fulfill({contentType:'image/jpeg',body:overrideJpeg}));
 await page.locator('[name=feedImage]').fill('https://preview.example/custom.jpg');await page.waitForFunction(()=>document.querySelector('#artwork-preview-status').textContent.startsWith('Custom image override'));assert.equal(await preview.locator('img').getAttribute('src'),'https://preview.example/custom.jpg');
 await page.locator('[name=feedImage]').fill('');await page.waitForFunction(()=>document.querySelector('#artwork-preview-frame').contentDocument?.querySelector('h1')?.textContent==='Blueprint preview night'&&document.querySelector('#artwork-preview-frame').style.visibility==='visible');
 await page.locator('#editor [data-preview-format=story]').click();await page.waitForFunction(()=>document.querySelector('#artwork-preview-caption').textContent.includes('1080 × 1920'));assert.match(await preview.locator('body').getAttribute('class'),/^story/);
 await mkdir('test-results',{recursive:true});await page.locator('#artwork-preview').screenshot({path:'test-results/editor-preview-story.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('#artwork-preview').scrollIntoViewIfNeeded();assert.equal(await page.locator('#editor').evaluate(e=>e.scrollWidth<=e.clientWidth),true,'Preview must fit the mobile editor');await page.locator('#artwork-preview').screenshot({path:'test-results/editor-preview-mobile.png'});
 await page.setViewportSize({width:1440,height:1080});await page.locator('#editor [data-preview-format=feed]').click();await page.waitForFunction(()=>document.querySelector('#artwork-preview-caption').textContent.includes('1080 × 1350'));
 await page.locator('[data-close=editor]').first().click();
 await page.route('**/config/chapter.json',async route=>{
  const response=await route.fetch();const config=await response.json();
  config.integrations.groupme.enabled=false;await route.fulfill({json:{...config,showExamples:true}});
 });
 await page.reload();await page.waitForSelector('.campaign-card');
 assert.equal(await page.locator('#campaign-list .campaign-card').count(),3);
 // Browser defaults survive reload, are local only, and never bypass the chapter switch.
 await page.locator('[data-view=settings]').click();
 await page.locator('#channel-defaults-form [name=feed]').uncheck();await page.locator('#channel-defaults-form [name=story]').uncheck();await page.locator('#channel-defaults-form [name=groupme]').check();
 await page.locator('#channel-defaults-form button.primary').click();await page.reload();await page.waitForSelector('.campaign-card');
 await page.locator('#new-campaign').click();assert.equal(await page.locator('[name=feedEnabled]').isChecked(),false);assert.equal(await page.locator('[name=storyEnabled]').isChecked(),false);
 assert.equal(await page.locator('[name=groupmeAnnounce]').isChecked(),false);assert.equal(await page.locator('[name=groupmeAnnounce]').isDisabled(),true);
 await page.locator('[data-close=editor]').first().click();
 await page.locator('#campaign-list [data-detail]').first().click();await page.locator('[data-duplicate]').click();
 assert.equal(await page.locator('[name=feedEnabled]').isChecked(),true);assert.equal(await page.locator('[name=storyEnabled]').isChecked(),true);assert.equal(await page.locator('[name=groupmeAnnounce]').isChecked(),false);
 await page.locator('[data-close=editor]').first().click();
 await page.locator('[data-view=settings]').click();await page.locator('#reset-channel-defaults').click();
 await page.locator('[data-view=dashboard]').click();
 await page.locator('#new-campaign').click();
 assert.equal(await page.getByRole('dialog',{name:'Create a campaign',exact:true}).count(),1);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'editor-title');
 assert.equal(await page.locator('[name=template]').inputValue(),'refined-blueprint');
 await page.locator('[name=template]').selectOption('assembly-card');await page.locator('[name=type]').selectOption('workshop');assert.equal(await page.locator('[name=template]').inputValue(),'assembly-card');
 await page.locator('[name=title]').fill('Browser verification event');
 await page.locator('[name=start]').fill('2026-11-20T18:30');
 await page.locator('[name=end]').fill('2026-11-20T20:00');
 await page.locator('[name=location]').fill('Scott E100');
 await page.locator('[name=food]').uncheck();
 await page.locator('#advertising-details summary').click();
 const extras={foodDetails:'Pizza; vegetarian option available',rsvpUrl:'https://example.org/register',rsvpDeadline:'2026-11-19T17:00',audience:'All majors welcome',cost:'Free',preparation:'Bring a laptop; casual dress',speaker:'Example engineer',benefit:'Practice a design skill',accessibilityContact:'Contact the event organizer'};
 for(const [name,value] of Object.entries(extras))await page.locator(`[name=${name}]`).fill(value);
 await page.locator('[name=rsvpUrl]').fill('https://user:secret@example.org/register');
 await page.locator('#save-button').click();await page.waitForSelector('#form-error:not([hidden])');
 assert.match(await page.locator('#form-error').textContent(),/without a username or password/);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'form-error');
 await page.locator('[name=rsvpUrl]').fill(extras.rsvpUrl);
 const downloadPromise=page.waitForEvent('download');await page.locator('#save-button').click();
 const download=await downloadPromise;const downloaded=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.equal(downloaded.template,'assembly-card');assert.equal(downloaded.campaign.groupme.enabled,false);assert.equal(downloaded.status.groupme,'skipped');
 assert.equal(await page.locator('#groupme-schedule-help').isVisible(),false);
 assert.equal(downloaded.start,'2026-11-20T23:30:00.000Z');assert.equal(downloaded.food,false);assert.equal(downloaded.demo,undefined);assert.equal(downloaded.status.feed,'pending');
 assert.equal(downloaded.advertising.rsvpDeadline,'2026-11-19T22:00:00.000Z');
 for(const [name,value] of Object.entries(extras))if(name!=='rsvpDeadline')assert.equal(downloaded.advertising[name],value);
 assert.equal(await page.evaluate(()=>localStorage.getItem('social-hub-connection')),null);
 await page.locator('[data-view=archive]').click();await page.locator('#year-filter').selectOption('2025-26');assert.equal(await page.locator('#archive-list .archive-row').count(),1);
 await page.locator('#search').fill('no such campaign');assert.equal(await page.locator('#archive-list .archive-row').count(),0);
 assert.match(await page.locator('#archive-count').textContent(),/^0 /);
 assert.equal(await page.locator('[data-view=archive]').getAttribute('aria-current'),'page');
 await page.locator('#clear-filters').click();assert.equal(await page.locator('#search').inputValue(),'');assert.equal(await page.locator('#year-filter').inputValue(),'');assert.equal(await page.locator('#archive-list .archive-row').count(),4);
 await page.locator('[data-view=dashboard]').click();await page.locator('#campaign-list [data-detail]').first().click();await page.locator('[data-duplicate]').click();
 assert.equal(await page.locator('[name=start]').inputValue(),'');assert.equal(await page.locator('[name=end]').inputValue(),'');
 await page.locator('[data-close=editor]').first().click();
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/dashboard-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/dashboard-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mobile page must not overflow');
 assert.deepEqual(errors,[]);
 // Mock GitHub at the network boundary: verify actual save payload without external writes.
 const writes=[],dispatcherRequests=[];let remoteRecord=null,releaseVerification;
 const verificationGate=new Promise(resolve=>{releaseVerification=resolve;});
 await page.route('https://api.github.com/**',async route=>{
  const request=route.request();
  if(request.method()==='POST' && request.url().includes('/actions/workflows/dispatch.yml/dispatches')){dispatcherRequests.push(JSON.parse(request.postData()));return route.fulfill({status:204});}
  if(request.method()==='PUT'){writes.push(JSON.parse(request.postData()));return route.fulfill({json:{commit:{sha:'test-commit'}}});}
  if(remoteRecord && request.url().includes(`campaigns/${remoteRecord.year}/${remoteRecord.id}.json`))return route.fulfill({json:{sha:'latest-file-sha',content:Buffer.from(JSON.stringify(remoteRecord)).toString('base64')}});
  if(request.url().includes('config/chapter.json')){await verificationGate;return route.fulfill({json:{sha:'config-sha',content:Buffer.from('{}').toString('base64')}});}
  return route.fulfill({status:404,json:{message:'Not Found'}});
 });
 await page.setViewportSize({width:1440,height:1080});
 await page.locator('[data-view=settings]').click();await page.locator('[name=token]').fill('mock-token-not-a-credential');await page.locator('#settings-form button.primary').click();
 await page.waitForFunction(()=>document.querySelector('#settings-form').getAttribute('aria-busy')==='true');
 assert.equal(await page.locator('#settings-form button.primary').isDisabled(),true);releaseVerification();
 await page.waitForFunction(()=>document.querySelector('#connection-label').textContent==='Connected');
 assert.equal(await page.locator('#header-connection-text').textContent(),'Connected');assert.match(await page.locator('#settings-connection-state').textContent(),/Token connected/);assert.match(await page.locator('#connection-access-dispatch').textContent(),/Not checked/);
 await page.locator('[data-view=dashboard]').click();
 await page.locator('#dispatcher-controls > summary').click();
 await page.locator('#dispatcher-preview').click();await page.waitForFunction(()=>document.querySelector('#dispatcher-control-status').textContent.includes('Preview dispatcher requested'));
 assert.deepEqual(dispatcherRequests,[{ref:'main',inputs:{dry_run:true}}]);
 page.once('dialog',dialog=>dialog.dismiss());await page.locator('#dispatcher-live').click();assert.equal(dispatcherRequests.length,1);
 page.once('dialog',dialog=>dialog.accept());await page.locator('#dispatcher-live').click();await page.waitForFunction(()=>document.querySelector('#dispatcher-control-status').textContent.includes('Live dispatcher requested'));
 assert.deepEqual(dispatcherRequests[1],{ref:'main',inputs:{dry_run:false}});
 await page.locator('#new-campaign').click();
 for(const [name,value] of Object.entries({title:'API verification event',start:'2026-11-20T18:30',end:'2026-11-20T20:00',location:'Scott E100'}))await page.locator(`[name=${name}]`).fill(value);
 await page.locator('[name=template]').selectOption('editorial-poster');
 await page.locator('#advertising-details summary').click();
 for(const [name,value] of Object.entries(extras))await page.locator(`[name=${name}]`).fill(value);
 await page.locator('#save-button').click();await page.waitForFunction(()=>!document.querySelector('#editor').open);
 assert.equal(writes.length,1);const saved=JSON.parse(Buffer.from(writes[0].content,'base64').toString());
 assert.equal(saved.template,'editorial-poster');assert.equal(saved.title,'API verification event');assert.equal(saved.status.groupme,'skipped');assert.equal(saved.demo,undefined);assert.equal(writes[0].branch,'main');assert.equal(await page.evaluate(()=>localStorage.getItem('social-hub-connection')),null);
 // A scheduler update that arrives while an officer edits must survive that edit.
 remoteRecord=structuredClone(saved);remoteRecord.revision=5;remoteRecord.status.feed='done';remoteRecord.results.feed={mediaId:'mock-published-id',postedAt:'2026-11-13T17:00:00Z'};
 await page.locator(`#campaign-list [data-detail="${saved.id}"]`).click();assert.equal(await page.locator('#detail-content a[href="https://example.org/register"]').count(),1);await page.locator('[data-edit]').click();assert.equal(await page.locator('[name=template]').inputValue(),'editorial-poster');assert.equal(await page.locator('[name=rsvpDeadline]').inputValue(),extras.rsvpDeadline);await page.locator('[name=description]').fill('Updated officer description');await page.locator('#save-button').click();await page.waitForFunction(()=>!document.querySelector('#editor').open);
 assert.equal(writes.length,2);const edited=JSON.parse(Buffer.from(writes[1].content,'base64').toString());assert.equal(edited.status.feed,'done');assert.equal(edited.results.feed.mediaId,'mock-published-id');assert.equal(writes[1].sha,'latest-file-sha');assert.equal(edited.revision,6);
 remoteRecord={...edited,title:'Another officer changed the title'};await page.locator(`#campaign-list [data-detail="${saved.id}"]`).click();await page.locator('[data-edit]').click();await page.locator('#save-button').click();await page.waitForSelector('#form-error:not([hidden])');assert.match(await page.locator('#form-error').textContent(),/edited since/);assert.equal(writes.length,2);await page.locator('[data-close=editor]').first().click();
 // All channels may be off, and PNG uploads retain their format in the real save payload.
 await page.locator('#new-campaign').click();
 for(const [name,value] of Object.entries({title:'PNG upload fixture',start:'2026-11-21T18:30',end:'2026-11-21T20:00',location:'Scott E100'}))await page.locator(`[name=${name}]`).fill(value);
 assert.equal(await page.locator('[name=groupmeAnnounce]').isVisible(),true);
 assert.equal(await page.locator('[name=groupmeAnnounce]').isDisabled(),true);
 await page.locator('[name=feedTime]').fill('');await page.locator('[name=storyDays]').fill('');await page.locator('[name=feedEnabled]').uncheck();await page.locator('[name=storyEnabled]').uncheck();
 await page.locator('[name=flyer]').setInputFiles({name:'fake.png',mimeType:'image/png',buffer:Buffer.from('not a real PNG')});
 await page.locator('#save-button').click();await page.waitForSelector('#form-error:not([hidden])');assert.equal(writes.length,2);
 const pngBytes=await readFile('docs/assets/logos/social-hub-512.png');
 await page.locator('[name=flyer]').setInputFiles({name:'chapter.png',mimeType:'image/png',buffer:pngBytes});
 await page.waitForFunction(()=>{const frame=document.querySelector('#artwork-preview-frame'),img=frame.contentDocument?.querySelector('img.flyer');return frame.style.visibility==='visible'&&img?.src.startsWith('blob:')&&img.complete&&img.naturalWidth>0;});
 assert.equal(await preview.locator('img.uploaded-feed').count(),1);assert.equal(await preview.locator('h1,.logo,.photo-overlay').count(),0);assert.match(await page.locator('#artwork-preview-caption').textContent(),/1080 × 1080/);
 await page.locator('#flyer-preview').waitFor({state:'visible'});assert.match(await page.locator('#flyer-image-list').textContent(),/chapter.png/);assert.equal(writes.length,2);
 await page.locator('#clear-flyer').click();assert.equal(await page.locator('[name=flyer]').inputValue(),'');assert.equal(await page.locator('#flyer-selection').isVisible(),false);
 await page.locator('[name=flyer]').setInputFiles({name:'chapter.png',mimeType:'image/png',buffer:pngBytes});
 await page.locator('#save-button').click();await page.waitForFunction(()=>!document.querySelector('#editor').open);
 assert.equal(writes.length,4);assert.deepEqual(Buffer.from(writes[2].content,'base64'),pngBytes);
 const pngSaved=JSON.parse(Buffer.from(writes[3].content,'base64').toString());
 assert.match(pngSaved.flyerUrl,/assets\/uploads\/.*\.png$/);
 assert.equal(pngSaved.campaign.feed.enabled,false);assert.equal(pngSaved.campaign.story.enabled,false);assert.equal(pngSaved.campaign.groupme.enabled,false);
 assert.equal(pngSaved.status.feed,'skipped');assert.equal(pngSaved.status.story,'skipped');assert.match(pngSaved.campaign.feed.time,/^\d{2}:\d{2}$/);assert.equal(Number.isInteger(pngSaved.campaign.story.daysBefore),true);
 remoteRecord=structuredClone(pngSaved);
 await page.locator(`#campaign-list [data-detail="${pngSaved.id}"]`).click();await page.locator('[data-edit]').click();
 assert.equal(await page.locator('[name=feedEnabled]').isChecked(),false);assert.equal(await page.locator('[name=storyEnabled]').isChecked(),false);
 await page.locator('[name=storyEnabled]').check();await page.locator('#save-button').click();await page.waitForFunction(()=>!document.querySelector('#editor').open);
 assert.equal(writes.length,5);const storyOnly=JSON.parse(Buffer.from(writes[4].content,'base64').toString());
 assert.equal(storyOnly.status.feed,'skipped');assert.equal(storyOnly.status.story,'pending');assert.equal(storyOnly.flyerUrl,pngSaved.flyerUrl);
 // Opt-in bot controls in an isolated browser: no credentials or live writes.
 const botPage=await browser.newPage({viewport:{width:1440,height:1080}});
 await botPage.route('**/data/archive-index.json',route=>route.fulfill({json:{campaigns:[]}}));
 await botPage.route('**/data/candidates.json',route=>route.fulfill({json:{events:[],changes:[]}}));
 await botPage.clock.install({time:new Date('2026-10-15T16:00:00Z')});
 await botPage.route('**/config/chapter.json',async route=>{
  const response=await route.fetch(),config=await response.json();
  config.integrations.groupme={enabled:true,mode:'bot'};
  await route.fulfill({json:config});
 });
 await botPage.goto(base);await botPage.locator('#new-campaign').click();
 assert.equal(await botPage.locator('[name=groupmeAnnounce]').isChecked(),false);
 await botPage.locator('[data-close=editor]').first().click();await botPage.locator('[data-view=settings]').click();await botPage.locator('#channel-defaults-form [name=groupme]').check();await botPage.locator('#channel-defaults-form button.primary').click();await botPage.reload();await botPage.locator('#new-campaign').click();
 assert.equal(await botPage.locator('[name=groupmeAnnounce]').isChecked(),true);
 for(const [name,value] of Object.entries({title:'Bot fixture only',start:'2026-11-20T18:30',end:'2026-11-20T20:00',location:'Scott E100'}))await botPage.locator(`[name=${name}]`).fill(value);
 await botPage.locator('[name=feedEnabled]').uncheck();
 await botPage.locator('[name=groupmeAnnounce]').check();
 assert.match(await botPage.locator('#schedule-preview').textContent(),/GroupMe announcement/);
 const botDownloadPromise=botPage.waitForEvent('download');await botPage.locator('#save-button').click();
 const botDownload=await botDownloadPromise,botSaved=JSON.parse(await readFile(await botDownload.path(),'utf8'));
 assert.equal(botSaved.campaign.feed.enabled,false);
 assert.equal(botSaved.campaign.groupme.enabled,true);assert.equal(botSaved.campaign.groupme.announce,true);
 assert.equal(botSaved.status.groupme,'pending');
 await botPage.close();
 // Expiry warnings use dates, clear healthy states, and never need a live token.
 let warningData={status:'warning',expiresAt:'2026-10-20T16:00:00Z',checkedAt:'2026-10-15T16:00:00Z'};
 await page.route('**/data/token-warning.json',route=>route.fulfill({json:warningData}));
 await page.reload();await page.locator('[data-view=settings]').click();await page.locator('#token-warning').waitFor({state:'visible'});assert.match(await page.locator('#token-warning').textContent(),/in 5 days/);
 for(const status of ['healthy','unknown']){warningData={status,checkedAt:'2026-10-15T16:00:00Z'};await page.reload();await page.locator('[data-view=settings]').click();assert.equal(await page.locator('#token-warning').isVisible(),false);}
 // Verify enriched layouts in both formats without adding browser dependencies to unit tests.
 {const assets=await loadFlyerAssets(process.cwd(),JSON.parse(await readFile('config/chapter.json','utf8')));const campaign=downloaded,config=JSON.parse(await readFile('config/chapter.json','utf8')),template=await readFile('templates/editorial.html','utf8'),blueprint=await readFile('templates/blueprint.html','utf8');const rich={...campaign,title:'Engineering Career Connections',description:'Meet engineering professionals and learn about their work.',food:true,flyerUrl:'',advertising:{foodDetails:'Pizza, with vegetarian options',benefit:'Explore engineering careers and build professional connections.',speaker:'Chapter alumni panel',audience:'All engineering students',cost:'Free',rsvpUrl:'https://example.org/register',rsvpDeadline:'2026-11-03T18:00:00-05:00'}};
 for(const name of ['blueprint','editorial','refined-blueprint','editorial-poster','assembly-card'])for(const format of ['feed','story'])for(const variant of ['rich','long','simple']){
  const source=await readFile(`templates/${name}.html`,'utf8'),height=format==='feed'?1350:1920;
  const fixture=variant==='rich'?rich:variant==='long'?{...rich,title:'Engineering Design Night: Build, Test, and Improve Your Next Mechanical Assembly',location:'Scott Laboratory, E100 — Enter through the main entrance'}:{...rich,food:false,advertising:{},description:''};
  const layoutPage=await browser.newPage({viewport:{width:1080,height}});
  try{await layoutPage.setContent(flyerHtml(source,fixture,config,format,assets));await fitFlyer(layoutPage);assert.equal(await layoutPage.evaluate(()=>document.documentElement.scrollWidth),1080);assert.ok(await layoutPage.evaluate(()=>{const p=document.querySelector('.page'),hero=p.querySelector('.hero'),block=p.querySelector('.block');return hero.getBoundingClientRect().bottom<=block.getBoundingClientRect().top+1 && block.getBoundingClientRect().bottom<=p.getBoundingClientRect().bottom;}));
   if(variant==='simple')assert.equal(await layoutPage.locator('.cell.food').count(),0);
   if(!['blueprint','editorial'].includes(name)&&variant==='rich')await layoutPage.screenshot({path:`test-results/${name}-${format}.jpg`,type:'jpeg',quality:90});
  }catch(error){throw new Error(`${name}/${format}/${variant}: ${error.message}`);}finally{await layoutPage.close();}
 }
 for(const name of ['blueprint','refined-blueprint','editorial-poster','assembly-card'])for(const format of ['feed','story']){
  const pngTemplate=await readFile(`templates/${name}.html`,'utf8');
  const pngPage=await browser.newPage({viewport:{width:1080,height:format==='feed'?1350:1920}});
  try{await pngPage.route('https://fixture.example/flyer.png',route=>route.fulfill({contentType:'image/png',body:pngBytes}));await pngPage.setContent(flyerHtml(pngTemplate,{...rich,flyerUrl:'https://fixture.example/flyer.png'},config,format,assets));await fitFlyer(pngPage);if(format==='feed')assert.ok(await pngPage.locator('img.flyer').evaluate(img=>img.complete&&img.naturalWidth>0));else assert.equal(await pngPage.locator('img.flyer,.photo-overlay').count(),0);const uploaded=pngPage.locator('img.uploaded-feed');
   if(format==='feed'){assert.equal(await uploaded.count(),1);assert.equal(await pngPage.locator('h1,.logo,.photo-overlay').count(),0);assert.deepEqual(await uploaded.evaluate(img=>({width:img.clientWidth,height:img.clientHeight})),{width:1080,height:1080});}
   const jpeg=format==='feed'?await uploaded.screenshot({type:'jpeg'}):await pngPage.screenshot({type:'jpeg'});assert.equal(jpeg.subarray(0,3).toString('hex'),'ffd8ff');
   if(format==='feed'){const dimensions=await pngPage.evaluate(async uri=>{const image=new Image();image.src=uri;await image.decode();return [image.naturalWidth,image.naturalHeight];},'data:image/jpeg;base64,'+jpeg.toString('base64'));assert.deepEqual(dimensions,[1080,1080]);}}finally{await pngPage.close();}
 }

 }
 // Exercise real JPEG rendering in an isolated fixture, never add a live campaign to this repo.
 const root=await mkdtemp(join(tmpdir(),'campaign-render-'));
 try {
  await mkdir(join(root,'docs/assets'),{recursive:true});await cp('docs/assets/fonts',join(root,'docs/assets/fonts'),{recursive:true});await cp('docs/assets/logos',join(root,'docs/assets/logos'),{recursive:true});
  await mkdir(join(root,'config'));await cp('config/chapter.json',join(root,'config/chapter.json'));await cp('templates',join(root,'templates'),{recursive:true});
  await mkdir(join(root,'data/campaigns/2026-27'),{recursive:true});
  const fixture=JSON.parse(await readFile('data/campaigns/2026-27/2026-10-28-industry-night.json','utf8'));delete fixture.demo;
  fixture.advertising={...downloaded.advertising};fixture.food=true;
  await writeFile(join(root,'data/campaigns/2026-27',fixture.id+'.json'),JSON.stringify(fixture));
  await renderFlyers({root});
  for(const format of ['feed','story'])assert.ok((await readFile(join(root,`docs/media/2026-27/${fixture.id}-${format}.jpg`))).length>10000);
  const target=join(root,`docs/media/2026-27/${fixture.id}-feed.jpg`),before=(await stat(target)).mtimeMs;
  await renderFlyers({root});assert.equal((await stat(target)).mtimeMs,before,'Unchanged media should be cached');
  await rm(target);await renderFlyers({root});assert.ok((await readFile(target)).length>10000,'Missing media must regenerate even with a cached marker');
  await cp(target,'test-results/flyer-feed.jpg');
  await cp(join(root,`docs/media/2026-27/${fixture.id}-story.jpg`),'test-results/flyer-story.jpg');
 } finally {await rm(root,{recursive:true,force:true});}
 console.log('Browser checks passed: live flyer preview, style and format switching, custom image overrides, uploaded artwork, mobile preview, export, timezone, food toggle, examples, duplication, archive filters, mobile layout, console, GitHub writes, preserved scheduler state, edit conflicts, and real JPEG rendering.');
} finally {if(browser)await browser.close();server.kill();}
