import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export async function checkCampaignCards(browser,base){
 const config=JSON.parse(await readFile('config/chapter.json','utf8'));
 config.showExamples=false;config.integrations.groupme={...config.integrations.groupme,enabled:true,mode:'bot'};
 const realCampaigns=JSON.parse(await readFile('data/archive-index.json','utf8')).campaigns;
 const recorded=realCampaigns.find(c=>c.title==='ASME Bar Social');
 assert.ok(recorded?.results?.insights?.length,'Use an actual recorded campaign snapshot');
 const make=(id,title)=>({id,year:config.activeYear,type:'gbm',title,description:'Browser regression fixture only.',start:'2026-10-25T21:30:00Z',end:'2026-10-25T22:30:00Z',location:{name:'Scott Laboratory E141'},food:false,revision:1,campaign:{feed:{enabled:true,daysBefore:1,time:'10:00'},story:{enabled:true,daysBefore:0,time:'11:30'},groupme:{enabled:true,announce:true}},status:{feed:'pending',story:'pending',groupme:'pending'},results:{feed:{},story:{},groupme:{}},log:[]});
 const normal=make('card-fixture-normal','Recorded campaign fixture');normal.status={feed:'done',story:'pending',groupme:'done'};
 normal.results=structuredClone(recorded.results);normal.results.feed.postedAt='2026-10-21T14:59:00Z';normal.results.feed.image='';normal.results.feed.images=[];normal.results.groupme={botSentAt:'2026-10-21T14:00:00Z'};normal.results.story={};
 const failed=make('card-fixture-failed','Failed publication fixture');failed.status.feed='failed';failed.results.feed={publishAttemptedAt:'2026-10-21T14:00:00Z',error:{at:'2026-10-21T14:00:00Z',code:'PUBLISH_FAILED',stage:'publish',hint:'Publication outcome requires officer reconciliation before retry'}};
 const missed=make('card-fixture-missed','Missed publishing window fixture');missed.status.story='skipped';missed.campaign.story.daysBefore=7;missed.results.story={skipReason:'publishing-window-missed'};
 const long=make('card-fixture-long','Engineering design collaboration and undergraduate professional development workshop with an unusually long campaign title');long.location.name='Scott Laboratory Engineering Collaboration and Undergraduate Professional Development Center, East Wing Room E141 / '+ 'LongLocationWithoutSpaces'.repeat(5);
 const noReceipt=make('card-fixture-no-receipt','Completed without recorded timestamps');noReceipt.status={feed:'done',story:'done',groupme:'done'};noReceipt.results.insights=[{channel:'feed',recordedAt:'2026-10-21T15:00:00Z',metrics:{likes:0,reach:0}}];
 const campaigns=[normal,failed,missed,long,noReceipt],output='test-results/campaign-cards',metrics=[];await mkdir(output,{recursive:true});
 for(const width of [1440,768,390,320])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,timezoneId:'America/Los_Angeles',reducedMotion:'reduce'});
  try{
   const page=await context.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-10-21T16:00:00Z')});
   await page.route('**/config/chapter.json',r=>r.fulfill({json:config}));
   await page.route('**/data/archive-index.json',r=>r.fulfill({json:{campaigns}}));
   await page.route('**/data/candidates.json',r=>r.fulfill({json:{events:[],changes:[]}}));
   await page.route('**/data/token-warning.json',r=>r.fulfill({json:{status:'unknown'}}));
   await page.route('**/data/dispatcher-health.json',r=>r.fulfill({json:{lastSuccessfulLiveRunAt:'2026-10-21T15:55:00Z'}}));
   await page.route('https://api.github.com/**',r=>{writes.push(r.request().method());return r.abort();});
   const image=await readFile('docs/assets/logos/social-hub-512.png');await page.route('**/media/2026-27/card-fixture-*.jpg',r=>r.fulfill({contentType:'image/png',body:image}));
   await page.goto(base);await page.locator('.campaign-card').first().waitFor();
   const card=title=>page.locator('.campaign-card').filter({has:page.getByRole('heading',{name:title,exact:true})});
   const first=card(normal.title),engagement=first.locator('.card-engagement'),steps=first.locator('.step-row');
   assert.equal(await steps.count(),3);assert.match(await engagement.innerText(),/17\s+likes/);assert.match(await engagement.innerText(),/191\s+reached/);assert.match(await engagement.innerText(),/not live/);
   assert.match(await steps.nth(0).innerText(),/Posted[\s\S]*Oct 21, 10:59 AM/i);assert.match(await steps.nth(1).innerText(),/Pending[\s\S]*Oct 25, 11:30 AM/i);assert.match(await steps.nth(2).innerText(),/Posted[\s\S]*Oct 21, 10:00 AM/i);
   assert.equal(await card(noReceipt.title).locator('.step-time').filter({hasText:'Time not recorded'}).count(),3,'Completed channels without receipts must not invent actual posting times');assert.match(await card(noReceipt.title).locator('.card-engagement').innerText(),/0\s+likes/);assert.match(await card(noReceipt.title).locator('.card-engagement').innerText(),/0\s+reached/);
   assert.equal(await first.locator('.card-warnings').count(),0,'Future pending has no warning panel');assert.equal(await card(long.title).locator('.card-warnings').count(),0);
   assert.match(await card(long.title).locator('.card-engagement').innerText(),/not recorded|after Feed publishes/i);
   for(const fixture of [failed,missed]){
    const target=card(fixture.title),warning=target.locator('.card-warnings');assert.equal(await warning.count(),1);assert.match(await warning.innerText(),/warning/i);
    const order=await target.evaluate(el=>{const steps=el.querySelector('.steps'),warnings=el.querySelector('.card-warnings');return steps.getBoundingClientRect().bottom<=warnings.getBoundingClientRect().top;});assert.equal(order,true,'Warnings are below all posting statuses');
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width}px ${theme}: no page overflow`);
   assert.deepEqual(await page.locator('.campaign-card').evaluateAll(cards=>cards.flatMap(card=>[...card.querySelectorAll('.card-title-row,.card-details,.steps,.card-engagement,.card-warnings')].filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.className))),[],`${width}px ${theme}: no card content overflow`);
   if(width===1440){const a=await first.boundingBox(),b=await card(failed.title).boundingBox();assert.equal(Math.round(a.y),Math.round(b.y),'Desktop shows multiple cards per row');const rects=await steps.evaluateAll(items=>items.map(el=>el.getBoundingClientRect().y));assert.ok(Math.max(...rects)-Math.min(...rects)<1,'Desktop channels stay in one horizontal row');}
   metrics.push({width,theme,height:(await first.boundingBox()).height});
   await page.locator('#campaign-list').screenshot({path:`${output}/${width}-${theme}.png`});
   await first.getByRole('button',{name:`View campaign: ${normal.title}`,exact:true}).click();assert.equal(await page.locator('#detail').evaluate(el=>el.open),true);assert.equal(await page.locator('#detail-title').innerText(),normal.title);assert.match(await page.locator('#detail-content').innerText(),/Recorded snapshots, not live counts/);await page.locator('[data-close=detail]').click();
   await card(failed.title).getByRole('button',{name:`View campaign: ${failed.title}`,exact:true}).click();assert.match(await page.locator('#detail-content').innerText(),/reconciliation|failed/i);await page.locator('[data-close=detail]').click();
   assert.deepEqual(errors,[],'No browser JavaScript errors');assert.deepEqual(writes,[],'No GitHub requests from fixture verification');
  }finally{await context.close();}
 }
 await writeFile(`${output}/metrics.json`,JSON.stringify(metrics,null,2));console.log('Campaign cards passed: recorded reach/likes, actual Feed/GroupMe timestamps, future schedules, failed/missed warnings, navigation, long content, desktop/mobile and light/dark.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {chromium}=await import('playwright'),port=4293,base=`http://127.0.0.1:${port}`;
 const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});let browser;
 try{for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}browser=await chromium.launch({headless:true});await checkCampaignCards(browser,base);}finally{if(browser)await browser.close();server.kill();}
}
