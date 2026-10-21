import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

async function swipe(page,locator,dx,dy=0){
 await locator.scrollIntoViewIfNeeded();
 const box=await locator.boundingBox();assert.ok(box&&box.width>80&&box.height>80);
 const x=box.x+box.width*(dx<0?.78:.22),y=box.y+box.height*.55;
 const session=await page.context().newCDPSession(page);
 try{
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:0}]});
  for(let step=1;step<=5;step++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*step/5,y:y+dy*step/5,id:0}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }finally{await session.detach();}
}
const position=post=>post.locator('.ig-position');


export async function checkPreviewPane(browser,base){
 const context=await browser.newContext({viewport:{width:1440,height:1000},hasTouch:true,reducedMotion:'reduce'});
 try{
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let requests=0;
  await page.clock.install({time:new Date('2026-10-20T15:00:00Z')});
  await page.route('https://api.github.com/**',route=>{requests++;return route.abort();});
  const pngs=await page.evaluate(()=>['#ac2038','#1264a3','#267a44'].map((color,index)=>{const c=document.createElement('canvas');c.width=640;c.height=800;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,640,800);x.fillStyle='white';x.font='bold 60px sans-serif';x.fillText('IMAGE '+(index+1),80,350);return c.toDataURL('image/png').split(',')[1];}));
  const images=pngs.map(x=>Buffer.from(x,'base64'));
  const campaign={id:'preview-swipe-fixture',year:'2026-27',type:'gbm',title:'Swipe preview fixture',start:'2026-11-20T23:30:00Z',end:'2026-11-21T01:00:00Z',location:{name:'Fixture room'},description:'Review the carousel and message.',food:false,revision:1,campaign:{feed:{enabled:true,daysBefore:7,time:'12:00'},story:{enabled:true,daysBefore:3,time:'12:00'},groupme:{enabled:true,announce:true}},status:{feed:'pending',story:'pending',groupme:'pending'},results:{feed:{caption:Array.from({length:25},(_,i)=>`Recorded caption line ${i+1}: meet and build together.`).join('\n'),images:[1,2,3].map(i=>`https://swipe.example/${i}.png`)}},log:[]};
  await page.route('https://swipe.example/**',route=>route.fulfill({contentType:'image/png',body:images[Number(new URL(route.request().url()).pathname.slice(1,2))-1]}));
  await page.route('**/config/chapter.json',async route=>{const r=await route.fetch(),c=await r.json();c.integrations.groupme={...c.integrations.groupme,enabled:true,mode:'bot'};return route.fulfill({json:c});});
  await page.route('**/data/archive-index.json',route=>route.fulfill({json:{campaigns:[campaign]}}));
  await page.route('**/data/candidates.json',route=>route.fulfill({json:{events:[],changes:[]}}));
  await page.goto(base);await page.locator(`[data-detail="${campaign.id}"]`).first().click();
  const detail=page.locator('#detail-instagram-preview .ig-post'),detailMedia=detail.locator('.ig-media');
  await detail.locator('.ig-detail-image img').evaluate(img=>img.decode());
  assert.equal(await position(detail).textContent(),'1 / 3');
  await detail.locator('.ig-caption').evaluate(el=>{el.scrollTop=70;window.previewCaptionScroll=el.scrollTop;window.previewCaptionText=el.querySelector('.ig-caption-text').firstChild;});
  await detail.locator('.ig-avatar').evaluate(el=>window.previewAvatar=el.firstChild);
  await swipe(page,detailMedia,-130);await page.waitForFunction(()=>document.querySelector('#detail-instagram-preview .ig-position').textContent==='2 / 3');assert.equal(await detail.locator('.ig-detail-image img').getAttribute('src'),'https://swipe.example/2.png');
  assert.equal(await page.locator('#detail-artwork-dialog[open]').count(),0,'Swiping wrapped feed artwork does not open the enlargement dialog');
  assert.equal(await detail.locator('.ig-caption').evaluate(el=>el.scrollTop===window.previewCaptionScroll&&el.querySelector('.ig-caption-text').firstChild===window.previewCaptionText),true,'Changing images preserves caption reading position');
  assert.equal(await detail.locator('.ig-avatar').evaluate(el=>el.firstChild===window.previewAvatar),true,'Changing images does not reload the account avatar');
  for(const selector of ['.ig-previous','.ig-next']){const box=await detail.locator(selector).boundingBox();assert.ok(box.width>=44&&box.height>=44,'Carousel controls have44px touch targets');}
  await swipe(page,detailMedia,-130);await page.waitForFunction(()=>document.querySelector('#detail-instagram-preview .ig-position').textContent==='3 / 3');
  await swipe(page,detailMedia,-130);assert.equal(await position(detail).textContent(),'3 / 3','last image does not overflow');
  await swipe(page,detailMedia,130);await page.waitForFunction(()=>document.querySelector('#detail-instagram-preview .ig-position').textContent==='2 / 3');
  await detailMedia.focus();await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>document.querySelector('#detail-instagram-preview .ig-position').textContent==='1 / 3');
  await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.querySelector('#detail-instagram-preview .ig-position').textContent==='2 / 3');
  await swipe(page,detailMedia,0,-70);assert.equal(await position(detail).textContent(),'2 / 3','vertical movement does not select another image');
  // A tap after a swipe still opens the selected image, while the swipe click is suppressed.
  await detail.locator('.detail-artwork-trigger').click();
  const detailEnlarged=page.locator('#detail-artwork-dialog');await detailEnlarged.waitFor({state:'visible'});
  assert.equal(await detailEnlarged.locator('.ig-position').textContent(),'2 / 3');
  await detailEnlarged.locator('.detail-artwork-close').click();await detailEnlarged.waitFor({state:'hidden'});
  await page.locator('[data-edit]').click();
  await page.locator('[name=flyer]').setInputFiles(images.map((buffer,index)=>({name:`image-${index+1}.png`,mimeType:'image/png',buffer})));
  await page.waitForFunction(()=>document.querySelectorAll('#flyer-image-list .flyer-image-pick').length===3);
  const feed=page.locator('.inline-preview-canvas > .ig-post'),media=feed.locator('.ig-media');
  await page.waitForFunction(()=>document.querySelector('.inline-preview-canvas .ig-position')?.textContent==='1 / 3');
  await swipe(page,media,-110);await page.waitForFunction(()=>document.querySelector('.inline-preview-canvas .ig-position')?.textContent==='2 / 3');
  assert.equal(await page.locator('#flyer-image-list .flyer-image-pick').nth(1).getAttribute('aria-pressed'),'true');
  await page.waitForFunction(()=>{const image=document.querySelector('#artwork-preview-frame').contentDocument?.querySelector('img.uploaded-feed'),selected=document.querySelectorAll('#flyer-image-list .flyer-image-pick img')[1];return image?.complete&&image.naturalWidth===640&&image.src===selected.src&&document.querySelector('#artwork-preview-frame').style.visibility==='visible';});
  await page.locator('#enlarge-preview').click();
  const expanded=page.locator('#preview-dialog-canvas > .ig-post');
  await swipe(page,expanded.locator('.ig-media'),-180);await page.waitForFunction(()=>document.querySelector('#preview-dialog-canvas .ig-position')?.textContent==='3 / 3');
  await page.locator('#preview-dialog [data-preview-format=groupme]').click();
  assert.equal(await page.locator('#preview-dialog #groupme-message-preview').isVisible(),true);
  await page.locator('#close-preview').click();
  await page.locator('#artwork-preview [data-preview-format=groupme]').click();
  const groupme=page.locator('#groupme-preview-panel');
  assert.equal(await groupme.locator('..').evaluate(el=>Boolean(el.closest('.editor-preview-pane'))),true,'GroupMe shares the right preview pane');
  assert.equal(await groupme.isVisible(),true);assert.match(await groupme.locator('.gm-message-text').textContent(),/Swipe preview fixture/);
  for(const name of ['feed','story','groupme'])assert.ok(await page.locator(`#artwork-preview [data-preview-format=${name}] svg`).count(),name+' has an icon');
  await mkdir('test-results/preview-pane',{recursive:true});await page.screenshot({path:'test-results/preview-pane/groupme-desktop.png'});
  await page.locator('#artwork-preview [data-preview-format=story]').click();await page.waitForFunction(()=>document.querySelector('#artwork-preview-frame').style.visibility==='visible');
  assert.equal(await groupme.isVisible(),false);await page.locator('#artwork-preview [data-preview-format=feed]').click();
  await page.setViewportSize({width:390,height:844});await page.locator('#mobile-preview').click();
  const mobilePost=page.locator('#preview-dialog-canvas > .ig-post');
  await swipe(page,mobilePost.locator('.ig-media'),130);await page.waitForFunction(()=>document.querySelector('#preview-dialog-canvas .ig-position')?.textContent==='2 / 3');
  await page.locator('#preview-dialog [data-preview-format=groupme]').click();assert.equal(await page.locator('#preview-dialog #groupme-preview-panel').isVisible(),true);
  assert.equal(await page.locator('#preview-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true,'mobile preview has no horizontal overflow');
  await page.screenshot({path:'test-results/preview-pane/groupme-mobile.png'});
  // Inspect every preview type at narrow-phone, tablet, and short-landscape sizes.
  for(const [width,height]of [[320,640],[390,844],[768,1024],[844,390],[667,320]]){
   await page.setViewportSize({width,height});
   for(const format of ['feed','story','groupme']){
    await page.locator(`#preview-dialog [data-preview-format=${format}]`).click();
    await page.waitForFunction(format=>document.querySelector('#preview-dialog').dataset.format===format,format);
    if(format!=='groupme'){await page.waitForFunction(()=>document.querySelector('#artwork-preview-frame').style.visibility==='visible');const mediaBox=await page.locator('.expanded-preview-stage').boundingBox();assert.ok(mediaBox.width>=(format==='feed'?150:90)&&mediaBox.height>=120,`${width}x${height} ${format}: artwork stays large enough to inspect`);}
    const layout=await page.locator('#preview-dialog').evaluate(dialog=>{
     const controls=[...dialog.querySelectorAll('.preview-dialog-heading button,.preview-dialog-heading select')].filter(el=>el.getClientRects().length);
     return {fits:dialog.scrollWidth<=dialog.clientWidth,controls:controls.map(el=>{const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {label:el.textContent.trim()||el.getAttribute('aria-label'),x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,reachable:hit===el||el.contains(hit)};})};
    });
    assert.equal(layout.fits,true,`${width}x${height} ${format}: no horizontal overflow`);
    for(const control of layout.controls){assert.ok(control.x>=0&&control.y>=0&&control.right<=width+1&&control.bottom<=height+1,`${width}x${height} ${format}: ${control.label} stays on screen`);assert.equal(control.reachable,true,`${width}x${height} ${format}: ${control.label} is not covered by the preview`);assert.ok(control.height>=44,`${width}x${height} ${format}: ${control.label} has44px height`);}
    for(let i=0;i<layout.controls.length;i++)for(let j=i+1;j<layout.controls.length;j++){const a=layout.controls[i],b=layout.controls[j],overlap=Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1;assert.equal(overlap,false,'Preview controls do not overlap');}
   }
   await page.screenshot({path:`test-results/preview-pane/polish-${width}-${height}.png`});
  }
  assert.equal(requests,0);assert.deepEqual(errors,[]);
  console.log('Preview pane checks passed: GroupMe in shared right-hand/enlarged pane, icon labels, uploaded three-image swipe, detail swipe, bounds, keyboard navigation, vertical scroll, and mobile touch gestures.');
 }finally{await context.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {chromium}=await import('playwright'),port=4285,base=`http://127.0.0.1:${port}`;
 const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});let browser;
 try{for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}browser=await chromium.launch({headless:true});await checkPreviewPane(browser,base);}finally{if(browser)await browser.close();server.kill();}
}
