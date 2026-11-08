import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveAnalytics,archiveAnalyticsMarkup} from '../docs/archive-analytics.mjs';
const snapshot=(reach,day=1,extra={})=>({channel:'feed',mediaId:'current',day,recordedAt:`2026-10-${day===7?'28':'22'}T12:00:00Z`,metrics:{reach,...extra}});
const campaign=(id,insights,extra={})=>({id,title:id,type:'social',year:'2026-27',start:'2026-11-02T12:00:00Z',results:{feed:{mediaId:'current',postedAt:'2026-10-22T01:00:00Z'},insights},...extra});
test('counts only latest current-media observations, excludes examples/deletions, and keeps real zeros',()=>{
 const rows=[campaign('real',[snapshot(100,1,{likes:3}),snapshot(150,7,{likes:4,saved:0}),{...snapshot(900,7),mediaId:'old'}]),campaign('zero',[snapshot(0)]),campaign('missing',[]),campaign('example',[snapshot(999)],{demo:true}),campaign('deleted',[snapshot(999)],{deletedAt:'now'})];
 const a=archiveAnalytics(rows);assert.equal(a.total,150);assert.equal(a.average,75);assert.equal(a.likes,4);assert.equal(a.saved,0);assert.equal(a.rows.length,3);assert.equal(a.measured.length,2);assert.equal(a.monthly[0].total,150);assert.equal(a.monthly[0].key,'2026-10');assert.equal(a.top[0].campaign.id,'real');
});
test('story statistics remain separate and posting months respect chapter timezone',()=>{
 const c=campaign('a',[snapshot(100),{channel:'story',recordedAt:'2026-11-01T12:00:00Z',metrics:{reach:35,replies:2}}]);c.results.story={postedAt:'2026-11-01T01:00:00Z'};
 const a=archiveAnalytics([c],{channel:'story',timezone:'America/New_York'});assert.equal(a.total,35);assert.equal(a.replies,2);assert.equal(a.monthly[0].key,'2026-10');
});
test('filtered populations determine every chart and totals; no metrics is unavailable',()=>{
 assert.equal(archiveAnalytics([]).total,null);assert.equal(archiveAnalytics([campaign('bad',[snapshot(-3)])]).average,null);
 const a=archiveAnalytics([campaign('one',[snapshot(10)])]);assert.equal(a.total,10);assert.equal(a.groups[0].count,1);assert.equal(a.top.length,1);
});
test('markup labels non-unique totals and escapes campaign data',()=>{
 const html=archiveAnalyticsMarkup([campaign('<img onerror="x">',[snapshot(0)])]);assert.match(html,/people may overlap/);assert.match(html,/Day 1 and day 7/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img onerror/);assert.match(html,/>0<\/strong>/);assert.match(archiveAnalyticsMarkup([]),/No reach recorded/);
});
