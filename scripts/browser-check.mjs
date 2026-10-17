import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFile,mkdir,mkdtemp,cp,writeFile,rm} from 'node:fs/promises';
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
 const page=await browser.newPage({viewport:{width:1440,height:1080},timezoneId:'America/Los_Angeles'});
 await page.clock.install({time:new Date('2026-10-15T16:00:00Z')});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.waitForSelector('#campaign-list .empty');
 assert.equal(await page.locator('.campaign-card').count(),0);
 assert.ok(await page.locator('#suggestions .suggestion').count()>0);
 await page.route('**/config/chapter.json',async route=>{
  const response=await route.fetch();const config=await response.json();
  await route.fulfill({json:{...config,showExamples:true}});
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
 assert.equal(downloaded.campaign.groupme.enabled,false);assert.equal(downloaded.status.groupme,'skipped');
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
 const writes=[];let remoteRecord=null,releaseVerification;
 const verificationGate=new Promise(resolve=>{releaseVerification=resolve;});
 await page.route('https://api.github.com/**',async route=>{
  const request=route.request();
  if(request.method()==='PUT'){writes.push(JSON.parse(request.postData()));return route.fulfill({json:{commit:{sha:'test-commit'}}});}
  if(remoteRecord && request.url().includes(`campaigns/${remoteRecord.year}/${remoteRecord.id}.json`))return route.fulfill({json:{sha:'latest-file-sha',content:Buffer.from(JSON.stringify(remoteRecord)).toString('base64')}});
  if(request.url().includes('config/chapter.json')){await verificationGate;return route.fulfill({json:{sha:'config-sha',content:Buffer.from('{}').toString('base64')}});}
  return route.fulfill({status:404,json:{message:'Not Found'}});
 });
 await page.setViewportSize({width:1440,height:1080});
 await page.locator('[data-view=settings]').click();await page.locator('[name=token]').fill('mock-token-not-a-credential');await page.locator('#settings-form button.primary').click();
 await page.waitForFunction(()=>document.querySelector('#settings-form').getAttribute('aria-busy')==='true');
 assert.equal(await page.locator('#settings-form button.primary').isDisabled(),true);releaseVerification();
 await page.waitForFunction(()=>document.querySelector('#connection-label').textContent.startsWith('Connected to '));
 await page.locator('[data-view=dashboard]').click();await page.locator('#new-campaign').click();
 for(const [name,value] of Object.entries({title:'API verification event',start:'2026-11-20T18:30',end:'2026-11-20T20:00',location:'Scott E100'}))await page.locator(`[name=${name}]`).fill(value);
 await page.locator('#advertising-details summary').click();
 for(const [name,value] of Object.entries(extras))await page.locator(`[name=${name}]`).fill(value);
 await page.locator('#save-button').click();await page.waitForFunction(()=>!document.querySelector('#editor').open);
 assert.equal(writes.length,1);const saved=JSON.parse(Buffer.from(writes[0].content,'base64').toString());
 assert.equal(saved.title,'API verification event');assert.equal(saved.status.groupme,'skipped');assert.equal(saved.demo,undefined);assert.equal(writes[0].branch,'main');assert.equal(await page.evaluate(()=>localStorage.getItem('social-hub-connection')),null);
 // A scheduler update that arrives while an officer edits must survive that edit.
 remoteRecord=structuredClone(saved);remoteRecord.status.feed='done';remoteRecord.results.feed={mediaId:'mock-published-id',postedAt:'2026-11-13T17:00:00Z'};
 await page.locator(`#campaign-list [data-detail="${saved.id}"]`).click();assert.equal(await page.locator('#detail-content a[href="https://example.org/register"]').count(),1);await page.locator('[data-edit]').click();assert.equal(await page.locator('[name=rsvpDeadline]').inputValue(),extras.rsvpDeadline);await page.locator('[name=description]').fill('Updated officer description');await page.locator('#save-button').click();await page.waitForFunction(()=>!document.querySelector('#editor').open);
 assert.equal(writes.length,2);const edited=JSON.parse(Buffer.from(writes[1].content,'base64').toString());assert.equal(edited.status.feed,'done');assert.equal(edited.results.feed.mediaId,'mock-published-id');assert.equal(writes[1].sha,'latest-file-sha');assert.equal(edited.revision,2);
 remoteRecord={...edited,revision:3};await page.locator(`#campaign-list [data-detail="${saved.id}"]`).click();await page.locator('[data-edit]').click();await page.locator('#save-button').click();await page.waitForSelector('#form-error:not([hidden])');assert.match(await page.locator('#form-error').textContent(),/edited since/);assert.equal(writes.length,2);await page.locator('[data-close=editor]').first().click();
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
 await page.locator('#flyer-preview').waitFor({state:'visible'});assert.match(await page.locator('#flyer-feedback').textContent(),/chapter.png/);assert.equal(writes.length,2);
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
 // Verify enriched layouts in both formats without adding browser dependencies to unit tests.
 {const assets=await loadFlyerAssets(process.cwd(),{brand:{}});const campaign=downloaded,config=JSON.parse(await readFile('config/chapter.json','utf8')),template=await readFile('templates/editorial.html','utf8'),blueprint=await readFile('templates/blueprint.html','utf8');const rich={...campaign,title:'Engineering Career Connections',description:'Meet engineering professionals and learn about their work.',food:true,flyerUrl:'',advertising:{foodDetails:'Pizza, with vegetarian options',benefit:'Explore engineering careers and build professional connections.',speaker:'Chapter alumni panel',audience:'All engineering students',cost:'Free',rsvpUrl:'https://example.org/register',rsvpDeadline:'2026-11-03T18:00:00-05:00'}};
 for(const source of [template,blueprint])for(const format of ['feed','story']){const page=await browser.newPage({viewport:{width:1080,height:format==='feed'?1350:1920}});try{await page.setContent(flyerHtml(source,rich,config,format,assets));await fitFlyer(page);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),1080);assert.ok(await page.evaluate(()=>{const p=document.querySelector('.page'),hero=p.querySelector('.hero'),block=p.querySelector('.block');return hero.getBoundingClientRect().bottom<=block.getBoundingClientRect().top && block.getBoundingClientRect().bottom<=p.getBoundingClientRect().bottom;}));}finally{await page.close();}}
 for(const format of ['feed','story']){
  const pngPage=await browser.newPage({viewport:{width:1080,height:format==='feed'?1350:1920}});
  try{await pngPage.route('https://fixture.example/flyer.png',route=>route.fulfill({contentType:'image/png',body:pngBytes}));await pngPage.setContent(flyerHtml(blueprint,{...rich,flyerUrl:'https://fixture.example/flyer.png'},config,format,assets));await fitFlyer(pngPage);assert.ok(await pngPage.locator('img.flyer').evaluate(img=>img.complete&&img.naturalWidth>0));const jpeg=await pngPage.screenshot({type:'jpeg'});assert.equal(jpeg.subarray(0,3).toString('hex'),'ffd8ff');}finally{await pngPage.close();}
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
  await cp(join(root,`docs/media/2026-27/${fixture.id}-feed.jpg`),'test-results/flyer-feed.jpg');
  await cp(join(root,`docs/media/2026-27/${fixture.id}-story.jpg`),'test-results/flyer-story.jpg');
 } finally {await rm(root,{recursive:true,force:true});}
 console.log('Browser checks passed: export, timezone, food toggle, examples, duplication, archive filters, mobile layout, console, GitHub writes, preserved scheduler state, edit conflicts, and real JPEG rendering.');
} finally {if(browser)await browser.close();server.kill();}
