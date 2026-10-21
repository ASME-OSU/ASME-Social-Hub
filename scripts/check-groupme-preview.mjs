import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {botAnnouncementText} from '../docs/groupme-message.mjs';

export async function checkGroupMePreview(browser,base) {
 const config=JSON.parse(await readFile('config/chapter.json','utf8'));
 config.integrations={...config.integrations,groupme:{enabled:true,mode:'bot',botName:'Gearley',botAvatar:'assets/logos/groupme-bot.png'}};
 const recordedText='Original sent announcement\n'+Array.from({length:15},(_,i)=>`Recorded line ${i+1}: this is the exact delivered text.`).join('\n');
 const fixture={id:'groupme-delivered-fixture',year:'2026-27',type:'social',title:'Current edited event title',description:'New content that must not replace the delivered message.',start:'2026-11-20T23:30:00Z',end:'2026-11-21T01:00:00Z',food:false,location:{name:'Fixture room'},template:'refined-blueprint',revision:4,campaign:{feed:{enabled:false,daysBefore:7,time:'12:00'},story:{enabled:false,daysBefore:3,time:'12:00'},groupme:{enabled:true,announce:true}},status:{feed:'skipped',story:'skipped',groupme:'done'},results:{feed:{},story:{},groupme:{botAttemptedAt:'2026-11-13T17:00:00Z',botSentAt:'2026-11-13T17:00:01Z',botText:recordedText}},log:[]};
 const errors=[],writes=[],external=[];
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Los_Angeles'});
 try{
  const page=await context.newPage();await page.clock.install({time:new Date('2026-10-20T16:00:00Z')});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/config/chapter.json',route=>route.fulfill({json:config}));
  await page.route('**/data/archive-index.json',route=>route.fulfill({json:{campaigns:[fixture]}}));
  await page.route('**/data/candidates.json',route=>route.fulfill({json:{events:[],changes:[]}}));
  await page.route('https://api.github.com/**',route=>{
   const request=route.request();
   if(request.method()!=='GET'){writes.push(request.postData());return route.fulfill({status:409,json:{message:'Browser fixture rejects all writes'}});}
   if(request.url().includes('contents/config/chapter.json'))return route.fulfill({json:{sha:'fixture-config-sha',content:Buffer.from(JSON.stringify(config)).toString('base64')}});
   return route.fulfill({status:404,json:{message:'Fixture only'}});
  });
  await page.route('https://api.groupme.com/**',route=>{external.push(route.request().url());return route.abort();});
  const image=await readFile('docs/assets/logos/social-hub-512.png');
  await page.route('**/media/2026-27/groupme-delivered-fixture-*.jpg',route=>route.fulfill({contentType:'image/png',body:image}));
  await page.goto(base);await page.locator(`#campaign-list [data-detail="${fixture.id}"]`).click();
  const detail=page.locator('#detail-groupme-preview .gm-preview');
  assert.equal(await detail.locator('.gm-bot-name').textContent(),'Gearley');
  assert.equal(await detail.locator('.gm-message-text').textContent(),recordedText,'Detail preserves exact delivered copy');
  assert.match(await detail.locator('.gm-status').textContent(),/recorded sent/i);
  assert.doesNotMatch(await detail.locator('.gm-message-text').textContent(),/Current edited event title/);
  assert.equal(await detail.locator('.gm-avatar,img').count(),0,'Message preview uses a plain bot name without a decorative avatar');
  assert.ok(await detail.locator('.gm-message').evaluate(element=>element.scrollHeight>element.clientHeight));
  await detail.locator('.gm-message').focus();await page.keyboard.press('End');await page.waitForFunction(()=>document.querySelector('#detail-groupme-preview .gm-message').scrollTop>0);
  await mkdir('test-results/groupme-preview',{recursive:true});
  await detail.scrollIntoViewIfNeeded();await detail.screenshot({path:'test-results/groupme-preview/detail-desktop.png'});
  await page.setViewportSize({width:390,height:844});await detail.scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#detail').evaluate(element=>element.scrollWidth<=element.clientWidth),true);
  await detail.screenshot({path:'test-results/groupme-preview/detail-mobile.png'});
  await page.locator('[data-close=detail]').click();await page.setViewportSize({width:1440,height:1000});

  await page.locator('[data-view=settings]').click();await page.locator('[name=token]').fill('mock-groupme-preview-token');await page.locator('#settings-form button.primary').click();
  await page.waitForFunction(()=>document.querySelector('#connection-label').textContent==='Connected');
  await page.locator('[data-view=dashboard]').click();await page.locator('#new-campaign').click();await page.locator('#artwork-preview [data-preview-format=groupme]').click();
  for(const [name,value]of Object.entries({title:'GroupMe preview fixture',start:'2026-11-20T18:30',end:'2026-11-20T20:00',location:'Fixture room',description:'Meet other engineers.\nBring an idea to build together.'}))await page.locator(`[name=${name}]`).fill(value);
  await page.locator('[name=feedEnabled]').uncheck();await page.locator('[name=storyEnabled]').uncheck();await page.locator('[name=groupmeAnnounce]').check();await page.locator('[name=food]').check();
  await page.locator('#advertising-details summary').click();
  for(const [name,value]of Object.entries({foodDetails:'Pizza with vegetarian options',audience:'All majors welcome',rsvpUrl:'https://example.org/rsvp',cost:'Free'}))await page.locator(`[name=${name}]`).fill(value);
  const draft={id:'2026-11-20-groupme-preview-fixture',year:'2026-27',type:'gbm',title:'GroupMe preview fixture',start:'2026-11-20T23:30:00.000Z',description:'Meet other engineers.\nBring an idea to build together.',location:{name:'Fixture room'},food:true,advertising:{foodDetails:'Pizza with vegetarian options',audience:'All majors welcome',rsvpUrl:'https://example.org/rsvp',cost:'Free'}};
  const preview=page.locator('#groupme-message-preview .gm-preview');
  await page.waitForFunction(expected=>document.querySelector('#groupme-message-preview .gm-message-text')?.textContent===expected,botAnnouncementText(draft,config));
  assert.match(await preview.locator('.gm-status').textContent(),/preview only.*not sent/i);
  assert.equal(await preview.locator('.gm-count').textContent(),`${botAnnouncementText(draft,config).length} / 1000 characters`);
  assert.equal(await preview.locator('.gm-avatar,img').count(),0);
  assert.equal(await preview.locator('.gm-bot-name').textContent(),'Gearley');
  await page.locator('[name=location]').fill('Updated fixture room');draft.location.name='Updated fixture room';
  await page.locator('[name=food]').uncheck();draft.food=false;
  assert.equal(await preview.locator('.gm-message-text').textContent(),botAnnouncementText(draft,config));
  assert.doesNotMatch(await preview.locator('.gm-message-text').textContent(),/Pizza|Food provided/);
  await page.locator('[name=groupmeAnnounce]').uncheck();assert.match(await preview.locator('.gm-status').textContent(),/off.*will not send/i);
  assert.equal(writes.length,0);assert.deepEqual(external,[],'Preview must not send GroupMe requests');
  await page.locator('[name=groupmeAnnounce]').check();
  await page.setViewportSize({width:1280,height:720});
  draft.description=Array.from({length:8},(_,i)=>`Line ${i+1}: meet other engineers and share your next project.`).join('\n');
  await page.locator('[name=description]').fill(draft.description);
  assert.equal(await preview.locator('.gm-message-text').textContent(),botAnnouncementText(draft,config));
  await preview.scrollIntoViewIfNeeded();assert.ok(await preview.locator('.gm-message').evaluate(element=>element.scrollHeight>element.clientHeight));
  await preview.locator('.gm-message').focus();await page.keyboard.press('End');await page.waitForFunction(()=>document.querySelector('#groupme-message-preview .gm-message').scrollTop>0);
  await preview.screenshot({path:'test-results/groupme-preview/editor-desktop.png'});
  await page.setViewportSize({width:390,height:844});await preview.scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#editor').evaluate(element=>element.scrollWidth<=element.clientWidth),true);
  assert.equal(await preview.evaluate(element=>element.scrollWidth<=element.clientWidth),true);
  await preview.screenshot({path:'test-results/groupme-preview/editor-mobile.png'});
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[name=description]').fill('Overlong message '.repeat(75));
  await page.waitForSelector('#groupme-message-preview .gm-error:not([hidden])');assert.match(await preview.locator('.gm-error').textContent(),/1000 characters/);
  await page.locator('#save-button').click();await page.waitForSelector('#form-error:not([hidden])');assert.match(await page.locator('#form-error').textContent(),/1000 characters/);
  assert.equal(writes.length,0,'An invalid GroupMe announcement cannot write a campaign');
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  console.log('GroupMe preview checks passed: exact shared publishing text, plain bot identity, live form changes, food/advertising, opt-out, recorded sent text, keyboard scrolling, mobile layout, and overlimit save protection without writes or messages.');
 }finally{await context.close();}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {chromium}=await import('playwright'),port=4284,base=`http://127.0.0.1:${port}`;
 const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});let browser;
 try{for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}browser=await chromium.launch({headless:true});await checkGroupMePreview(browser,base);}finally{if(browser)await browser.close();server.kill();}
}
