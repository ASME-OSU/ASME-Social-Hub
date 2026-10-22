import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export async function checkAcademicYears(browser,base){
 const original=JSON.parse(await readFile('config/chapter.json','utf8'));original.showExamples=false;
 const campaigns=[{id:'year-fixture-current',year:'2026-27',type:'gbm',title:'Academic year preservation fixture',start:'2026-10-25T21:30:00Z',end:'2026-10-25T22:30:00Z',location:{name:'Scott E141'},description:'Synthetic year setup regression',campaign:{feed:{enabled:true,daysBefore:1,time:'10:00'},story:{enabled:true,daysBefore:0,time:'11:30'},groupme:{enabled:false}},status:{feed:'pending',story:'done',groupme:'skipped'},results:{story:{mediaId:'synthetic-recorded-receipt',postedAt:'2026-10-20T14:00:00Z'}},log:[{channel:'story',at:'2026-10-20T14:00:00Z',message:'Preserved recorded Story'}],notes:'Preserved notes',revision:2},{id:'year-fixture-history',year:'2025-26',type:'social',title:'Historical year fixture',start:'2025-10-25T21:30:00Z',end:'2025-10-25T22:30:00Z',location:{name:'Fixture'},campaign:{},status:{feed:'done',story:'done',groupme:'skipped'},results:{feed:{mediaId:'historic-receipt'}},log:[],revision:1}];
 await mkdir('test-results/academic-years',{recursive:true});
 for(const width of [1440,390,320])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:1000},colorScheme:theme,reducedMotion:'reduce'});
  try{
   const page=await context.newPage(),errors=[],writes=[];let stored={...structuredClone(original),school:'Latest repository school'},sha='fresh-configuration-1',rejectWrite=false;page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-10-21T16:00:00Z')});
   await page.route('**/config/chapter.json',r=>r.fulfill({json:original}));await page.route('**/data/archive-index.json',r=>r.fulfill({json:{campaigns}}));await page.route('**/data/candidates.json',r=>r.fulfill({json:{events:[],changes:[]}}));await page.route('**/data/token-warning.json',r=>r.fulfill({json:{status:'unknown'}}));await page.route('**/data/dispatcher-health.json',r=>r.fulfill({json:{lastSuccessfulLiveRunAt:'2026-10-21T15:55:00Z'}}));
   await page.route('https://api.github.com/**',async r=>{
    const request=r.request(),path=new URL(request.url()).pathname;
    if(path.endsWith('/contents/config/chapter.json')){
     if(request.method()==='GET')return r.fulfill({json:{sha,content:Buffer.from(JSON.stringify(stored)).toString('base64')}});
     const body=request.postDataJSON();writes.push({path,body});if(rejectWrite)return r.fulfill({status:409,json:{message:'Synthetic configuration conflict'}});assert.equal(body.sha,sha,'Configuration save uses most recent SHA');stored=JSON.parse(Buffer.from(body.content,'base64').toString('utf8'));sha=`fresh-configuration-${writes.length+1}`;return r.fulfill({json:{content:{sha}}});
    }
    return r.fulfill({status:404,json:{message:'Fixture endpoint not available'}});
   });
   await page.goto(base);await page.locator('.campaign-card').first().waitFor();if(width===1440)await page.locator('[data-open-academic-years]').click();else await page.locator('[data-view=settings]').click();const panel=page.locator('#academic-years-panel');await panel.getByRole('heading',{name:'Academic years',exact:true}).waitFor();
   assert.match(await panel.innerText(),/Active academic year: 2026-27/);assert.equal(await panel.locator('[name=academicYear]').inputValue(),'2027-28');assert.equal(await panel.getByRole('button',{name:'Add academic year',exact:true}).isDisabled(),true);assert.equal(writes.length,0);
   await page.locator('#settings-form [name=token]').fill('mock-academic-year-token-not-a-credential');await page.locator('#settings-form button.primary').click();await page.waitForFunction(()=>document.querySelector('#connection-label').textContent==='Connected');
   await panel.getByRole('button',{name:'Add academic year',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-year-status]')?.textContent.includes('2027-28 added'));
   assert.equal(writes.length,1);assert.equal(stored.activeYear,'2026-27');assert.equal(stored.school,'Latest repository school','Fresh unrelated config changes survive');assert.ok(stored.academicYears.includes('2025-26'));assert.ok(stored.academicYears.includes('2027-28'));assert.match(await page.locator('#active-year').innerText(),/2026-27/);assert.equal(await panel.locator('[name=selectedYear]').inputValue(),'2027-28');
   await panel.getByRole('button',{name:'Create campaign for selected year',exact:true}).click();assert.equal(await page.locator('#editor [name=year]').inputValue(),'2027-28');assert.match(await page.locator('#year-warning').innerText(),/Only the active year \(2026-27\)/);await page.locator('[data-close=editor]').first().click();
   const activation=panel.getByRole('button',{name:'Activate selected year',exact:true});assert.equal(await activation.isDisabled(),true);assert.match(await panel.locator('[data-year-impact]').innerText(),/1 current-year campaign has pending or failed steps/);await panel.locator('[name=acknowledge]').check();
   stored.activeYear='2025-26';await activation.click();await page.waitForFunction(()=>document.querySelector('[data-year-status]')?.textContent.includes('active year changed'));assert.equal(writes.length,1,'Conflicting active year blocks activation write');assert.match(await page.locator('#active-year').innerText(),/2026-27/);
   stored.activeYear='2026-27';await activation.click();await page.waitForFunction(()=>document.querySelector('[data-year-status]')?.textContent.includes('2027-28 is now active'));assert.equal(stored.activeYear,'2027-28');assert.match(await page.locator('#active-year').innerText(),/2027-28/);assert.equal(writes.length,2);
   await panel.locator('[name=academicYear]').fill('2028-29');rejectWrite=true;await panel.getByRole('button',{name:'Add academic year',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-year-status]')?.textContent.includes('changed while saving'));assert.equal(stored.activeYear,'2027-28');assert.equal(stored.academicYears.includes('2028-29'),false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width}px: no horizontal overflow`);await panel.screenshot({path:`test-results/academic-years/${width}-${theme}.png`});
   await page.locator('[data-view=dashboard]').click();await page.locator('#new-campaign').click();assert.equal(await page.locator('#editor [name=year]').inputValue(),'2027-28');await page.locator('[data-close=editor]').first().click();
   await page.locator('[data-view=archive]').click();assert.equal(await page.locator('.archive-row').count(),2,'Both academic years remain in archive');const row=page.locator('.archive-row').filter({has:page.getByRole('heading',{name:campaigns[0].title,exact:true})});await row.getByRole('button').click();await page.locator('.detail-history>summary').click();assert.match(await page.locator('.detail-history').innerText(),/Preserved recorded Story/);await page.locator('#detail [data-edit]').click();assert.equal(await page.locator('#editor [name=year]').inputValue(),'2026-27','Existing campaigns retain original year');await page.locator('[data-close=editor]').first().click();
   assert.ok(writes.every(write=>write.path.endsWith('/contents/config/chapter.json')),'Year setup only writes chapter configuration');assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }
 console.log('Academic years passed: prepare without activation, selected-year campaigns, explicit activation, pending-step impact, latest config/SHA preservation, conflicts, history/receipts, responsive light/dark and configuration-only writes.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {chromium}=await import('playwright'),port=4301,base=`http://127.0.0.1:${port}`,server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});let browser;
 try{for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}browser=await chromium.launch({headless:true});await checkAcademicYears(browser,base);}finally{await browser?.close();server.kill();}
}
