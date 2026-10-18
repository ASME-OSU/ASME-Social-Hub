import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

export async function checkEditorLayout(browser,base){
 await mkdir('test-results/editor-review',{recursive:true});
 for(const theme of ['light','dark'])for(const [width,height]of [[1440,1000],[1440,600],[1280,720],[1024,800],[900,900],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},colorScheme:theme,reducedMotion:'reduce'});
  try{
   const page=await context.newPage();
   await page.route('**/data/archive-index.json',r=>r.fulfill({json:{campaigns:[]}}));
   await page.route('**/data/candidates.json',r=>r.fulfill({json:{events:[],changes:[]}}));
   await page.goto(base);await page.locator('#new-campaign:not([disabled])').click();
   const contrasts=await page.evaluate(()=>{
    const rgb=color=>{const c=document.createElement('canvas'),x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,1,1);return [...x.getImageData(0,0,1,1).data].slice(0,3);};
    const lum=color=>rgb(color).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const ratio=(a,b)=>{const values=[lum(a),lum(b)].sort((a,b)=>b-a);return(values[0]+.05)/(values[1]+.05);};
    const root=getComputedStyle(document.documentElement),panel=getComputedStyle(document.querySelector('.editor-preview-pane')),button=getComputedStyle(document.querySelector('#editor [data-preview-format][aria-pressed=true]'));
    return {focus:ratio(root.getPropertyValue('--focus'),panel.backgroundColor),selection:ratio(button.backgroundColor,panel.backgroundColor),text:ratio(button.color,button.backgroundColor)};
   });
   assert.ok(contrasts.focus>=3,'Focus outline meets 3:1');assert.ok(contrasts.selection>=3,'Selected preview state is distinct from its panel');assert.ok(contrasts.text>=4.5,'Selected preview text is readable');

   for(const [name,value]of Object.entries({title:'Design Night — review example',description:'Build an idea, test an assembly, and meet other engineers.',location:'Scott E100',start:'2026-11-20T18:30',end:'2026-11-20T20:00'}))await page.locator(`[name=${name}]`).fill(value);
   const image=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=800;const x=c.getContext('2d');x.fillStyle='#123d44';x.fillRect(0,0,640,800);x.fillStyle='#ffb44b';x.fillRect(0,550,640,250);x.fillStyle='#fff';x.font='bold 60px sans-serif';x.fillText('DESIGN NIGHT',50,160);x.font='26px sans-serif';x.fillText('EXAMPLE ARTWORK',50,220);x.fillStyle='#123d44';x.fillText('FRIDAY · NOV 20',50,630);x.fillText('6:30 PM · Scott E100',50,680);return c.toDataURL('image/png').split(',')[1];}),'base64');
   await page.locator('[name=flyer]').setInputFiles({name:'review-example.png',mimeType:'image/png',buffer:image});
   await page.locator('[name=storyBackground][value=color-wash]').check();
   if(width<960)await page.locator('#close-preview').click();
   await page.waitForFunction(()=>document.querySelector('#story-palette-note').textContent.startsWith('Colors sampled'));
   await page.waitForFunction(()=>document.querySelector('#artwork-preview-frame').style.visibility==='visible'&&document.querySelector('#artwork-preview-frame').contentDocument?.querySelector('.color-wash'));
   assert.equal(await page.locator('#editor').evaluate(e=>e.scrollWidth<=e.clientWidth),true,`${width}: no horizontal overflow`);
   const fields=page.locator('.editor-fields'),pane=page.locator('.editor-preview-pane');
   const a=await fields.boundingBox(),b=await pane.boundingBox();
   if(width>=960){
    assert.ok(b.x>=a.x+a.width-1,'Preview is to the right of the fields');assert.ok(Math.abs(a.y-b.y)<2);
    const previewTop=(await page.locator('#artwork-preview').boundingBox()).y;
    await fields.evaluate(e=>e.scrollTop=e.scrollHeight);
    assert.equal((await page.locator('#artwork-preview').boundingBox()).y,previewTop,'Preview stays visible when fields scroll');
    const footer=await page.locator('#editor .dialog-footer').boundingBox();assert.ok(footer.y+footer.height<=height+1,'Save controls stay in viewport');
    const stage=await page.locator('.artwork-preview-stage').boundingBox();if(height>=800)assert.ok(stage.y+stage.height<=footer.y+1,`Story fits above save controls at ${width}: ${JSON.stringify({stage,footer})}`);
    await fields.evaluate(e=>e.scrollTop=0);
   }else{assert.ok(b.y>=a.y+a.height-1,'Small screens stack fields above preview');await page.locator('#artwork-preview').scrollIntoViewIfNeeded();}
   await page.screenshot({path:`test-results/editor-review/${theme}-${width}-${height}-story.png`,animations:'disabled'});
   await page.locator('#enlarge-preview').click();await page.waitForFunction(()=>document.querySelector('#preview-dialog').open&&document.querySelector('#preview-dialog .expanded-preview-stage iframe')?.style.visibility==='visible');
   await page.locator('#preview-zoom').selectOption('1');assert.equal(Math.round((await page.locator('.expanded-preview-stage').boundingBox()).width),1080,'100% zoom exposes the native artwork width');
   await page.locator('#preview-dialog-canvas').focus();await page.keyboard.press('PageDown');await page.waitForTimeout(100);assert.ok(await page.locator('#preview-dialog-canvas').evaluate(e=>e.scrollTop)>0,'Enlarged canvas scrolls from keyboard');
   await page.locator('#preview-zoom').selectOption('fit');
   await page.screenshot({path:`test-results/editor-review/${theme}-${width}-${height}-enlarged.png`,animations:'disabled'});
   await page.keyboard.press('Escape');assert.equal(await page.locator('#preview-dialog').evaluate(e=>e.open),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'enlarge-preview','Escape returns focus to opener');
   if(width===1440&&height===1000){
    const tall=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=1200;c.getContext('2d').fillRect(0,0,640,1200);return c.toDataURL('image/png').split(',')[1];}),'base64');
    await page.locator('[name=flyer]').setInputFiles({name:'tall.png',mimeType:'image/png',buffer:tall});await page.waitForSelector('#feed-image-note:not([hidden])');await page.locator('#save-button').click();await page.waitForSelector('#form-error:not([hidden])');assert.match(await page.locator('#form-error').textContent(),/Story only/);
    await page.locator('[name=feedEnabled]').uncheck();await page.waitForFunction(()=>document.querySelector('#feed-image-note').hidden);await page.locator('#save-button').click();assert.doesNotMatch(await page.locator('#form-error').textContent(),/publishing range/);await page.locator('[name=feedEnabled]').check();await page.locator('[name=flyer]').setInputFiles({name:'review-example.png',mimeType:'image/png',buffer:image});
   }
   await page.locator('#advertising-details').evaluate(e=>e.open=true);await page.locator('[name=rsvpUrl]').fill('not a url');await page.locator('#advertising-details').evaluate(e=>e.open=false);await page.locator('#save-button').click();
   assert.equal(await page.locator('#advertising-details').evaluate(e=>e.open),true,'Invalid collapsed fields are revealed');assert.match(await page.locator('#form-error').textContent(),/RSVP/);await page.locator('[name=rsvpUrl]').fill('');await page.locator('#advertising-details').evaluate(e=>e.open=false);

   await page.locator('#editor [data-preview-format=feed]').click();
   await page.waitForFunction(()=>document.querySelector('#artwork-preview-frame').style.visibility==='visible'&&document.querySelector('#artwork-preview-frame').contentDocument?.querySelector('.uploaded-feed'));
   assert.match(await page.locator('#artwork-preview-caption').textContent(),/1080 × 1350/);
   const revision=await page.locator('#artwork-preview-frame').getAttribute('srcdoc');
   await page.locator('[name=notes]').fill('Review-only notes');await page.waitForTimeout(250);
   assert.equal(await page.locator('#artwork-preview-frame').getAttribute('srcdoc'),revision,'Handoff notes do not rebuild artwork');
   await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('.editor-preview-pane')),true,'Keyboard moves from the last field to the scrollable preview region');
   if(width>=960)await fields.evaluate(e=>e.scrollTop=0);else await page.locator('#artwork-preview').scrollIntoViewIfNeeded();
   await page.screenshot({path:`test-results/editor-review/${theme}-${width}-${height}-feed.png`,animations:'disabled'});
  }finally{await context.close();}
 }
 console.log('Editor layout checks passed: split panes, stable preview, stacked tablet/mobile, saved action visibility, themes, and unchanged artwork on notes edits.');
}
