import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
export async function checkUiRefinements(browser,base){
 const config=JSON.parse(await readFile('config/chapter.json','utf8'));
 const source=JSON.parse(await readFile('data/campaigns/2026-27/2026-10-28-industry-night.json','utf8'));
 const campaign={...source,demo:false,id:'refinement-fixture',results:{feed:{},story:{},groupme:{}},images:{feed:'https://preview.example/flyer.jpg',story:'https://preview.example/flyer.jpg'}};
 const flyer=await readFile('docs/media/2026-27/2026-10-22-asme-scheduling-buckeyelink-tour-feed.jpg');
 await mkdir('test-results/ui-refinement',{recursive:true});
 for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:theme,reducedMotion:'reduce'});
  try{
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/config/chapter.json',route=>route.fulfill({json:config}));
   await page.route('**/data/archive-index.json',route=>route.fulfill({json:{campaigns:[campaign]}}));
   await page.route('**/data/candidates.json',route=>route.fulfill({json:{events:[],changes:[]}}));
   await page.route('https://preview.example/**',route=>route.fulfill({contentType:'image/jpeg',body:flyer}));
   await page.goto(base);await page.locator('.campaign-card').waitFor();
   const art=page.locator('.card-art>img');await art.evaluate(image=>image.decode());
   assert.equal(await art.isVisible(),true);assert.ok(await art.evaluate(image=>{const s=getComputedStyle(image);return +s.opacity>=.15&&+s.opacity<=.3;}),'Flyer is softly faded behind header');
   assert.equal(await page.locator('#timezone-label').textContent(),'Columbus time — Eastern time');
   await page.screenshot({path:`test-results/ui-refinement/after-dashboard-${theme}.png`});
   await page.locator('[data-detail]').first().click();assert.equal(await page.locator('#detail a[href*="event.html"]').count(),1,'One member-page shortcut in drawer');assert.equal(await page.locator('#detail-event-page').isVisible(),true);assert.equal(await page.locator('#detail').textContent().then(text=>text.includes('America/New_York')),false);
   await page.locator('[data-close=detail]').click();await page.locator('#new-campaign').click();
   assert.equal(await page.locator('#form-timezone').textContent(),'Times use Columbus time.');
   await page.locator('#editor [data-preview-format=story]').click();await page.waitForFunction(()=>document.querySelector('#artwork-preview-frame')?.style.visibility==='visible');
   await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`test-results/ui-refinement/after-editor-${theme}.png`});
   await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('#editor').evaluate(element=>element.scrollWidth<=element.clientWidth),'Editor fits phone');
   await page.locator('[data-close=editor]').first().click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Dashboard fits phone');
   await page.screenshot({path:`test-results/ui-refinement/after-dashboard-${theme}-mobile.png`,fullPage:true});assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }
 console.log('UI refinements passed: faded flyer headers, single event shortcut, concise time labels, light/dark and phone editor fit.');
}
