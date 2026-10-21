import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
for(const [width,height] of [[1440,900],[1280,720],[1024,768],[390,844],[667,320]]){
 const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>console.error('PAGE ERROR',e.message));
 await page.goto('http://127.0.0.1:4275/');await page.locator('#new-campaign:not([disabled])').click();
 await page.locator('[name=location]').fill('Scott E100');await page.locator('[name=title]').fill('Local layout review');await page.locator('[name=start]').fill('2026-11-20T18:00');await page.locator('[name=end]').fill('2026-11-20T19:00');
 await page.waitForFunction(()=>document.querySelector('#artwork-preview-frame').style.visibility==='visible');
 if(await page.locator('#preview-dialog').isVisible())await page.locator('#close-preview').click();
 assert.equal(await page.locator('[data-editor-section]').count(),5);for(const button of await page.locator('[data-editor-section]').all())assert.ok(await button.isVisible());
 if(width<960)await page.locator('#mobile-preview').click();
 const check=async()=>{await page.waitForTimeout(400);return page.evaluate(()=>{const f=document.querySelector('#artwork-preview-frame').getBoundingClientRect(),open=document.querySelector('#preview-dialog').open,c=document.querySelector(open?'#preview-dialog-canvas':'.inline-preview-canvas').getBoundingClientRect();return {frame:{x:f.x,y:f.y,width:f.width,height:f.height},canvas:{x:c.x,y:c.y,width:c.width,height:c.height},fits:f.top>=c.top-2&&f.bottom<=c.bottom+2&&f.left>=c.left-2&&f.right<=c.right+2};});};
 let g=await check();console.log(width,height,'FEED',JSON.stringify(g));assert.ok(g.fits,'Feed fits');
 await page.locator((width<960?'#preview-dialog':'#editor')+' [data-preview-format=story]').click();g=await check();console.log('STORY',JSON.stringify(g));assert.ok(g.fits,'Story fits');
 if(width>=960)await page.locator('#enlarge-preview').click();
 await page.locator('#preview-dialog [data-preview-format=feed]').click();await page.locator('#expanded-toggle-preview-caption').click();assert.equal(await page.locator('#expanded-toggle-preview-caption').textContent(),'Hide caption');
 await page.locator('#close-preview').click();await page.locator('[data-editor-section=groupme]').click();
 const popupPromise=page.waitForEvent('popup');await page.locator('#open-campaign-event-page').click();const popup=await popupPromise;await popup.waitForLoadState();assert.match(await popup.locator('h1').innerText(),/Local layout review/);assert.ok((await popup.locator('a[download]').getAttribute('href')).endsWith('.ics'));await popup.close();
 if(width===1440){assert.equal(await page.locator('[name=groupmeEventPage]').count(),0,'One member link is standard for every announcement');await page.locator('#save-button').click();await page.waitForFunction(()=>!document.querySelector('#editor').open);await page.reload();await page.getByRole('button',{name:'View campaign: Local layout review',exact:true}).click();await page.locator('[data-edit]').click();assert.equal(await page.locator('[name=title]').inputValue(),'Local layout review','Local draft survives reload');}
 await page.screenshot({path:`/tmp/asme-restored-${width}.png`});await page.close();
}
}finally{await browser.close();}
