import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {writePwa} from '../scripts/pwa.mjs';

test('offline shell versions are deterministic and change with content; operational data is excluded',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pwa-'));
 try {
  const docs=join(root,'docs');
  for(const dir of ['assets','templates','config','data'])await mkdir(join(docs,dir),{recursive:true});
  for(const [file,content] of Object.entries({'index.html':'<html></html>','app.js':'// app','manifest.webmanifest':'{}','config/chapter.json':'{}','data/archive-index.json':'{}','data/candidates.json':'{}','data/dispatcher-health.json':'{}','data/token-warning.json':'{}'})) await writeFile(join(docs,file),content);
  await writePwa(root);const first=await readFile(join(docs,'sw.js'),'utf8');
  await writePwa(root);assert.equal(await readFile(join(docs,'sw.js'),'utf8'),first);
  const files=JSON.parse(first.match(/const FILES = (.+);/)[1]);
  assert.ok(files.includes('app.js'));assert.ok(files.includes('data/archive-index.json'));
  assert.ok(!files.includes('data/dispatcher-health.json'));assert.ok(!files.includes('data/token-warning.json'));assert.ok(!files.includes('sw.js'));
  await writeFile(join(docs,'app.js'),'// new app');await writePwa(root);
  assert.notEqual(await readFile(join(docs,'sw.js'),'utf8'),first);
 } finally {await rm(root,{recursive:true,force:true});}
});
