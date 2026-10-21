import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {flyerHtml,fitFlyer,loadFlyerAssets} from './render-flyers.mjs';

async function waitForPaintedStory(page,title){
 await page.waitForFunction(expected=>{const frame=document.querySelector('#artwork-preview-frame'),doc=frame?.contentDocument;return frame?.style.visibility==='visible'&&doc?.readyState==='complete'&&doc.querySelector('.text-story')&&doc.querySelector('h1')?.textContent===expected&&doc.querySelector('h1').getBoundingClientRect().height>0;},title);
 await page.evaluate(async()=>{const doc=document.querySelector('#artwork-preview-frame').contentDocument;await doc.fonts.ready;await Promise.all([...doc.images].map(image=>image.decode()));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
 const pixels=await page.locator('#artwork-preview-frame').screenshot();
 const bright=await page.evaluate(async base64=>{const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();const canvas=document.createElement('canvas');canvas.width=64;canvas.height=128;const context=canvas.getContext('2d');context.drawImage(img,0,0,64,128);const data=context.getImageData(0,0,64,128).data;let bright=0;for(let i=0;i<data.length;i+=4)if(data[i]>170&&data[i+1]>170&&data[i+2]>170)bright++;return bright;},pixels.toString('base64'));
 assert.ok(bright>10,'Story preview contains painted type, including after iframe reparenting');
}

export async function checkStoryEmptyMedia(browser,base){
 const config=JSON.parse(await readFile('config/chapter.json','utf8')),template=await readFile('templates/refined-blueprint.html','utf8'),assets=await loadFlyerAssets(process.cwd(),config);
 await mkdir('test-results/story-empty-media',{recursive:true});
 const render=await browser.newPage({viewport:{width:1080,height:1920}});
 try{
  for(const background of ['template','color-wash','blueprint-rings','folded-paper']){
   const campaign={title:'Meet the engineers',description:'Career stories, practical advice, and good conversations.',start:'2026-10-22T22:00:00Z',type:'industry-night',location:{name:'Scott Laboratory · E100'},food:true,storyDesign:{background}};
   await render.setContent(flyerHtml(template,campaign,config,'story',assets));await fitFlyer(render);
   assert.equal(await render.locator('svg,img').count(),0,'Text-only Story avoids arbitrary symbols and missing media');
   assert.equal(await render.locator('.hero').evaluate(hero=>getComputedStyle(hero).backgroundColor),'rgba(0, 0, 0, 0)','Text is the artwork, without an empty image-card background');
   assert.ok(await render.locator('.cell small').first().evaluate(label=>parseFloat(getComputedStyle(label).fontSize)>=26),'Date/location labels stay readable');
   const layout=await render.evaluate(()=>{const hero=document.querySelector('.hero').getBoundingClientRect(),title=document.querySelector('h1').getBoundingClientRect(),block=document.querySelector('.block').getBoundingClientRect(),footer=document.querySelector('footer').getBoundingClientRect();return {hero:hero.toJSON(),title:title.toJSON(),block:block.toJSON(),footer:footer.toJSON()};});
   assert.ok(layout.hero.height>650,'The text layout fills the Story rather than collapsing to its top');
   assert.ok(layout.title.top>400&&layout.title.bottom<layout.block.top,'Title sits in the central readable area');
   assert.ok(layout.footer.bottom<=1621,'Footer stays clear of platform controls');
   await render.screenshot({path:`test-results/story-empty-media/${background}-artwork.png`});
  }
  const long={title:'An evening of mechanical engineering design, professional connections, and practical ideas for your first project',description:'Explore projects, hear from engineers, and learn how to start building your own ideas with the chapter.',start:'2026-10-22T22:00:00Z',type:'industry-night',location:{name:'Scott Laboratory · Engineering collaboration room E100'},food:true,advertising:{benefit:'Practice design, meet new people, and build professional connections.',speaker:'Chapter alumni panel',audience:'All engineering students',cost:'Free',foodDetails:'Pizza and vegetarian options',rsvpDeadline:'2026-10-21T17:00:00-04:00'},storyDesign:{background:'color-wash'}};
  await render.setContent(flyerHtml(template,long,config,'story',assets));await fitFlyer(render);
  await render.screenshot({path:'test-results/story-empty-media/long-artwork.png'});
  assert.ok(await render.locator('h1').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=72),'Long titles retain readable type');
  assert.ok(await render.locator('.desc').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=38),'Descriptions retain readable type');
  for(const name of ['blueprint','editorial','refined-blueprint','editorial-poster','assembly-card']){
   const source=await readFile(`templates/${name}.html`,'utf8');
   await render.setContent(flyerHtml(source,{...long,storyDesign:{background:'template'}},config,'story',assets));await fitFlyer(render);
   assert.equal(await render.locator('.text-story').count(),1,`${name} uses the clean no-flyer layout`);
   await render.screenshot({path:`test-results/story-empty-media/${name}-no-flyer.png`});
  }
  assert.ok(await render.locator('.title-card').evaluate(card=>{const hero=card.parentElement;return card.getBoundingClientRect().top>=hero.getBoundingClientRect().top&&card.getBoundingClientRect().bottom<=hero.getBoundingClientRect().bottom;}),'Long no-media copy remains inside its Story text region');
 }finally{await render.close();}
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});
  try{
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base);await page.locator('#new-campaign:not([disabled])').waitFor();await page.locator('#new-campaign').click();
   await page.locator('#editor [data-preview-format=story]').click();
   await page.waitForFunction(()=>{const frame=document.querySelector('#artwork-preview-frame');return frame.style.visibility==='visible'&&frame.contentDocument?.querySelector('.text-story');});
   assert.equal(await page.frameLocator('#artwork-preview-frame').locator('svg').count(),0);
   assert.match(await page.frameLocator('#artwork-preview-frame').locator('.block').textContent(),/Choose a date/);
   const stage=await page.locator('#artwork-preview-frame').evaluate(frame=>frame.parentElement.getBoundingClientRect().toJSON());
   assert.ok(Math.abs(stage.width/stage.height-9/16)<.01,'Empty preview retains its9:16 frame');
   if(width===390)await page.locator('#enlarge-preview').click();
   await waitForPaintedStory(page,'Your event title');
   await page.screenshot({path:`test-results/story-empty-media/empty-${width}.png`});
   if(await page.locator('#preview-dialog').evaluate(dialog=>dialog.open))await page.locator('#close-preview').click();
   for(const [name,value]of Object.entries({title:'Meet the engineers',start:'2026-10-22T18:00',end:'2026-10-22T19:30',location:'Scott Laboratory · E100',description:'Career stories, practical advice, and good conversations.'}))await page.locator(`[name=${name}]`).fill(value);
   await page.locator('[name=storyBackground][value=color-wash]').check();
   await page.waitForFunction(()=>{const frame=document.querySelector('#artwork-preview-frame');return frame.style.visibility==='visible'&&frame.contentDocument?.querySelector('.text-story')&&frame.contentDocument.querySelector('h1')?.textContent==='Meet the engineers';});
   if(width===1440){
    await page.locator('[data-editor-section=event]').click();
    const bounds=await page.locator('#editor').evaluate(editor=>({dialog:editor.getBoundingClientRect().toJSON(),header:editor.querySelector('.dialog-heading').getBoundingClientRect().toJSON(),nav:editor.querySelector('.editor-section-nav').getBoundingClientRect().toJSON(),footer:editor.querySelector('.dialog-footer').getBoundingClientRect().toJSON(),scrollTop:editor.scrollTop}));
    assert.equal(bounds.scrollTop,0,'Section navigation scrolls the field pane, never the outer editor');
    assert.ok(bounds.header.top>=bounds.dialog.top-.5&&bounds.nav.top>=bounds.header.bottom-.5,'Editor heading and section navigation stay in view after section selection');
    assert.ok(bounds.footer.bottom<=bounds.dialog.bottom+1&&bounds.footer.bottom>=bounds.dialog.bottom-8,'Save actions stay anchored to the editor bottom');
   }
   await waitForPaintedStory(page,'Meet the engineers');
   await page.screenshot({path:`test-results/story-empty-media/complete-${width}.png`});
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }
 console.log('No-media Story checks passed: full9:16 frame, central text, clean placeholder, safe-area fitting, desktop/phone.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {chromium}=await import('playwright'),port=4299,base=`http://127.0.0.1:${port}`,server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});let browser;
 try{for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}browser=await chromium.launch({headless:true});await checkStoryEmptyMedia(browser,base);}finally{if(browser)await browser.close();server.kill();}
}
