import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFile,mkdir,mkdtemp,cp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {renderFlyers} from './render-flyers.mjs';
const port=4281,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});
let browser;
try {
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1080},timezoneId:'America/Los_Angeles'});
 await page.clock.install({time:new Date('2026-10-15T16:00:00Z')});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.waitForSelector('.campaign-card');
 assert.equal(await page.locator('#campaign-list .campaign-card').count(),3);
 await page.locator('#new-campaign').click();
 await page.locator('[name=title]').fill('Browser verification event');
 await page.locator('[name=start]').fill('2026-11-20T18:30');
 await page.locator('[name=end]').fill('2026-11-20T20:00');
 await page.locator('[name=location]').fill('Scott E100');
 await page.locator('[name=food]').uncheck();
 const downloadPromise=page.waitForEvent('download');await page.locator('#save-button').click();
 const download=await downloadPromise;const downloaded=JSON.parse(await readFile(await download.path(),'utf8'));
 assert.equal(downloaded.campaign.groupme.enabled,false);assert.equal(downloaded.status.groupme,'skipped');
 assert.equal(await page.locator('#groupme-schedule-help').isVisible(),false);
 assert.equal(downloaded.start,'2026-11-20T23:30:00.000Z');assert.equal(downloaded.food,false);assert.equal(downloaded.demo,undefined);assert.equal(downloaded.status.feed,'pending');
 assert.equal(await page.evaluate(()=>localStorage.getItem('social-hub-connection')),null);
 await page.locator('[data-view=archive]').click();await page.locator('#year-filter').selectOption('2025-26');assert.equal(await page.locator('#archive-list .campaign-card').count(),1);
 await page.locator('#search').fill('no such campaign');assert.equal(await page.locator('#archive-list .campaign-card').count(),0);
 await page.locator('[data-view=dashboard]').click();await page.locator('#campaign-list [data-detail]').first().click();await page.locator('[data-duplicate]').click();
 assert.equal(await page.locator('[name=start]').inputValue(),'');assert.equal(await page.locator('[name=end]').inputValue(),'');
 await page.locator('[data-close=editor]').first().click();
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/dashboard-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/dashboard-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Mobile page must not overflow');
 assert.deepEqual(errors,[]);
 // Mock GitHub at the network boundary: verify actual save payload without external writes.
 const writes=[];let remoteRecord=null;
 await page.route('https://api.github.com/**',async route=>{
  const request=route.request();
  if(request.method()==='PUT'){writes.push(JSON.parse(request.postData()));return route.fulfill({json:{commit:{sha:'test-commit'}}});}
  if(remoteRecord && request.url().includes(`campaigns/${remoteRecord.year}/${remoteRecord.id}.json`))return route.fulfill({json:{sha:'latest-file-sha',content:Buffer.from(JSON.stringify(remoteRecord)).toString('base64')}});
  if(request.url().includes('config/chapter.json'))return route.fulfill({json:{sha:'config-sha',content:Buffer.from('{}').toString('base64')}});
  return route.fulfill({status:404,json:{message:'Not Found'}});
 });
 await page.setViewportSize({width:1440,height:1080});
 await page.locator('[data-view=settings]').click();await page.locator('[name=token]').fill('mock-token-not-a-credential');await page.locator('#settings-form button.primary').click();
 await page.waitForFunction(()=>document.querySelector('#connection-label').textContent==='Repository connected');
 await page.locator('[data-view=dashboard]').click();await page.locator('#new-campaign').click();
 for(const [name,value] of Object.entries({title:'API verification event',start:'2026-11-20T18:30',end:'2026-11-20T20:00',location:'Scott E100'}))await page.locator(`[name=${name}]`).fill(value);
 await page.locator('#save-button').click();await page.waitForFunction(()=>!document.querySelector('#editor').open);
 assert.equal(writes.length,1);const saved=JSON.parse(Buffer.from(writes[0].content,'base64').toString());
 assert.equal(saved.title,'API verification event');assert.equal(saved.status.groupme,'skipped');assert.equal(saved.demo,undefined);assert.equal(writes[0].branch,'main');assert.equal(await page.evaluate(()=>localStorage.getItem('social-hub-connection')),null);
 // A scheduler update that arrives while an officer edits must survive that edit.
 remoteRecord=structuredClone(saved);remoteRecord.status.feed='done';remoteRecord.results.feed={mediaId:'mock-published-id',postedAt:'2026-11-13T17:00:00Z'};
 await page.locator(`[data-detail="${saved.id}"]`).click();await page.locator('[data-edit]').click();await page.locator('[name=description]').fill('Updated officer description');await page.locator('#save-button').click();await page.waitForFunction(()=>!document.querySelector('#editor').open);
 assert.equal(writes.length,2);const edited=JSON.parse(Buffer.from(writes[1].content,'base64').toString());assert.equal(edited.status.feed,'done');assert.equal(edited.results.feed.mediaId,'mock-published-id');assert.equal(writes[1].sha,'latest-file-sha');assert.equal(edited.revision,2);
 remoteRecord={...edited,revision:3};await page.locator(`[data-detail="${saved.id}"]`).click();await page.locator('[data-edit]').click();await page.locator('#save-button').click();await page.waitForSelector('#form-error:not([hidden])');assert.match(await page.locator('#form-error').textContent(),/edited since/);assert.equal(writes.length,2);await page.locator('[data-close=editor]').first().click();
 // Exercise real JPEG rendering in an isolated fixture, never add a live campaign to this repo.
 const root=await mkdtemp(join(tmpdir(),'campaign-render-'));
 try {
  await mkdir(join(root,'config'));await cp('config/chapter.json',join(root,'config/chapter.json'));await cp('templates',join(root,'templates'),{recursive:true});
  await mkdir(join(root,'data/campaigns/2026-27'),{recursive:true});
  const fixture=JSON.parse(await readFile('data/campaigns/2026-27/2026-10-28-industry-night.json','utf8'));delete fixture.demo;
  await writeFile(join(root,'data/campaigns/2026-27',fixture.id+'.json'),JSON.stringify(fixture));
  await renderFlyers({root});
  for(const format of ['feed','story'])assert.ok((await readFile(join(root,`docs/media/2026-27/${fixture.id}-${format}.jpg`))).length>10000);
  await cp(join(root,`docs/media/2026-27/${fixture.id}-feed.jpg`),'test-results/flyer-feed.jpg');
  await cp(join(root,`docs/media/2026-27/${fixture.id}-story.jpg`),'test-results/flyer-story.jpg');
 } finally {await rm(root,{recursive:true,force:true});}
 console.log('Browser checks passed: export, timezone, food toggle, examples, duplication, archive filters, mobile layout, console, GitHub writes, preserved scheduler state, edit conflicts, and real JPEG rendering.');
} finally {if(browser)await browser.close();server.kill();}
