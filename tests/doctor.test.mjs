import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {writeJson} from '../scripts/core.mjs';
import {doctor} from '../scripts/doctor.mjs';

test('doctor checks LinkedIn credentials when integration is enabled in config', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'doctor-'));
  t.after(() => rm(root, {recursive: true, force: true}));

  const customConfig = {
    chapterName: 'ASME at Ohio State',
    timezone: 'America/New_York',
    activeYear: '2026-27',
    siteUrl: 'https://asme-osu.github.io/ASME-Social-Hub',
    repository: {owner: 'ASME-OSU', name: 'ASME-Social-Hub'},
    defaultCadence: {feed: {daysBefore: 7, time: '12:00'}, story: {daysBefore: 3, time: '12:00'}},
    integrations: {
      groupme: {enabled: false},
      linkedin: {enabled: true, organizationId: '123456'}
    }
  };
  await writeJson(path.join(root, 'config/chapter.json'), customConfig);

  const checksMissing = await doctor({root, env: {}});
  const liTokenMissing = checksMissing.find(c => c.name === 'LINKEDIN_ACCESS_TOKEN');
  const liOrgMissing = checksMissing.find(c => c.name === 'LINKEDIN_ORGANIZATION_ID');
  assert.ok(liTokenMissing && !liTokenMissing.ok);
  assert.ok(liOrgMissing && !liOrgMissing.ok);

  const checksPresent = await doctor({
    root,
    env: {
      LINKEDIN_ACCESS_TOKEN: 'li-secret',
      LINKEDIN_ORGANIZATION_ID: '123456'
    }
  });
  const liTokenPresent = checksPresent.find(c => c.name === 'LINKEDIN_ACCESS_TOKEN');
  const liOrgPresent = checksPresent.find(c => c.name === 'LINKEDIN_ORGANIZATION_ID');
  assert.ok(liTokenPresent && liTokenPresent.ok);
  assert.ok(liOrgPresent && liOrgPresent.ok);
});
