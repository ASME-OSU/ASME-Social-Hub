# Compact campaign previews

The campaign drawer opened from the homepage has an Open event page action in its header. It links to the saved member-facing event page in a new tab. Demo/deleted campaigns and configurations without a valid public site URL do not get a broken link.

Fine-pointer desktop layouts at 960px and wider use 32px preview controls and compact drawer actions. Phone and coarse-pointer controls keep larger touch targets. The Enlarge preview icon retains its accessible name and tooltip.

The drawer fits the complete first flyer above its footer by measuring the current heading, actions, padding, and Instagram header. It recalculates on resize, action wrapping, and carousel image load. Captions and remaining campaign information stay scrollable; the image and published artwork are unchanged.

Verification: `npm run check:browser` plus `node scripts/check-compact-preview.mjs` with the local preview server on port 4275. The focused check verifies the event destination, the drawer flyer bounds, a single-row desktop toolbar, and phone control sizes.
