import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {renderAndPersist} from '../scripts/render-site.mjs';
const exec = promisify(execFile);
const git = async (cwd,...args) => (await exec('git',args,{cwd,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}})).stdout.trim();
async function fixture(t) {
  const base=await mkdtemp(path.join(tmpdir(),'render-race-'));
  t.after(()=>rm(base,{recursive:true,force:true}));
  const remote=path.join(base,'remote.git'),root=path.join(base,'runner'),editor=path.join(base,'editor');
  await git(base,'init','--bare',remote);
  await git(base,'clone',remote,root);
  await git(root,'checkout','-b','main');
  for(const cwd of [root]) {await git(cwd,'config','user.name','Fixture');await git(cwd,'config','user.email','fixture@example.org');}
  const save=async(cwd,file,value)=>{await mkdir(path.dirname(path.join(cwd,file)),{recursive:true});await writeFile(path.join(cwd,file),value);};
  const original={title:'Original',results:{feed:{mediaId:'receipt-keep'}}};
  await save(root,'data/campaigns/meeting.json',JSON.stringify(original));
  await save(root,'docs/data/meeting.json',JSON.stringify(original));
  await save(root,'docs/media/existing.jpg','old artwork');
  await save(root,'.gitignore','.local/\n');
  await git(root,'add','.');await git(root,'commit','-m','Initial');await git(root,'push','origin','HEAD:main');
  await git(base,'clone','--branch','main',remote,editor);
  await git(editor,'config','user.name','Editor');await git(editor,'config','user.email','editor@example.org');
  const edit=async(file,value)=>{await save(editor,file,value);await git(editor,'add','.');await git(editor,'commit','-m','Concurrent edit');await git(editor,'push','origin','HEAD:main');};
  const render=async()=>{const value=await readFile(path.join(root,'data/campaigns/meeting.json'),'utf8');await save(root,'docs/data/meeting.json',value);};
  return {root,remote,editor,save,edit,render,original};
}

test('rejected render push rebuilds latest campaign and retains receipts and deletion',async t=>{
  const f=await fixture(t);
  const latest={...f.original,title:'Officer edit',deletedAt:'2026-10-27T03:00:00Z'};
  const result=await renderAndPersist({root:f.root,log:()=>{},prepare:async({attempt})=>{
    await f.render();
    if(attempt===1){
      await f.save(f.root,'docs/media/stale.jpg','stale generated artwork');
      await f.edit('data/campaigns/meeting.json',JSON.stringify(latest));
    }
  }});
  assert.equal(result.attempts,2);
  assert.deepEqual(JSON.parse(await git(f.root,'show','HEAD:data/campaigns/meeting.json')),latest);
  assert.deepEqual(JSON.parse(await git(f.root,'show','HEAD:docs/data/meeting.json')),latest);
  await assert.rejects(readFile(path.join(f.root,'docs/media/stale.jpg')),{code:'ENOENT'});
  assert.equal(await git(f.remote,'rev-parse','refs/heads/main'),await git(f.root,'rev-parse','HEAD'));
});

test('no-op renders still detect edits before deploying and rebuild',async t=>{
  const f=await fixture(t);
  const latest={...f.original,title:'New title'};
  assert.equal((await renderAndPersist({root:f.root,log:()=>{},prepare:async({attempt})=>{
    await f.render();if(attempt===1)await f.edit('data/campaigns/meeting.json',JSON.stringify(latest));
  }})).attempts,2);
  assert.deepEqual(JSON.parse(await git(f.root,'show','HEAD:docs/data/meeting.json')),latest);
});

test('retry invalidates markers when reset restores old existing artwork',async t=>{
  const f=await fixture(t);let renders=0;
  await renderAndPersist({root:f.root,log:()=>{},prepare:async({attempt})=>{
    await f.render();
    const marker=path.join(f.root,'.local/render/existing.revision');
    // Model the real renderer: an existing image and matching revision skip it.
    if(await readFile(marker,'utf8').catch(()=>null)!=='current revision'){
      renders++;
      await f.save(f.root,'docs/media/existing.jpg','current artwork');
      await f.save(f.root,'.local/render/existing.revision','current revision');
    }
    if(attempt===1)await f.edit('data/campaigns/other.json','{"title":"Unrelated edit"}');
  }});
  assert.equal(renders,2);
  assert.equal(await git(f.remote,'show','main:docs/media/existing.jpg'),'current artwork');
  assert.deepEqual(JSON.parse(await git(f.remote,'show','main:data/campaigns/other.json')),{title:'Unrelated edit'});
});

test('a rejected push without remote edits fails without rerendering or resetting',async t=>{
  const f=await fixture(t);let calls=0;
  await writeFile(path.join(f.remote,'hooks/pre-receive'),'#!/bin/sh\nexit 1\n',{mode:0o755});
  await assert.rejects(renderAndPersist({root:f.root,prepare:async()=>{calls++;await f.save(f.root,'docs/data/new.json','{}');}}));
  assert.equal(calls,1);
  assert.equal(await readFile(path.join(f.root,'docs/data/new.json'),'utf8'),'{}');
});

test('continuous edits stop at the attempt limit and never overwrite remote data',async t=>{
  const f=await fixture(t);let calls=0;
  await assert.rejects(renderAndPersist({root:f.root,attempts:2,log:()=>{},prepare:async({attempt})=>{
    calls++;await f.render();await f.edit('data/campaigns/meeting.json',JSON.stringify({...f.original,title:`Edit ${attempt}`}));
  }}),/kept changing during 2/);
  assert.equal(calls,2);
  assert.equal(JSON.parse(await git(f.remote,'show','main:data/campaigns/meeting.json')).title,'Edit 2');
});

test('implementation changes require a fresh workflow instead of reusing old code',async t=>{
  const f=await fixture(t);let calls=0;
  await assert.rejects(renderAndPersist({root:f.root,prepare:async()=>{
    calls++;await f.render();await f.edit('scripts/renderer.mjs','// Updated renderer');
  }}),/implementation changed/);
  assert.equal(calls,1);
});

test('dirty workspaces are refused before generating or discarding anything',async t=>{
  const f=await fixture(t);
  await f.save(f.root,'docs/data/meeting.json','local work');
  await assert.rejects(renderAndPersist({root:f.root,prepare:()=>assert.fail('must not render')}),/clean disposable checkout/);
  assert.equal(await readFile(path.join(f.root,'docs/data/meeting.json'),'utf8'),'local work');
});

test('render requests coalesce separately while publishers keep their durable queue and persistence',async()=>{
  const runner=await readFile(new URL('../.github/workflows/run.yml',import.meta.url),'utf8');
  const render=await readFile(new URL('../.github/workflows/render.yml',import.meta.url),'utf8');
  assert.match(render,/concurrency:\n  group: dashboard-render-requests\n  cancel-in-progress: false\npermissions:/);
  assert.match(runner,/group: campaign-repository\n  cancel-in-progress: false\n  queue: max/);
  const condition=name=>runner.match(new RegExp(`- name: ${name}\\n        if: (.+)`))[1];
  const evaluate=(name,task,dry_run=false)=>vm.runInNewContext(condition(name),{inputs:{task,dry_run},always:()=>true});
  assert.equal(evaluate('Render and persist latest dashboard','render'),true);
  assert.equal(evaluate('Render and persist latest dashboard','render',true),false);
  for(const task of ['dispatch','insights','calendar','keepalive','refresh'])assert.equal(evaluate('Render and persist latest dashboard',task),false);
  for(const name of ['Check token expiry','Prepare Pages data','Persist campaign state and site data']){
    assert.equal(evaluate(name,'render'),false);
    assert.equal(evaluate(name,'dispatch'),true);
  }
  assert.match(runner,/run: node scripts\/render-site\.mjs/);
});
