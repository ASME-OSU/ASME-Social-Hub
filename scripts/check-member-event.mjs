import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';

export async function checkMemberEvent(browser,base){
 const config=JSON.parse(await readFile('config/chapter.json','utf8'));
 const source=JSON.parse(await readFile('data/campaigns/2026-27/2026-10-28-industry-night.json','utf8'));
 const fixtureImage=await readFile('docs/assets/logos/social-hub-512.png');
 const fixture={...source,demo:false,flyerUrl:'',images:{},advertising:{...source.advertising,rsvpUrl:'https://example.org/rsvp'}};
 await mkdir('test-results/member-event',{recursive:true});
 for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:1440,height:1100},colorScheme:theme,reducedMotion:'reduce'});
  try{
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   let record=structuredClone(fixture),showFlyer=false;
   await page.route('**/data/campaigns/**',route=>route.fulfill({json:record}));
   await page.route('**/media/**',route=>showFlyer?route.fulfill({contentType:'image/png',body:fixtureImage}):route.fulfill({status:404,body:''}));
   const url=`${base}/event.html?year=${fixture.year}&id=${fixture.id}`;
   await page.goto(url);await page.locator('.event-layout:not([hidden])').waitFor();await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('h1').textContent(),fixture.title);
   assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),'light dark');
   const lightBg=await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor);
   assert.equal(lightBg,theme==='dark'?'rgb(23, 29, 33)':'rgb(245, 242, 234)');
   assert.equal(await page.locator('#event-rsvp').getAttribute('href'),'https://example.org/rsvp');
   assert.match(await page.locator('#event-calendar').getAttribute('href'),/\.ics$/);
   await page.locator('#event-poster:not([hidden])').waitFor();
   await page.screenshot({path:`test-results/member-event/${theme}-desktop.png`,fullPage:true});
   await page.setViewportSize({width:390,height:844});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Member page fits phone');
   await page.screenshot({path:`test-results/member-event/${theme}-mobile.png`,fullPage:true});
   // OS theme changes must apply while the page stays open.
   await page.emulateMedia({colorScheme:theme==='dark'?'light':'dark'});
   assert.notEqual(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),lightBg);
   showFlyer=true;await page.reload();await page.locator('#event-flyer-link:not([hidden])').waitFor();assert.equal(await page.locator('#event-poster').isVisible(),false);
   record={...fixture,cancelled:true};await page.reload();await page.locator('#event-cancelled:not([hidden])').waitFor();
   assert.equal(await page.locator('#event-calendar').isVisible(),false);assert.equal(await page.locator('#event-rsvp').isVisible(),false);
   record={...fixture,deletedAt:'2026-10-21T12:00:00Z'};await page.reload();await page.locator('.event-error').waitFor();assert.match(await page.locator('#event-status').textContent(),/no longer available/);
   await page.goto(`${base}/event.html?year=2026-27&id=..%2Fprivate`);await page.locator('.event-error').waitFor();
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }
 console.log('Member event checks passed: desktop/phone, light/dark and live OS changes, RSVP/calendar, missing flyer, cancelled/deleted and invalid links.');
}
