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
