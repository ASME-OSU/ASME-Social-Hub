import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true});
try{
 for(const theme of ['light','dark'])for(const [width,height]of [[1440,900],[768,1024],[390,844],[320,640],[667,320]]){
  const context=await browser.newContext({viewport:{width,height},colorScheme:theme}),page=await context.newPage();let writes=0;const errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.route('https://api.github.com/**',route=>{writes++;return route.abort();});
  await page.goto('http://127.0.0.1:4275/');const opener=page.locator('#hub-guide-button');await opener.click();const dialog=page.locator('#hub-guide');assert.ok(await dialog.isVisible());assert.match(await page.locator('#guide-start').innerText(),/New campaign/);
  const box=await opener.boundingBox();assert.ok(box.width>=44&&box.height>=44);
  await page.locator('#guide-tab-start').press('ArrowRight');assert.equal(await page.locator('#guide-tab-connect').getAttribute('aria-selected'),'true');assert.ok(await page.locator('#guide-connect').isVisible());
  const link=await page.locator('#guide-connect .guide-primary').getAttribute('href');assert.ok(link.includes('actions=write')&&link.includes('contents=write'));
  assert.equal(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth),true,`${theme} ${width} guide fits`);
  assert.equal(await page.locator('#guide-connect').evaluate(e=>e.scrollWidth<=e.clientWidth),true,'PAT content fits');
  await page.locator('#guide-tab-access').click();assert.match(await page.locator('#guide-access').innerText(),/Without a PAT/);assert.match(await page.locator('#guide-access').innerText(),/can be bypassed/);
  await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'hub-guide-button');
  await page.locator('[data-view=settings]').click();await page.locator('[data-open-guide=connect]').click();assert.equal(await page.locator('#guide-tab-connect').getAttribute('aria-selected'),'true');await page.locator('[data-close-guide]').click();
  assert.equal(await page.locator('[data-open-guide=connect]').evaluate(e=>e===document.activeElement),true);
  await page.locator('.token-guide>summary').click();assert.match(await page.locator('#token-guide-content').innerText(),/ASME-Social-Hub/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Settings fits screen');assert.equal(writes,0);assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log('Hub guide passed: desktop/tablet/phone/landscape in both themes; 44px entry point; keyboard tabs; Escape/focus return; complete PAT settings; no token requests or writes.');
}finally{await browser.close();}
