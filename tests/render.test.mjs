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
 const html=flyerHtml(template,{...campaign,food:true},config,'story');assert.match(html,/6:00 PM EST/);assert.match(html.replace(/<[^>]+>/g,' '),/Food\s+Provided/i);assert.ok(!html.includes('{{'));
});
const blueprint=await readFile(new URL('../templates/blueprint.html',import.meta.url),'utf8');
test('feed uploads bypass every template and Story treatment without adding event artwork',()=>{
 const uploaded={...campaign,flyerUrl:'https://example.org/flyer.png?x=1&y=2',storyDesign:{background:'folded-paper'}};
 const html=flyerHtml(template,uploaded,config,'feed');
 assert.equal(html,flyerHtml(blueprint,uploaded,config,'feed'));
 assert.match(html,/class="flyer uploaded-feed"/);assert.match(html,/flyer.png\?x=1&amp;y=2/);
 assert.doesNotMatch(html,/<h1|class="logo"|photo-overlay|Food provided|A &amp; B/);
 assert.match(html,/height:auto/);
 assert.match(flyerHtml(template,uploaded,config,'feed',{flyer:'blob:local-upload'}),/src="blob:local-upload"/);
});
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

test('advertising stays compact, escapes content, and keeps full preparation in caption',()=>{
 const rich={...campaign,title:'Career night',food:true,advertising:{foodDetails:'Pizza & vegan options',benefit:'Meet <engineers> and practice interviews',speaker:'Jordan Smith',audience:'All majors',cost:'Free',rsvpUrl:'https://example.org/register',rsvpDeadline:'2026-11-03T18:00:00-05:00',preparation:'Bring private preparation notes',accessibilityContact:'access@example.org'}};
 for(const source of [template,blueprint]){const html=flyerHtml(source,rich,config,'feed');assert.match(html,/Food: Pizza &amp; vegan options/);assert.match(html,/Meet &lt;engineers&gt;/);assert.match(html,/Speaker: Jordan Smith/);assert.match(html,/For: All majors · Cost: Free/);assert.match(html,/RSVP by Nov 3, 6:00 PM EST/);assert.match(html,/RSVP link in caption/);assert.doesNotMatch(html,/private preparation notes|access@example.org/);assert.ok(!html.includes('{{'));}
 assert.doesNotMatch(flyerHtml(blueprint,{...rich,food:false},config,'feed'),/Pizza &amp;/);
 assert.throws(()=>flyerHtml(blueprint,{...rich,advertising:{foodDetails:'x'.repeat(161)}},config,'feed'),/foodDetails/);
});

test('story artwork does not promise a feed caption or link sticker',()=>{
 const rich={...campaign,advertising:{rsvpUrl:'https://example.org/register',rsvpDeadline:'2026-11-03T18:00:00-05:00',audience:'All majors'}};
 for(const source of [template,blueprint]){const html=flyerHtml(source,rich,config,'story');assert.doesNotMatch(html,/details in caption|link in caption/);assert.match(html,/RSVP by Nov 3/);assert.match(html,/All majors/);}
});

test('template selection honors campaign choice, event defaults, and strict allowlist',async()=>{
 const {selectFlyerTemplate}=await import('../scripts/render-flyers.mjs');
 const defaults={defaultTemplate:'refined-blueprint',eventTypes:[{id:'social',template:'editorial-poster'}]};
 assert.equal(selectFlyerTemplate({type:'social',template:'assembly-card'},defaults),'assembly-card');
 assert.equal(selectFlyerTemplate({type:'social'},defaults),'editorial-poster');
 assert.equal(selectFlyerTemplate({type:'other'},defaults),'refined-blueprint');
 assert.equal(selectFlyerTemplate({},{}),'editorial');
 for(const template of ['blueprint','editorial','refined-blueprint','editorial-poster','assembly-card'])assert.equal(selectFlyerTemplate({template},{}),template);
 for(const template of ['../package','unknown','',null,7])assert.throws(()=>selectFlyerTemplate({template},defaults),/Invalid flyer template/);
 assert.throws(()=>selectFlyerTemplate({type:'social'},{eventTypes:[{id:'social',template:'../../private'}]}),/Invalid flyer template/);
});

test('new production templates escape content, render complete dates, and support conditional food',async()=>{
 for(const name of ['refined-blueprint','editorial-poster','assembly-card']) {
  const source=await readFile(new URL(`../templates/${name}.html`,import.meta.url),'utf8');
  for(const format of ['feed','story']) {
   const html=flyerHtml(source,{...campaign,advertising:{audience:'All <majors>',rsvpUrl:'https://example.org/register'}},config,format);
   assert.match(html,/&lt;script&gt;/);assert.match(html,/All &lt;majors&gt;/);assert.doesNotMatch(html,/<script>|{{|file:\/\/\/|javascript:/);
   assert.match(html,/Wed, Nov 4/);assert.match(html,/6:00 PM EST/);assert.match(html,/block nofood/);assert.doesNotMatch(html,/<small>Food<\/small>/);
   if(format==='story')assert.doesNotMatch(html,/details in caption|link in caption/);
   assert.match(flyerHtml(source,{...campaign,food:true},config,format),/<small>Food<\/small><b>Provided/);
   assert.match(flyerHtml(source,{...campaign,location:{}},config,format),/Location to be announced/);
   assert.match(flyerHtml(source,{...campaign,location:'Example room'},config,format),/Example room/);
  }
 }
});

test('a failed preview logo resolution uses chapter text instead of retrying the bad URL',()=>{
 const html=flyerHtml(template,campaign,{...config,brand:{logoFlyer:'https://example.org/missing.png'}},'story',{logo:'',logoResolved:true});
 assert.doesNotMatch(html,/missing.png/);assert.match(html,/A chapter/);
});

test('Chapter template Stories never use the uploaded flyer as a backdrop',()=>{
 const html=flyerHtml(blueprint,{...campaign,flyerUrl:'https://example.org/flyer.png'},config,'story');
 assert.doesNotMatch(html,/<img class="flyer"/);assert.doesNotMatch(html,/src="https:\/\/example.org\/flyer.png"/);assert.match(html,/6:00 PM EST/);
});


test('Chapter Stories without a flyer use clean text artwork for both complete events and empty previews',()=>{
 const ordinary=flyerHtml(blueprint,campaign,config,'story');
 const preview=flyerHtml(blueprint,campaign,config,'story',{previewMissingDate:true});
 assert.match(preview,/text-story/);assert.match(preview,/Choose a date/);assert.match(preview,/Choose a time/);assert.doesNotMatch(preview,/<svg|abstract-card/);
 assert.match(ordinary,/text-story/);
});


test('Story room separators become deliberate line breaks while feed locations stay intact',()=>{
 const located={...campaign,location:{name:'Scott <Laboratory> · E100'}};
 const story=flyerHtml(blueprint,located,config,'story');
 assert.match(story,/Scott &lt;Laboratory&gt;<br>E100/);
 assert.match(flyerHtml(blueprint,located,config,'feed'),/Scott &lt;Laboratory&gt; · E100/);
});
