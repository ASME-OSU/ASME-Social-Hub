import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {checkContrast} from './check-themes.mjs';

export async function checkHubAuditFixes(browser,base){
 const config=JSON.parse(await readFile('config/chapter.json','utf8'));config.showExamples=false;
 const make=(id,start,title)=>({id,year:'2026-27',type:config.eventTypes[0].id,title,description:'Meet the chapter.',start,end:new Date(Date.parse(start)+3600000).toISOString(),location:{name:'Fixture room'},food:false,template:'refined-blueprint',campaign:{feed:{enabled:true,daysBefore:7,time:'12:00'},story:{enabled:false,daysBefore:3,time:'12:00'},groupme:{enabled:false,announce:false}},status:{feed:'pending',story:'skipped',groupme:'skipped'},results:{feed:{},story:{},groupme:{}},revision:1});
 const old=make('audit-old','2026-10-01T22:00:00Z','Past campaign requiring review');old.status.feed='failed';old.results.feed.error={hint:'Fixture publishing failure'};
 const upcoming=make('audit-future','2026-12-10T22:00:00Z','Upcoming fixture');
 upcoming.flyerUrls=['https://preview.example/one.png','https://preview.example/two.png'];
 let records=[old,upcoming],archiveReads=0,downloads=0,archiveFail=false;
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},reducedMotion:'reduce'});
 try{
  const page=await context.newPage();await page.clock.install({time:new Date('2026-11-01T16:00:00Z')});
  page.on('download',()=>downloads++);
  const fixtureImage=await readFile('docs/assets/logos/social-hub-512.png');await page.route('https://preview.example/**',route=>route.fulfill({contentType:'image/png',body:fixtureImage}));
  await page.route('**/config/chapter.json',route=>route.fulfill({json:config}));
  await page.route('**/data/archive-index.json',route=>{archiveReads++;return archiveFail?route.fulfill({status:503,json:{}}):route.fulfill({json:{campaigns:records}});});
  await page.route('**/data/candidates.json',route=>route.fulfill({json:{events:[],changes:[]}}));
  await page.route('**/data/dispatcher-health.json',route=>route.fulfill({json:{lastSuccessfulLiveRunAt:'2026-11-01T16:00:00Z'}}));
  await page.route('https://api.github.com/**',route=>{
   assert.equal(route.request().method(),'GET','Audit workflow checks must never write to GitHub');
   const path=route.request().url();
   const data=path.includes('/contents/config/chapter.json')?config:path.includes('/contents/data/archive-index.json')?{campaigns:records}:records.find(c=>path.includes(`/campaigns/${c.year}/${c.id}.json`));
   return data?route.fulfill({json:{sha:'fixture-sha',content:Buffer.from(JSON.stringify(data)).toString('base64')}}):route.fulfill({status:404,json:{message:'Fixture only'}});
  });
  await page.goto(base);await page.locator('#new-campaign:not([disabled])').waitFor();
  assert.equal(await page.locator('#campaign-list [data-detail="audit-old"]').count(),0,'Past campaigns leave home cards');
  assert.match(await page.locator('#attention-title').textContent(),/1 campaign needs review/);
  assert.ok(await page.locator('#campaign-attention').evaluate(e=>e.getBoundingClientRect().top)<await page.locator('#campaign-list').evaluate(e=>e.getBoundingClientRect().top),'Attention precedes phone cards');
  await page.locator('#open-review-queue').click();await page.locator('#review-list [data-detail="audit-old"]').click();assert.match(await page.locator('#detail-title').textContent(),/Past campaign/);await page.locator('[data-close=detail]').first().click();
  for(const theme of ['light','dark']){await page.emulateMedia({colorScheme:theme});await checkContrast(page,['#attention-title','#attention-description','#open-review-queue','#campaign-sync-status','#refresh-campaigns','.review-item p']);}
  await page.locator('#campaign-list [data-detail="audit-future"]').click();await page.locator('[data-edit]').click();
  await page.getByRole('button',{name:'Preview image 2',exact:true}).click();await page.locator('[data-close=editor]').first().click();
  assert.equal(await page.locator('#editor').isVisible(),false,'Choosing a carousel preview is not an edit');
  await page.locator('#campaign-list [data-detail="audit-future"]').click();await page.locator('[data-edit]').click();
  await page.getByRole('button',{name:'Move earlier: image 2',exact:true}).click();await page.locator('[data-close=editor]').first().click();await page.locator('#editor-discard-dialog').waitFor({state:'visible'});await page.locator('[data-discard-edits]').click();
  await page.locator('#new-campaign').click();
  await page.locator('[name=title]').fill('Officer custom title');await page.locator('[name=start]').fill('2026-12-15T18:30');await page.locator('[name=end]').fill('2026-12-15T19:30');
  await page.locator('[name=location]').fill('My custom room');await page.locator('[name=feedTime]').fill('14:15');await page.locator('[name=food]').uncheck();await page.locator('[name=food]').check();
  await page.locator('[name=type]').selectOption(config.eventTypes.at(-1).id);
  assert.equal(await page.locator('[name=location]').inputValue(),'My custom room');assert.equal(await page.locator('[name=feedTime]').inputValue(),'14:15');assert.equal(await page.locator('[name=food]').isChecked(),true);
  await page.locator('[name=description]').fill('x'.repeat(2300));await page.locator('#save-button').click();await page.locator('#form-error:not([hidden])').waitFor();assert.match(await page.locator('#form-error').textContent(),/caption exceeds 2200/);assert.equal(downloads,0);
  assert.match(await page.locator('#caption-budget').textContent(),/over the 2,200 limit/);
  for(const theme of ['light','dark']){await page.emulateMedia({colorScheme:theme});await checkContrast(page,['#caption-budget','#form-error']);}
  await page.keyboard.press('Escape');await page.locator('#editor-discard-dialog').waitFor({state:'visible'});for(const theme of ['light','dark']){await page.emulateMedia({colorScheme:theme});await checkContrast(page,['#editor-discard-title','#editor-discard-description','[data-keep-editing]','[data-discard-edits]']);}await page.locator('[data-keep-editing]').click();assert.equal(await page.locator('[name=title]').inputValue(),'Officer custom title');
  // Automatic refresh must not replace a dirty editor or the data underneath it.
  const priorReads=archiveReads;records=[old,{...upcoming,title:'Fresh published fixture',status:{...upcoming.status,feed:'done'},results:{...upcoming.results,feed:{mediaId:'fixture',postedAt:'2026-11-01T16:01:00Z'}}}];await page.clock.fastForward(60000);assert.equal(archiveReads,priorReads);assert.equal(await page.locator('[name=title]').inputValue(),'Officer custom title');
  await page.locator('[data-close=editor]').first().click();await page.locator('[data-discard-edits]').click();await page.locator('#refresh-campaigns').click();await page.waitForFunction(()=>document.querySelector('#campaign-list').textContent.includes('Fresh published fixture'));assert.match(await page.locator('#campaign-sync-status').textContent(),/Campaigns synced/);
  // Connected refresh reads campaign receipts directly, even if its index remains behind.
  await page.locator('[data-view=settings]').click();await page.locator('[name=token]').fill('mock-token-not-real');await page.locator('#settings-form button.primary').click();await page.waitForFunction(()=>document.querySelector('#header-connection-text').textContent!=='Not connected');await page.locator('[data-view=dashboard]').click();
  records=[{...old,cancelled:true},...records.slice(1)];await page.locator('#refresh-campaigns').click();await page.waitForFunction(()=>document.querySelector('#campaign-attention').hidden);assert.match(await page.locator('#campaign-sync-status').textContent(),/Campaigns synced/);
  // Oversize copy remains valid as an explicit draft with Instagram disabled.
  await page.locator('[data-view=settings]').click();await page.locator('#clear-token').click();await page.locator('[data-view=dashboard]').click();await page.locator('#new-campaign').click();await page.locator('[name=title]').fill('Text-only draft');await page.locator('[name=start]').fill('2026-12-15T18:30');await page.locator('[name=end]').fill('2026-12-15T19:30');await page.locator('[name=location]').fill('Fixture room');await page.locator('[name=description]').fill('x'.repeat(2300));await page.locator('[name=feedEnabled]').uncheck();await page.locator('[name=storyEnabled]').uncheck();await page.locator('[name=groupmeAnnounce]').uncheck();const downloaded=page.waitForEvent('download');await page.locator('#save-button').click();await downloaded;assert.equal(downloads,1);
  archiveFail=true;await page.reload();await page.waitForFunction(()=>document.querySelector('#campaign-sync-status').textContent.includes('could not be loaded'));assert.doesNotMatch(await page.locator('#campaign-sync-status').textContent(),/synced/);archiveFail=false;await page.locator('#refresh-campaigns').click();await page.waitForFunction(()=>document.querySelector('#campaign-sync-status').textContent.includes('Campaigns synced'));

 }finally{await context.close();}
 console.log('Audit workflow checks passed: caption validation, defaults, dirty editor, attention queue, fresh receipts, and light/dark contrast.');
}
