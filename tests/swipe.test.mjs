import test from 'node:test';
import assert from 'node:assert/strict';
import {classifySwipe} from '../docs/instagram-preview.mjs';

test('deliberate horizontal swipes navigate in the same direction as an Instagram carousel',()=>{
 assert.equal(classifySwipe({x:300,y:200},{x:160,y:206}),'next');
 assert.equal(classifySwipe({x:100,y:200},{x:250,y:195}),'previous');
});
test('vertical scrolls, diagonal drags, and taps do not switch carousel images',()=>{
 for(const end of [{x:100,y:350},{x:115,y:260},{x:150,y:250},{x:101,y:100},{x:130,y:108}])assert.equal(classifySwipe({x:100,y:100},end),null);
});
test('a clear swipe works across screen coordinates without depending on origin',()=>{
 assert.equal(classifySwipe({x:1290,y:700},{x:1245,y:705}),'next');
 assert.equal(classifySwipe({x:-10,y:-20},{x:50,y:-25}),'previous');
});
test('cancelled or incomplete gesture coordinates cannot navigate',()=>{
 for(const point of [null,{}, {x:Infinity,y:5},{x:40,y:NaN}])assert.equal(classifySwipe({x:10,y:20},point),null);
});
