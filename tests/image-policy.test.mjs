import test from 'node:test';
import assert from 'node:assert/strict';
import {feedImageIssue,jpegDimensions} from '../docs/image-policy.mjs';
test('feed image guard accepts API boundaries and rejects tall, wide, or unreadable images',()=>{
 for(const [w,h]of [[1080,1350],[1080,1080],[1910,1000]])assert.equal(feedImageIssue(w,h),'');
 for(const [w,h]of [[1080,1920],[2000,1000],[0,100],[NaN,100]])assert.ok(feedImageIssue(w,h));
 assert.match(feedImageIssue(1080,1920),/Story only/);
});

test('JPEG dimensions parser handles frame headers and rejects malformed input',()=>{
 const frame=new Uint8Array([255,216,255,192,0,17,8,5,70,4,56,3,1,17,0,2,17,0,3,17,0,255,217]);
 assert.deepEqual(jpegDimensions(frame),{width:1080,height:1350});assert.equal(jpegDimensions(frame.slice(0,12)),null);assert.equal(jpegDimensions(new Uint8Array([1,2,3])),null);
});
