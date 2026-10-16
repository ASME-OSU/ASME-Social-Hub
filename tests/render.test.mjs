import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {flyerHtml} from '../scripts/render-flyers.mjs';
const template=await readFile(new URL('../templates/editorial.html',import.meta.url),'utf8');
const config={chapterName:'A chapter',school:'School',timezone:'America/New_York',eventTypes:[],brand:{primary:'red;display:none',logo:'javascript:alert(1)'}};
const campaign={title:'<script>alert(1)</script>',description:'A & B',type:'social',start:'2026-11-04T18:00:00-05:00',food:false,location:{name:'Lab'},flyerUrl:'file:///etc/passwd'};
test('flyer template escapes event content and rejects unsafe asset and CSS values',()=>{
 const html=flyerHtml(template,campaign,config,'feed');assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('file:///'));assert.ok(!html.includes('javascript:'));assert.ok(!html.includes('display:none'));assert.ok(!html.includes('Food provided'));
});
test('flyer displays chapter-local time and optional food line',()=>{
 const html=flyerHtml(template,{...campaign,food:true},config,'story');assert.match(html,/6:00 PM EST/);assert.match(html,/Food provided/);assert.ok(!html.includes('{{'));
});
const blueprint=await readFile(new URL('../templates/blueprint.html',import.meta.url),'utf8');
test('blueprint omits food cell, provides missing location and photo overlay',()=>{
 const html=flyerHtml(blueprint,{...campaign,title:'An engineering event with a very long title that still needs a clear and readable layout',location:{},flyerUrl:'https://example.org/photo.jpg'},config,'story');
 assert.match(html,/block nofood/);assert.ok(!html.includes('<small>Food</small>'));assert.match(html,/Location to be announced/);assert.match(html,/photo-overlay/);assert.match(html,/object-fit:cover/);assert.match(html,/270px 84px 360px/);assert.ok(!html.includes('{{'));
});
test('blueprint renders food cell and local day/month',()=>{
 const html=flyerHtml(blueprint,{...campaign,food:true},config,'feed');assert.match(html,/<small>Food<\/small><b>Provided/);assert.match(html,/<div class="day">4/);assert.match(html,/<div class="mon">Nov/);
});
test('bundled fonts inline and local logo path traversal is rejected',async()=>{
 const {loadFlyerAssets}=await import('../scripts/render-flyers.mjs');const assets=await loadFlyerAssets(process.cwd(),{brand:{logoReverse:'../../package.json'}});assert.match(assets.fontCss,/data:font\/woff2;base64/);assert.equal(assets.logo,'');const html=flyerHtml(blueprint,campaign,config,'feed',assets);assert.match(html,/@font-face/);
});
test('renderer protects published, ambiguous and active-container assets but permits invalidated revision',async()=>{
 const {isFlyerLocked}=await import('../scripts/render-flyers.mjs');
 for(const result of [{mediaId:'published'},{publishAttemptedAt:'2026-10-15T12:00:00Z'},{containerId:'prepared',preparedRevision:2},{containerId:'legacy'}]) assert.equal(isFlyerLocked({revision:2,results:{feed:result}},'feed'),true);
 assert.equal(isFlyerLocked({revision:3,results:{feed:{containerId:'old',preparedRevision:2}}},'feed'),false);
 assert.equal(isFlyerLocked({revision:3,results:{feed:{containerId:'old',preparedRevision:2,publishAttemptedAt:'uncertain'}}},'feed'),true);
 assert.equal(isFlyerLocked({status:{feed:'done'}},'feed'),true);
 assert.equal(isFlyerLocked({results:{feed:{mediaId:'published'}}},'story'),false);
});
