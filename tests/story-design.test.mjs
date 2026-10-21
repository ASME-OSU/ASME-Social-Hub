import test from 'node:test';
import assert from 'node:assert/strict';
import {STORY_BACKGROUNDS,validateStoryDesign,paletteFromPixels,resolveStoryPalette,renderStoryDesign} from '../docs/story-design.mjs';
test('Story design accepts only known treatments and normalized persisted colors',()=>{
  validateStoryDesign({background:'color-wash',paletteSource:'custom',palette:['#123456','#abcdef','#ffffff']});validateStoryDesign(undefined);validateStoryDesign({background:'color-wash',paletteSource:'flyer'});validateStoryDesign({background:'color-wash',paletteSource:'chapter'});assert.throws(()=>validateStoryDesign({background:'color-wash',paletteSource:'other'}));
  for(const background of Object.keys(STORY_BACKGROUNDS))validateStoryDesign({background,palette:['#123456','#abcdef','#ffffff']});
  for(const value of [null,[],{}, {background:'evil'}, {background:'template',extra:1},{background:'color-wash',palette:['#ABCDEF','#123456','#ffffff']},{background:'color-wash',palette:['#fff']}])assert.throws(()=>validateStoryDesign(value));
});
test('palette extraction ignores blank pixels, is deterministic, and handles monochrome',()=>{
  const pixels=new Uint8ClampedArray([255,255,255,255,0,0,0,255,0,255,0,0,190,30,50,255,190,30,50,255,30,60,160,255]);
  assert.deepEqual(paletteFromPixels(new Uint8ClampedArray([100,100,100,255]),['#123456','#abcdef','#ffffff']),['#123456','#abcdef','#ffffff']);
  const palette=paletteFromPixels(pixels);
  assert.deepEqual(palette,paletteFromPixels(pixels));assert.equal(palette[0],'#be1e32');assert.equal(palette[1],'#1e3ca0');
  for(const input of [new Uint8ClampedArray(),new Uint8ClampedArray([100,100,100,255])]){const colors=paletteFromPixels(input);assert.equal(colors.length,3);assert.ok(colors.every(c=>/^#[0-9a-f]{6}$/.test(c)));assert.equal(new Set(colors).size,3);}
});
test('palette uses saved colors or normalized safe chapter fallback',()=>{
  assert.deepEqual(resolveStoryPalette({}, {brand:{primary:'#ABC',accent:'red',background:'#12345'}}),['#aabbcc','#ba0c2f','#f2f5f9']);
  assert.deepEqual(resolveStoryPalette({paletteSource:'chapter',palette:['#111111','#222222','#333333']},{brand:{primary:'#123456'}}),['#123456','#ba0c2f','#f2f5f9']);
  assert.deepEqual(resolveStoryPalette({palette:['#111111','#222222','#333333']},{}),['#111111','#222222','#333333']);
});
test('treatments retain uncropped flyer, escaped values, and fitter structure',()=>{
  for(const background of ['color-wash','blueprint-rings','folded-paper']){
    const html=renderStoryDesign({campaign:{title:'UNTRUSTED',storyDesign:{background}},config:{},values:{title:'Safe &amp; title',flyerSource:'https://example.org/a.png?a=1&amp;b=2',foodClass:'nofood'}});
    assert.match(html,/object-fit:contain/);assert.match(html,/<section class="hero">/);assert.match(html,/class="artwork flyer-card"/);assert.match(html,/Safe &amp; title/);assert.doesNotMatch(html,/UNTRUSTED/);assert.match(html,/padding:270px 82px 320px/);
  }
});

test('blueprint grid uses dark lines on bright palettes',()=>{
 const html=renderStoryDesign({campaign:{storyDesign:{background:'blueprint-rings',palette:['#eeffee','#dd0000','#ffffff']}},config:{},values:{}});
 assert.match(html,/#10284008 1px/);assert.doesNotMatch(html,/<svg/);
});


test('Stories without media use full-height type-led artwork without placeholder symbols',()=>{
 for(const background of ['color-wash','blueprint-rings','folded-paper']){
  const html=renderStoryDesign({campaign:{storyDesign:{background}},config:{},values:{title:'Meet &lt;engineers&gt;',chapter:'ASME',shortDate:'Thu, Oct 22',time:'6:00 PM EDT',location:'Scott E100',foodClass:'nofood'}});
  assert.match(html,/text-story/);assert.match(html,/height:1920px/);assert.match(html,/grid-template-rows:auto minmax\(0,1fr\) auto auto/);
  assert.match(html,/Meet &lt;engineers&gt;/);assert.match(html,/Scott E100/);assert.doesNotMatch(html,/<svg|abstract-card|class="logo"|story-flyer/);
 }
});
