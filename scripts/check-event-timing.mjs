import assert from 'node:assert/strict';

export async function checkEventTiming(browser,base){
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',timezoneId:'America/Los_Angeles'});
 try{
  const page=await context.newPage(),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-24T16:00:00Z')});
  await page.route('https://api.github.com/**',r=>{writes.push(r.request().method());return r.abort();});
  await page.goto(base);await page.locator('#new-campaign').click();
  for(const [name,value] of Object.entries({title:'Timing fixture',location:'Scott E100',start:'2026-11-20T18:30',end:'2026-11-20T18:00'}))await page.locator(`[name=${name}]`).fill(value);
  const start=page.locator('[name=start]'),end=page.locator('[name=end]'),warning=page.locator('#event-time-warning');
  assert.equal(await end.getAttribute('min'),'2026-11-20T18:31');
  for(const value of ['2026-11-20T18:00','2026-11-20T18:30','2026-11-19T20:00']){
   await end.fill(value);assert.equal(await warning.isVisible(),true);assert.match(await warning.textContent(),/End time must be after/);
   await page.locator('#save-button').click();assert.equal(await page.locator('#editor').evaluate(e=>e.open),true);
   assert.equal(await end.evaluate(e=>e.validity.valid),false);
  }
  await end.fill('2026-11-21T00:30');assert.equal(await warning.isVisible(),false);assert.equal(await end.evaluate(e=>e.validity.valid),true);
  await start.fill('2026-11-21T01:00');assert.equal(await warning.isVisible(),true);
  await start.fill('2026-11-20T23:30');assert.equal(await warning.isVisible(),false);
  for(const [value,message] of [['2027-03-14T02:30',/does not exist/],['2026-11-01T01:30',/occurs twice/]]){
   await end.fill(value);assert.match(await warning.textContent(),message);
  }
  await start.fill('2026-11-20T18:30');await end.fill('2026-11-20T20:00');
  await page.setViewportSize({width:390,height:844});await end.fill('2026-11-20T18:00');
  await warning.scrollIntoViewIfNeeded();assert.equal(await warning.isVisible(),true);
  assert.equal(await page.locator('#editor').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  await page.locator('[data-close=editor]').first().click();await page.locator('#new-campaign').click();
  assert.equal(await warning.isVisible(),false);assert.equal(await end.getAttribute('min'),null);assert.equal(await end.evaluate(e=>e.validity.customError),false);
  await start.fill('2026-11-20T18:30');await end.fill('2026-11-20T20:00');
  await page.locator('[name=title]').fill('Valid timing fixture');await page.locator('[name=location]').fill('Scott E100');
  const downloadPromise=page.waitForEvent('download');await page.locator('#save-button').click();await downloadPromise;
  assert.equal(await page.locator('#editor').evaluate(e=>e.open),false);
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  console.log('Event timing checks passed: immediate warnings, blocked saves, changed starts, overnight dates, DST, mobile, editor reset, and valid export.');
 }finally{await context.close();}
}
