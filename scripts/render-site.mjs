import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {rm} from 'node:fs/promises';

const exec = promisify(execFile);

// Retry only data edits, uploads and generated output. If implementation or
// dependencies change, a newer queued job must start with the new workflow.
export function canRebuildAfterEdit(file) {
  return file === 'config/chapter.json' || file === 'docs/sw.js' ||
    /^(data\/|assets\/uploads\/|docs\/(data|config|media|calendar|events)\/)/.test(file);
}

// This owns a disposable, initially clean Actions checkout, never a publisher.
// A rejected push discards only this job's generated commit and regenerates from
// the fetched tip. It never merges stale campaign copies or force-pushes.
export async function renderAndPersist({root = process.cwd(), attempts = 3, prepare, log = console.log} = {}) {
  if (!Number.isInteger(attempts) || attempts < 1) throw Error('Invalid render attempt limit');
  const git = async (...args) => (await exec('git', args, {
    cwd: root, env: {...process.env, GIT_TERMINAL_PROMPT: '0'}, maxBuffer: 8 * 1024 * 1024
  })).stdout.trim();
  if (await git('status', '--porcelain')) throw Error('Render persistence requires a clean disposable checkout');
  prepare ??= async () => {
    // Fresh processes load the current checkout after each retry.
    for (const args of [['scripts/render-flyers.mjs'], ['scripts/tasks.mjs', 'expiry'], ['scripts/archive.mjs'], ['scripts/build.mjs']]) {
      const {stdout, stderr} = await exec(process.execPath, args, {cwd: root, maxBuffer: 8 * 1024 * 1024});
      if (stdout) log(stdout.trimEnd());
      if (stderr) log(stderr.trimEnd());
    }
  };
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const base = await git('rev-parse', 'HEAD');
    await prepare({root, attempt});
    await git('add', '--', 'data', 'docs');
    if (await git('diff', '--cached', '--name-only')) await git('commit', '-m', 'Update campaign render state');
    try {
      // Push even for a no-op: a concurrent edit must invalidate the deployment.
      await git('push', 'origin', 'HEAD:refs/heads/main');
      return {attempts: attempt};
    } catch (error) {
      await git('fetch', '--no-tags', 'origin', 'refs/heads/main');
      const latest = await git('rev-parse', 'FETCH_HEAD');
      if (latest === base) throw error; // Auth/network failures are not edit races.
      await git('merge-base', '--is-ancestor', base, latest); // Reject rewritten history.
      const changed = (await git('diff', '--name-only', base, latest)).split('\n').filter(Boolean);
      if (!changed.every(canRebuildAfterEdit)) throw Error('Render implementation changed; let the newest queued render rebuild it');
      if (attempt === attempts) throw Error(`Campaign data kept changing during ${attempts} render attempts; the newest queued render will retry`);
      log(`Campaign data changed during render; rebuilding latest main (attempt ${attempt + 1}/${attempts}).`);
      await git('reset', '--hard', latest);
      // Reset restores tracked artwork, but ignored markers still describe the
      // discarded attempt. Invalidate them so restored old images cannot skip.
      await rm(resolve(root, '.local/render'), {recursive: true, force: true});
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await renderAndPersist();
}
