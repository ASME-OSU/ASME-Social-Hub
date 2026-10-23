import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {botAnnouncementText} from '../docs/groupme-message.mjs';
import {validateCampaign} from './core.mjs';

export async function checkGroupMeSchedule(browser,base){
 const config=JSON.parse(await readFile('config/chapter.json','utf8'));
 config.integrations={...config.integrations,groupme:{enabled:true,mode:'bot'}};
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 let saved;const errors=[],sends=[];
 try{
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date('2026-10-22T16:00:00Z')});
  await page.route('**/config/chapter.json',r=>r.fulfill({json:config}));
  await page.route('**/data/archive-index.json',r=>r.fulfill({json:{campaigns:[]}}));
  await page.route('https://api.groupme.com/**',r=>{sends.push(r.request().url());return r.abort();});
  await page.route('https://api.github.com/**',r=>{
   const req=r.request(),url=req.url();
   if(req.method()==='PUT'){saved=JSON.parse(Buffer.from(JSON.parse(req.postData()).content,'base64'));return r.fulfill({json:{commit:{sha:'fixture-save'}}});}
   if(url.includes('/config/chapter.json'))return r.fulfill({json:{content:Buffer.from(JSON.stringify(config)).toString('base64')}});
   if(saved&&url.includes('/'+saved.id+'.json'))return r.fulfill({json:{sha:'fixture',content:Buffer.from(JSON.stringify(saved)).toString('base64')}});
   return r.fulfill({status:404,json:{message:'Fixture'}});
  });
  await page.goto(base);await page.locator('[data-view=settings]').click();await page.locator('[name=token]').fill('mock-groupme-schedule');await page.locator('#settings-form button.primary').click();await page.waitForFunction(()=>document.querySelector('#connection-label').textContent==='Connected');
  await page.locator('[data-view=dashboard]').click();await page.locator('#new-campaign').click();
  assert.equal(await page.locator('#campaign-schedule [name=groupmeAnnounce]').count(),1);
  assert.equal(await page.locator('[data-editor-section=groupme]').count(),0);
  assert.equal(await page.locator('#groupme-message-settings').isVisible(),false);
  for(const [name,value] of Object.entries({title:'GroupMe schedule fixture',start:'2026-11-20T18:30',end:'2026-11-20T20:00',location:'Scott E100',description:'Build and meet engineers.'}))await page.locator(`[name=${name}]`).fill(value);
  await page.locator('[name=feedEnabled]').uncheck();await page.locator('[name=storyEnabled]').uncheck();await page.locator('[name=groupmeAnnounce]').check();
  assert.equal(await page.locator('[name=feedDays]').isDisabled(),true,'GroupMe no longer depends on feed fields');
  await page.locator('[name=groupmeDays]').fill('5');await page.locator('[name=groupmeTime]').fill('09:30');await page.locator('[name=groupmeFollowUp]').check();
  assert.equal(await page.locator('[name=groupmeFollowUpDays]').inputValue(),'1');assert.match(await page.locator('#schedule-preview').textContent(),/GroupMe follow-up/);
  await page.locator('[name=groupmeFollowUpTime]').fill('17:00');
  await page.locator('[name=groupmeFormat]').selectOption('invite');await page.locator('#preview-groupme-message').click();
  const preview=page.locator('#groupme-message-preview');assert.match(await preview.locator('.gm-message-text').textContent(),/You’re invited/);
  await page.locator('[data-shuffle-groupme=initial]').click();assert.notEqual(await page.locator('[name=groupmeFormat]').inputValue(),'invite');
  await page.locator('[name=groupmeFollowUpFormat]').selectOption('bulletin');await preview.locator('[data-gm-kind=followUp]').click();assert.match(await preview.locator('.gm-message-text').textContent(),/EVENT REMINDER/);
  await page.locator('[data-shuffle-groupme=followUp]').click();assert.notEqual(await page.locator('[name=groupmeFollowUpFormat]').inputValue(),'bulletin');
  const initialFormat=await page.locator('[name=groupmeFormat]').inputValue(),followUpFormat=await page.locator('[name=groupmeFollowUpFormat]').inputValue();
  await mkdir('test-results/groupme-schedule',{recursive:true});await page.locator('#groupme-announcement-control').screenshot({path:'test-results/groupme-schedule/desktop.png'});
  assert.equal(await page.locator('[name=groupmeFormat]').evaluate(e=>getComputedStyle(e).appearance),'none');
  assert.equal(await page.locator('[name=groupmeFormat]').evaluate(e=>getComputedStyle(e).backgroundPosition),'calc(100% - 13px) 50%');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('#editor').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  await page.locator('#groupme-announcement-control').screenshot({path:'test-results/groupme-schedule/mobile.png'});
  await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  await page.locator('#groupme-announcement-control').screenshot({path:'test-results/groupme-schedule/mobile-dark.png'});
  await page.evaluate(()=>document.documentElement.dataset.theme='light');
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[name=groupmeFollowUpDays]').fill('6');await page.locator('#save-button').click();assert.match(await page.locator('#form-error').textContent(),/after the initial/);assert.equal(saved,undefined);
  await page.locator('[name=groupmeFollowUpDays]').fill('1');await page.locator('#save-button').click();await page.waitForFunction(()=>!document.querySelector('#editor').open);
  validateCampaign(saved);assert.equal(saved.campaign.groupme.daysBefore,5);assert.equal(saved.campaign.groupme.time,'09:30');assert.equal(saved.campaign.groupme.format,initialFormat);assert.deepEqual(saved.campaign.groupme.followUp,{enabled:true,daysBefore:1,time:'17:00',format:followUpFormat});
  await page.locator(`#campaign-list [data-detail="${saved.id}"]`).click();await page.locator('[data-detail-preview=groupme]').click();const detail=page.locator('#detail-groupme-preview');await detail.locator('[data-gm-kind=followUp]').click();assert.equal(await detail.locator('.gm-message-text').textContent(),botAnnouncementText(saved,config,{kind:'followUp'}));
  await page.locator('[data-edit]').click();assert.equal(await page.locator('[name=groupmeFormat]').inputValue(),initialFormat);assert.equal(await page.locator('[name=groupmeFollowUp]').isChecked(),true);assert.equal(await page.locator('[name=groupmeFollowUpTime]').inputValue(),'17:00');
  await page.locator('[name=groupmeAnnounce]').uncheck();assert.equal(await page.locator('#groupme-message-settings').isVisible(),false);assert.equal(await page.locator('[name=groupmeFollowUpDays]').isDisabled(),true);
  assert.deepEqual(errors,[]);assert.deepEqual(sends,[]);console.log('GroupMe schedule checks passed: integrated scheduling, independent cadence, optional follow-up, random formats, exact previews, order validation, saved edits, and mobile layout.');
 }finally{await context.close();}
}
