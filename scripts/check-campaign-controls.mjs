import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {captionFor} from '../docs/caption.mjs';

async function waitForPaintedArtwork(page,title) {
 await page.waitForFunction(expected=>{
  const frame=document.querySelector('#artwork-preview-frame'),doc=frame?.contentDocument;
  return frame?.style.visibility==='visible'&&doc?.readyState==='complete'&&doc.querySelector('h1')?.textContent===expected&&doc.querySelector('h1')?.getBoundingClientRect().height>0&&doc.images.length>0&&[...doc.images].every(image=>image.complete&&image.naturalWidth>0);
 },title);
 await page.evaluate(async()=>{
  const frame=document.querySelector('#artwork-preview-frame');await frame.contentDocument.fonts.ready;
  await Promise.all([...frame.contentDocument.images,...document.querySelectorAll('#preview-dialog .ig-avatar img')].map(image=>image.decode()));
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 });
 const media=await page.locator('#artwork-preview-frame').screenshot();
 const nonwhite=await page.evaluate(async base64=>{
  const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
  const context=canvas.getContext('2d');context.drawImage(image,0,0,32,32);
  const pixels=context.getImageData(0,0,32,32).data;let nonwhite=0;
  for(let i=0;i<pixels.length;i+=4)if(pixels[i]<235||pixels[i+1]<235||pixels[i+2]<235)nonwhite++;
  return nonwhite;
 },media.toString('base64'));
 assert.ok(nonwhite>200,'Instagram media must contain painted artwork, not a blank frame');
}

// Every record and GitHub response in these checks is synthetic; writes never leave Playwright.
export async function checkCampaignControls(browser,base) {
 const config=JSON.parse(await readFile('config/chapter.json','utf8'));
 config.integrations={...config.integrations,groupme:{enabled:true,mode:'bot'}};
 config.showExamples=false;
 const campaign={id:'browser-controls-fixture',year:'2026-27',type:'social',title:'Campaign controls fixture',description:Array.from({length:26},(_,i)=>`Caption line ${i+1}: meet ASME students and build something together.`).join('\n'),start:'2026-10-23T22:00:00Z',end:'2026-10-23T23:30:00Z',food:false,location:{name:'Fixture room'},template:'refined-blueprint',flyerUrl:'https://preview.example/fixture-one.png',flyerUrls:['https://preview.example/fixture-one.png','https://preview.example/fixture-two.png'],revision:1,campaign:{feed:{enabled:true,daysBefore:7,time:'12:00'},story:{enabled:true,daysBefore:3,time:'12:00'},groupme:{enabled:true,announce:true}},status:{feed:'pending',story:'pending',groupme:'pending'},results:{feed:{},story:{},groupme:{}},log:[]};
 let archive=[structuredClone(campaign)],remote=structuredClone(campaign),writeConflict=false;
 const writes=[],errors=[];const fixtureImage=await readFile('docs/assets/logos/social-hub-512.png');
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'America/Los_Angeles'});
 try {
  const page=await context.newPage();await page.clock.install({time:new Date('2026-10-20T16:00:00Z')});
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://preview.example/**',route=>route.fulfill({contentType:'image/png',body:fixtureImage}));
  await page.route('**/media/2026-27/browser-controls-fixture-*.jpg',route=>route.fulfill({contentType:'image/png',body:fixtureImage}));
  await page.route('**/config/chapter.json',route=>route.fulfill({json:config}));
  await page.route('**/data/archive-index.json',route=>route.fulfill({json:{campaigns:archive}}));
  await page.route('**/data/candidates.json',route=>route.fulfill({json:{events:[],changes:[]}}));
  await page.route('**/data/dispatcher-health.json',route=>route.fulfill({json:{lastSuccessfulLiveRunAt:'2026-10-20T16:00:00Z'}}));
  await page.route('https://api.github.com/**',async route=>{
   const request=route.request();
   if(request.method()==='GET'&&request.url().includes('contents/config/chapter.json'))return route.fulfill({json:{sha:'mock-config-sha',content:Buffer.from(JSON.stringify(config)).toString('base64')}});
   if(request.method()==='GET'&&request.url().includes(`campaigns/${campaign.year}/${campaign.id}.json`))return route.fulfill({json:{sha:'latest-fixture-sha',content:Buffer.from(JSON.stringify(remote)).toString('base64')}});
   if(request.method()==='PUT'){
    const body=JSON.parse(request.postData());writes.push(body);
    if(writeConflict)return route.fulfill({status:409,json:{message:'Fixture SHA changed'}});
    remote=JSON.parse(Buffer.from(body.content,'base64').toString());archive=[structuredClone(remote)];
    return route.fulfill({json:{commit:{sha:'fixture-commit'}}});
   }
   // No dispatch, publishing, or unmatched GitHub request is allowed through.
   return route.fulfill({status:404,json:{message:'Fixture response only'}});
  });
  await page.goto(base);await page.locator(`#campaign-list [data-detail="${campaign.id}"]`).click();
  assert.equal(await page.locator('[data-delete]').isVisible(),true,'Campaign detail exposes Delete campaign');
  const detailPost=page.locator('#detail-instagram-preview .ig-post');
  assert.equal(await detailPost.locator('.ig-account strong').textContent(),config.instagramHandle.replace(/^@/,''));
  assert.equal(await detailPost.locator('.ig-caption-text').textContent(),captionFor(campaign,config));
  assert.equal(await detailPost.locator('.ig-actions svg').count(),4);
  await detailPost.locator('.ig-detail-image img').evaluate(image=>image.decode());
  assert.equal(await detailPost.locator('.ig-position').textContent(),'1 / 2');
  const firstImage=await detailPost.locator('.ig-detail-image img').getAttribute('src');await detailPost.locator('.ig-next').click();
  assert.equal(await detailPost.locator('.ig-position').textContent(),'2 / 2');assert.notEqual(await detailPost.locator('.ig-detail-image img').getAttribute('src'),firstImage);
  await detailPost.locator('.ig-previous').click();
  assert.equal(await detailPost.locator('.ig-caption').evaluate(element=>element.scrollHeight>element.clientHeight),true,'Long captions are scrollable');
  await detailPost.locator('.ig-caption').focus();await page.keyboard.press('End');await page.waitForFunction(()=>document.querySelector('#detail-instagram-preview .ig-caption').scrollTop>0);
  assert.ok(await detailPost.locator('.ig-caption').evaluate(element=>element.scrollTop)>0,'Caption can scroll from the keyboard');
  await mkdir('test-results/campaign-controls',{recursive:true});
  await page.screenshot({path:'test-results/campaign-controls/instagram-detail-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.locator('#detail').evaluate(element=>element.scrollTop=0);
  assert.equal(await page.locator('#detail').evaluate(element=>element.scrollWidth<=element.clientWidth),true,'Instagram detail fits a phone');
  await page.screenshot({path:'test-results/campaign-controls/instagram-detail-mobile.png'});
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-delete]').click();
  assert.equal(writes.length,0,'Preview mode cannot delete repository campaigns');
  assert.equal(await page.locator('#detail').evaluate(element=>element.open),true);
  await page.locator('[data-close=detail]').click();

  // New editor: missed schedules warn per channel, and a late but valid window stays truthful.
  await page.locator('#new-campaign').click();
  for(const [name,value]of Object.entries({title:'Schedule warning fixture',start:'2026-10-25T18:00',end:'2026-10-25T19:00',location:'Fixture room'}))await page.locator(`[name=${name}]`).fill(value);
  await page.locator('[name=description]').fill(campaign.description);
  await page.waitForFunction(()=>document.querySelector('.inline-preview-canvas>.ig-post .ig-caption-text')?.textContent.includes('Caption line 26')&&document.querySelector('#artwork-preview-frame').style.visibility==='visible');
  const inlinePost=page.locator('.inline-preview-canvas>.ig-post');
  assert.equal(await inlinePost.locator('.ig-account strong').textContent(),config.instagramHandle.replace(/^@/,''));
  assert.ok(await inlinePost.locator('.ig-caption').evaluate(element=>element.scrollHeight>element.clientHeight));
  await page.locator('#enlarge-preview').click();await page.waitForFunction(()=>document.querySelector('#preview-dialog').open&&document.querySelector('#artwork-preview-frame').style.visibility==='visible');
  const expandedPost=page.locator('#preview-dialog-canvas>.ig-post');assert.match(await expandedPost.locator('.ig-caption-text').textContent(),/Schedule warning fixture/);
  await expandedPost.locator('.ig-caption').focus();await page.keyboard.press('End');await page.waitForFunction(()=>document.querySelector('#preview-dialog-canvas .ig-caption').scrollTop>0);assert.ok(await expandedPost.locator('.ig-caption').evaluate(element=>element.scrollTop)>0);
  await waitForPaintedArtwork(page,'Schedule warning fixture');
  await page.screenshot({path:'test-results/campaign-controls/instagram-editor-desktop.png'});
  await page.locator('#preview-dialog [data-preview-format=story]').click();await page.waitForSelector('#preview-dialog-canvas>.ig-post.ig-story-only');
  assert.equal(await expandedPost.locator('.ig-header').isVisible(),false,'Story preview preserves the full artwork without feed chrome');
  await page.locator('#preview-dialog [data-preview-format=feed]').click();await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.querySelector('#artwork-preview-frame').style.visibility==='visible');
  assert.equal(await page.locator('#preview-dialog').evaluate(element=>element.scrollWidth<=element.clientWidth),true,'Instagram editor preview fits a phone');
  await waitForPaintedArtwork(page,'Schedule warning fixture');
  await page.screenshot({path:'test-results/campaign-controls/instagram-editor-mobile.png'});
  await page.locator('#close-preview').click();await page.setViewportSize({width:1440,height:1000});
  await page.locator('[name=groupmeAnnounce]').check();
  await page.locator('[name=feedDays]').fill('7');await page.locator('[name=feedTime]').fill('12:00');
  await page.waitForSelector('#schedule-preview .schedule-warning[data-channel=feed][data-state=missed]');
  assert.match(await page.locator('#schedule-preview .schedule-warning[data-channel=feed]').textContent(),/will not be posted/i);
  assert.equal(await page.locator('#schedule-preview .schedule-warning[data-channel=groupme][data-state=missed]').count(),1);
  await page.locator('[name=feedDays]').fill('6');await page.locator('[name=feedTime]').fill('18:00');
  await page.waitForSelector('#schedule-preview .schedule-warning[data-channel=feed][data-state=late]');
  assert.match(await page.locator('#schedule-preview .schedule-warning[data-channel=feed]').textContent(),/can still publish/i);
  await page.locator('[name=feedEnabled]').uncheck();assert.equal(await page.locator('#schedule-preview .schedule-warning[data-channel=feed]').count(),0);
  assert.equal(await page.locator('#schedule-preview .schedule-warning[data-channel=groupme]').count(),1,'Bot schedule still warns when feed is off');
  await page.locator('[name=groupmeAnnounce]').uncheck();assert.equal(await page.locator('#schedule-preview .schedule-warning[data-channel=groupme]').count(),0);
  await page.locator('[data-close=editor]').first().click();

  // A connected repository is mocked at the network boundary.
  await page.locator('[data-view=settings]').click();await page.locator('[name=token]').fill('mock-fixture-token-not-a-credential');await page.locator('#settings-form button.primary').click();
  await page.waitForFunction(()=>document.querySelector('#connection-label').textContent==='Connected');
  await page.locator('[data-view=dashboard]').click();await page.locator(`#campaign-list [data-detail="${campaign.id}"]`).click();
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('[data-delete]').click();assert.equal(writes.length,0,'Dismissed deletion cannot write');
  remote={...remote,title:'Another officer changed this event'};
  page.once('dialog',dialog=>dialog.accept());await page.locator('[data-delete]').click();await page.waitForSelector('#detail-error:not([hidden])');
  assert.match(await page.locator('#detail-error').textContent(),/edited since|changed/i);assert.equal(writes.length,0,'Concurrent content edits prevent deletion');
  remote={...structuredClone(campaign),revision:9,status:{...campaign.status,feed:'done'},results:{...campaign.results,feed:{mediaId:'fixture-receipt',publishAttemptedAt:'2026-10-18T16:00:00Z',postedAt:'2026-10-18T16:00:01Z',caption:'Already published caption'}},log:[{channel:'feed',message:'Published',at:'2026-10-18T16:00:01Z'}]};
  writeConflict=true;
  page.once('dialog',dialog=>dialog.accept());await page.locator('[data-delete]').click();await page.waitForFunction(()=>document.querySelector('#detail-error').textContent.includes('409'));
  assert.equal(await page.locator('#detail').evaluate(element=>element.open),true,'Rejected SHA write keeps campaign details open');
  assert.equal(await page.locator(`#campaign-list [data-detail="${campaign.id}"]`).count(),1,'Rejected deletion keeps campaign visible');
  writeConflict=false;
  page.once('dialog',dialog=>dialog.accept());await page.locator('[data-delete]').click();await page.waitForFunction(()=>!document.querySelector('#detail').open);
  const deleted=remote;assert.ok(deleted.deletedAt);assert.equal(deleted.cancelled,true);assert.equal(deleted.revision,10);assert.equal(deleted.results.feed.mediaId,'fixture-receipt');assert.equal(deleted.status.feed,'done');assert.equal(deleted.log[0].message,'Published');assert.equal(writes.at(-1).sha,'latest-fixture-sha');assert.equal(writes.at(-1).branch,'main');
  assert.equal(await page.locator(`#campaign-list [data-detail="${campaign.id}"]`).count(),0);
  await page.locator('[data-view=archive]').click();assert.equal(await page.locator(`#archive-list [data-detail="${campaign.id}"]`).count(),0);
  await page.reload();await page.waitForSelector('#campaign-list .empty');assert.equal(await page.locator('[data-detail]').count(),0,'Deleted tombstone stays hidden after reload');
  assert.deepEqual(errors,[]);
  console.log('Campaign control checks passed: Instagram editor/detail previews, scrollable captions, carousel, mobile layouts, missed-window warnings, late catch-up, disabled channels, confirmed deletion, preview protection, content conflicts, SHA rejection, receipt preservation, and reload persistence.');
 }finally{await context.close();}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {chromium}=await import('playwright'),port=4283,base=`http://127.0.0.1:${port}`;
 const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});
 let browser;
 try{
  for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
  browser=await chromium.launch({headless:true});await checkCampaignControls(browser,base);
 }finally{if(browser)await browser.close();server.kill();}
}
