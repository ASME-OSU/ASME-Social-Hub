import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
 for(const viewport of [{width:1440,height:900},{width:1280,height:720},{width:1024,height:768},{width:390,height:844}]){
  const context=await browser.newContext({viewport}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4275/');await page.getByRole('button',{name:'View campaign: ASME Scheduling/BuckeyeLink Tour',exact:true}).click();
  const link=page.locator('#detail-event-page');assert.ok(await link.isVisible());assert.equal(await link.getAttribute('target'),'_blank');assert.match(await link.getAttribute('href'),/\/events\/2026-27\/2026-10-22-asme-scheduling-buckeyelink-tour\/$/);
  assert.equal(await page.locator('#detail').evaluate(e=>e.scrollWidth<=e.clientWidth),true,'Detail heading fits');
  await page.locator('#detail .ig-detail-image>img').evaluate(img=>img.decode());const drawerFit=await page.evaluate(()=>{const image=document.querySelector('#detail .ig-detail-image>img').getBoundingClientRect(),footer=document.querySelector('#detail-actions').getBoundingClientRect(),heading=document.querySelector('#detail .dialog-heading').getBoundingClientRect();return image.top>=heading.bottom&&image.bottom<=footer.top+2;});assert.ok(drawerFit,'Whole drawer flyer fits above its actions');
  const popupReady=page.waitForEvent('popup');await link.click();const popup=await popupReady;await popup.waitForLoadState('domcontentloaded');assert.equal(await popup.locator('h1').innerText(),'ASME Scheduling/BuckeyeLink Tour');await popup.close();
  await page.getByRole('button',{name:'Edit',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#artwork-preview-frame').style.visibility==='visible');
  if(viewport.width>=960){
   const layout=await page.locator('#artwork-preview .preview-formats').evaluate(e=>[...e.querySelectorAll('button,select')].filter(x=>x.getClientRects().length).map(x=>{const b=x.getBoundingClientRect();return {label:x.getAttribute('aria-label')||x.textContent.trim(),top:b.top,height:b.height};}));
   assert.ok(layout.every(x=>x.height<=36),JSON.stringify(layout));assert.ok(Math.max(...layout.map(x=>x.top))-Math.min(...layout.map(x=>x.top))<=2,'Toolbar stays on one row');
   const fits=await page.evaluate(()=>{const f=document.querySelector('#artwork-preview-frame').getBoundingClientRect(),c=document.querySelector('.inline-preview-canvas').getBoundingClientRect();return f.top>=c.top-2&&f.bottom<=c.bottom+2&&f.left>=c.left-2&&f.right<=c.right+2;});assert.ok(fits,'Complete flyer remains fitted');console.log(viewport.width,JSON.stringify(layout));
  }else{
   await page.locator('#mobile-preview').click();const heights=await page.locator('#preview-dialog .preview-dialog-heading').evaluate(e=>[...e.querySelectorAll('button,select')].filter(x=>x.getClientRects().length).map(x=>x.getBoundingClientRect().height));assert.ok(heights.every(h=>h>=44),'Phone controls stay easy to tap');
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Compact preview passed: saved event links open the correct member page; one-row 32px desktop controls; full flyer fit; phone touch sizes; no console errors.');
}finally{await browser.close();}
