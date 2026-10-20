import test from 'node:test';
import assert from 'node:assert/strict';
import {captionFor} from '../docs/caption.mjs';
import {captionFor as publisherCaption} from '../scripts/core.mjs';
import {instagramPreviewContent,instagramHandle,safePreviewImage} from '../docs/instagram-preview.mjs';
const config={chapterName:'Chapter',instagramHandle:'@chapter_handle',timezone:'America/New_York',siteUrl:'https://example.org/hub',hashtags:['Engineering'],captionTemplate:'{title}\n\n{description}\n\n{when}\n{location}\n{food}\n\n{hashtags}'};
const campaign={id:'fixture',year:'2026-27',title:'Design night',description:'Build a project.',start:'2026-11-20T23:30:00Z',location:{name:'Room 100'},food:true,advertising:{foodDetails:'Pizza',preparation:'Bring a laptop',accessibilityContact:'officers@example.org',rsvpUrl:'https://example.org/register'}};
test('preview and publisher share the same caption implementation and all advertising details',()=>{
 assert.equal(captionFor,publisherCaption);
 const content=instagramPreviewContent(campaign,config);
 assert.equal(content.caption,publisherCaption(campaign,config));assert.equal(content.captionError,'');assert.equal(content.handle,'chapter_handle');
 for(const text of ['Pizza','Bring a laptop','officers@example.org','https://example.org/register','6:30 PM','#Engineering'])assert.ok(content.caption.includes(text));
});
test('published preview preserves original caption and media even after campaign edits',()=>{
 const changed={...campaign,title:'New title',results:{feed:{caption:'Original delivered caption',images:['https://example.org/posted-1.jpg','https://example.org/posted-2.jpg']}}};
 const content=instagramPreviewContent(changed,config);assert.equal(content.caption,'Original delivered caption');assert.deepEqual(content.images,changed.results.feed.images);
 assert.deepEqual(instagramPreviewContent({...changed,results:{feed:{image:'https://example.org/single.jpg'}}},config).images,['https://example.org/single.jpg']);
});
test('unpublished carousel preview follows rendered image order and respects custom overrides',()=>{
 const content=instagramPreviewContent({...campaign,flyerUrl:'https://example.org/cover.png',flyerUrls:['https://example.org/cover.png','https://example.org/page-2.png']},config);
 assert.deepEqual(content.images,['https://example.org/hub/media/2026-27/fixture-feed.jpg','https://example.org/hub/media/2026-27/fixture-feed-2.jpg']);
 assert.deepEqual(instagramPreviewContent({...campaign,images:{feed:'https://example.org/override.jpg'}},config).images,['https://example.org/override.jpg']);
});
test('caption validation errors are visible to the preview, and unsafe image URLs are rejected',()=>{
 assert.match(instagramPreviewContent({...campaign,description:'x'.repeat(2200)},config).captionError,/2200/);
 for(const value of ['javascript:alert(1)','data:text/html,hello','https://user:secret@example.org/post.jpg'])assert.equal(safePreviewImage(value),'');
 assert.equal(instagramHandle({chapterName:'My Chapter'}),'My Chapter');
});
