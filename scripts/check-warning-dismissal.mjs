import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const config=JSON.parse(await readFile('config/chapter.json','utf8'));
const original=JSON.parse(await readFile('tests/fixtures/missed-campaign.json','utf8'));
let remote=structuredClone(original),conflict=false;
const port=4317,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});
let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch();
 const page=await browser.newPage({serviceWorkers:'block',viewport:{width:1280,height:900}}),errors=[],writes=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-11-02T16:00:00Z')});
 await page.addInitScript(()=>localStorage.setItem('social-hub-connection',JSON.stringify({token:'fixture-token',repo:{owner:'fixture',name:'hub',branch:'main'}})));
 await page.route('**/config/chapter.json',r=>r.fulfill({json:config}));
 await page.route('**/data/archive-index.json',r=>r.fulfill({json:{campaigns:[remote]}}));
 await page.route('**/data/candidates.json',r=>r.fulfill({json:{events:[],changes:[]}}));
 await page.route('https://api.github.com/**',async r=>{
  const req=r.request();
  if(req.method()==='PUT'){
   if(conflict)return r.fulfill({status:409,json:{message:'SHA changed'}});
   const body=req.postDataJSON();assert.equal(body.sha,'latest-sha');
   remote=JSON.parse(Buffer.from(body.content,'base64').toString());writes.push(body);
   return r.fulfill({json:{commit:{sha:'new-sha'}}});
  }
  if(req.url().includes(`/campaigns/${original.year}/${original.id}.json`))return r.fulfill({json:{sha:'latest-sha',content:Buffer.from(JSON.stringify(remote)).toString('base64')}});
  return r.fulfill({status:404,json:{message:'Mock only'}});
 });
 await page.goto(base);
 await page.locator('#open-review-queue').click();
 await page.locator('#detail').waitFor({state:'visible'});
 await page.locator('[data-close=detail]').first().click();
 await page.locator('[data-review-queue]').click();
 await page.locator('#detail').waitFor({state:'visible'});
 const dismiss=page.locator('.detail-priority-warning > [data-dismiss-missed]');
 await dismiss.waitFor({state:'visible'});
 // A concurrent publishing update must survive, and a rejected write stays visible.
 remote.results.feed.concurrentReceipt='preserve';conflict=true;
 await dismiss.click();await page.locator('#detail-error').waitFor({state:'visible'});
 assert.equal(await dismiss.isVisible(),true);assert.equal(writes.length,0);
 conflict=false;await dismiss.click();await page.waitForFunction(()=>!document.querySelector('#detail [data-dismiss-missed]'));
 assert.equal(writes.length,1);assert.deepEqual(remote.status,original.status);
 assert.equal(remote.results.feed.concurrentReceipt,'preserve');assert.deepEqual(remote.results.story,original.results.story);
 assert.equal(await page.locator('#review-list [data-detail]').count(),0);
 await page.reload();await page.locator('[data-review-queue]').click();
 assert.equal(await page.locator('#review-list [data-detail]').count(),0);
 assert.deepEqual(errors,[]);
 console.log('Warning dismissal browser check passed: BuckeyeLink story, review queue, failed write, latest receipts, and reload persistence.');
}finally{await browser?.close();server.kill();}
