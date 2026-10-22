import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {homeCampaigns} from '../docs/home-campaigns.mjs';
import {latestInsightsSnapshot} from '../docs/campaign-insights.mjs';
const archive=JSON.parse(await readFile('data/archive-index.json','utf8')),campaigns=archive.campaigns.filter(c=>!c.demo),base=process.env.ASME_CHECK_BASE||'http://127.0.0.1:4275/';
const browser=await chromium.launch({headless:true});
try{
for(const theme of ['light','dark'])for(const width of [1440,390,320]){
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:900},colorScheme:theme});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);const bar=page.locator('.campaign-card').filter({has:page.getByRole('heading',{name:'ASME Bar Social',exact:true})});
 assert.match(await bar.locator('.card-engagement').innerText(),/17\s+likes/);assert.match(await bar.locator('.card-engagement').innerText(),/191\s+reached/);assert.match(await bar.locator('.card-engagement').innerText(),/not live/);
 assert.equal(await page.locator('.card-engagement.is-empty').count(),homeCampaigns(campaigns).filter(c=>!latestInsightsSnapshot(c)).length);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await bar.getByRole('button',{name:'View campaign: ASME Bar Social',exact:true}).click();assert.match(await page.locator('#detail-content').innerText(),/not live counts/);assert.match(await page.locator('#detail-content').innerText(),/17/);await page.locator('[data-close=detail]').click();
 await page.locator('[data-view=archive]').click();const row=page.locator('.archive-row').filter({has:page.getByRole('heading',{name:'ASME Bar Social',exact:true})});assert.equal(await row.locator('.archive-stats strong').first().innerText(),'191');assert.equal(await row.locator('.archive-stats strong').last().innerText(),'17');await page.locator('[data-view=dashboard]').click();
 // Exact, synthetic schedule/location differences are visible before any edit.
 await page.route('**/data/candidates.json',r=>r.fulfill({json:{events:[],changes:[{source:campaigns[0].source,title:'Calendar review fixture',comparison:'campaign-details',differences:[{field:'location',campaign:'Original room',current:'Updated room'}]}]}}));await page.reload();
 const change=page.locator('#calendar-updates .calendar-difference');await change.locator('summary').click();assert.match(await change.innerText(),/Original room/);assert.match(await change.innerText(),/Updated room/);assert.match(await change.innerText(),/have not been changed/);assert.deepEqual(errors,[]);
 await context.close();
}
console.log('Homepage insights passed: real recorded counts, unpublished placeholder, snapshots/date context, detail consistency, calendar comparisons, mobile widths, light/dark, and no console errors.');
}finally{await browser.close();}
