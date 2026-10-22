import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export async function checkPostingStatus(browser,base){
 await mkdir('test-results/posting-status',{recursive:true});
 for(const width of [1440,390])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000},colorScheme:theme,reducedMotion:'reduce'});
  try{
   const page=await context.newPage(),errors=[],writes=[];page.on('pageerror',error=>errors.push(error.message));
   const now=Date.parse('2026-10-21T16:00:00Z');await page.clock.install({time:new Date(now)});
   let record={lastSuccessfulLiveRunAt:new Date(now-300000).toISOString()};
   await page.route('**/data/dispatcher-health.json',route=>route.fulfill({json:record}));
   await page.route('**/data/archive-index.json',route=>route.fulfill({json:{campaigns:[]}}));
   await page.route('**/data/candidates.json',route=>route.fulfill({json:{events:[],changes:[]}}));
   await page.route('https://api.github.com/**',route=>{writes.push(route.request().method());return route.abort();});
   await page.goto(base);await page.locator('#new-campaign:not([disabled])').waitFor();
   const panel=page.locator('.dispatcher-health'),details=page.locator('#dispatcher-controls');
   for(const state of ['healthy','delayed','failed','stale','unknown']){
    const current=await page.evaluate(()=>Date.now());
    record=state==='unknown'?{}:{lastSuccessfulLiveRunAt:new Date(current-(state==='stale'?13*3600000:state==='delayed'?2*3600000:300000)).toISOString(),...(state==='failed'?{lastLiveRunAt:new Date(current-60000).toISOString(),lastLiveRunStatus:'failed'}:{})};
    await page.clock.fastForward(60000);await page.waitForFunction(state=>document.querySelector('.dispatcher-health').dataset.state===state,state);
    const attention=state==='failed'||state==='stale';
    assert.equal(await panel.evaluate(el=>el.previousElementSibling.id),attention?'preview-banner':'campaign-list');
    assert.equal(await page.locator('#dispatcher-warning').isVisible(),attention);
    assert.equal(await details.evaluate(el=>el.open),false);
    assert.equal(await page.locator('#dispatcher-preview').isVisible(),false);
    if(!attention){const box=await panel.boundingBox();assert.ok(box.height<=(width===390?76:56),'Routine status stays compact');}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await panel.screenshot({path:`test-results/posting-status/${width}-${theme}-${state}.png`});
   }
   await details.locator('summary').focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('#dispatcher-preview').isVisible(),true);
   assert.equal(await page.locator('#dispatcher-actions-link').isVisible(),true);
   await page.keyboard.press('Enter');assert.equal(await details.evaluate(el=>el.open),false);
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  }finally{await context.close();}
 }
 console.log('Posting status checks passed: compact routine states, prominent actionable states, correct placement, keyboard disclosure, both themes, mobile, and no workflow requests.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {chromium}=await import('playwright'),port=4304,base=`http://127.0.0.1:${port}`,server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});let browser;
 try{for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}browser=await chromium.launch();await checkPostingStatus(browser,base);}finally{await browser?.close();server.kill();}
}
