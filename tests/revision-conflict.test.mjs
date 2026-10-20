import test from 'node:test';
import assert from 'node:assert/strict';
import {hasEditableConflict} from '../docs/revision-conflict.mjs';

const campaign = () => ({
  id: '2026-10-23-asme-bar-social', year: '2026-27',
  title: 'ASME Bar Social', start: '2026-10-23T22:30:00Z',
  campaign: {feed: {daysBefore: 7, time: '14:30'}},
  status: {feed: 'pending'}, results: {feed: {}}, log: [], revision: 3
});

test('background dispatcher updates do not block an editor save', () => {
  const before = campaign();
  const after = {...campaign(), revision: 4, status: {feed: 'skipped'},
    results: {feed: {skipReason: 'window-missed'}}, log: [{message: 'skipped'}]};
  assert.equal(hasEditableConflict(before, after), false);
});

test('a different user editing scheduling fields is a real conflict', () => {
  const before = campaign();
  const after = {...campaign(), revision: 4, campaign: {feed: {daysBefore: 2, time: '14:30'}}};
  assert.equal(hasEditableConflict(before, after), true);
});

test('a changed title is a real conflict even when revision did not change', () => {
  const before = campaign();
  const after = {...campaign(), title: 'Updated title'};
  assert.equal(hasEditableConflict(before, after), true);
});
