import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export async function checkDispatcherAccess(browser,base){
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[],requests=[],saved=[];
 try{
  const page=await context.newPage();await page.clock.install({time:new Date('2026-10-21T12:00:00Z')});page.on('pageerror',error=>errors.push(error.message));
  const config=JSON.parse(await readFile('config/chapter.json','utf8'));let dispatchStatus=403,dispatchGate=null,releaseDispatch;
  await page.route('**/config/chapter.json',route=>route.fulfill({json:config}));
  await page.route('**/data/archive-index.json',route=>route.fulfill({json:{campaigns:[]}}));
  await page.route('**/data/candidates.json',route=>route.fulfill({json:{events:[],changes:[]}}));
  await page.route('https://api.github.com/**',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.pathname.endsWith('/dispatches')){requests.push(JSON.parse(request.postData()));if(dispatchGate)await dispatchGate;return dispatchStatus===204?route.fulfill({status:204}):route.fulfill({status:dispatchStatus,json:{message:'MOCK_SECRET malicious text must never appear'}});}
   if(request.method()==='PUT'){saved.push(JSON.parse(request.postData()));return route.fulfill({status:201,json:{content:{sha:'saved-fixture'}}});}
   if(url.pathname.endsWith('/config/chapter.json'))return route.fulfill({json:{sha:'config',content:Buffer.from(JSON.stringify(config)).toString('base64')}});
   return route.fulfill({status:404,json:{message:'MOCK_SECRET'}});
  });
  await page.goto(base);await page.locator('#new-campaign:not([disabled])').waitFor();await page.locator('[data-view=settings]').click();
  await page.locator('[name=token]').fill('mock-dispatch-token');await page.locator('#settings-form button.primary').click();await page.waitForFunction(()=>document.querySelector('#connection-label').textContent==='Connected');
  assert.match(await page.locator('#connection-access-read').textContent(),/read succeeded/);assert.match(await page.locator('#connection-access-write').textContent(),/Not checked/);assert.match(await page.locator('#connection-access-dispatch').textContent(),/Not checked/);
  await page.locator('[data-view=dashboard]').click();await page.locator('#dispatcher-preview').click();await page.waitForFunction(()=>document.querySelector('#dispatcher-control-status').textContent.includes('GitHub 403'));
  assert.match(await page.locator('#dispatcher-control-status').textContent(),/Actions → Read and write/);assert.doesNotMatch(await page.locator('body').textContent(),/MOCK_SECRET|malicious text/);assert.deepEqual(requests,[{ref:'main',inputs:{dry_run:true}}]);
  await page.locator('#dispatcher-permissions-fix').click();assert.equal(await page.locator('#token-guide').getAttribute('open'),'');assert.match(await page.locator('#connection-access-dispatch').textContent(),/denied/);assert.match(await page.locator('#connection-access-read').textContent(),/read succeeded/);assert.ok((await page.locator('#token-guide a[href*="/new?"]').getAttribute('href')).includes('actions=write'));
  // A denied workflow trigger must not discard a token that can save campaigns.
  await page.locator('[data-view=dashboard]').click();await page.locator('#new-campaign').click();await page.locator('[name=title]').fill('Permission fixture');await page.locator('[name=location]').fill('Scott Lab');await page.locator('[name=start]').fill('2026-11-20T18:30');await page.locator('[name=end]').fill('2026-11-20T20:00');await page.locator('[name=feedEnabled]').uncheck();await page.locator('[name=storyEnabled]').uncheck();await page.locator('#save-button').click();await page.waitForFunction(()=>!document.querySelector('#editor').open);assert.equal(saved.length,1);
  await page.locator('[data-view=settings]').click();assert.match(await page.locator('#connection-access-write').textContent(),/save request was accepted/);assert.match(await page.locator('#connection-access-dispatch').textContent(),/denied/);
  await page.locator('#settings-form button.primary').click();await page.waitForFunction(()=>document.querySelector('#connection-access-dispatch').textContent.includes('Not checked'));assert.match(await page.locator('#connection-access-write').textContent(),/Not checked/);
  // A response from before reconnect must not overwrite the new session’s capabilities.
  dispatchGate=new Promise(resolve=>{releaseDispatch=resolve;});await page.locator('[data-view=dashboard]').click();await page.locator('#dispatcher-preview').click();await page.waitForFunction(()=>document.querySelector('#dispatcher-preview').disabled);await page.locator('[data-view=settings]').click();await page.locator('#settings-form button.primary').click();await page.waitForFunction(()=>document.querySelector('#settings-form').getAttribute('aria-busy')==='false');releaseDispatch();await page.waitForFunction(()=>!document.querySelector('#dispatcher-preview').disabled);assert.match(await page.locator('#connection-access-dispatch').textContent(),/Not checked/);assert.equal(await page.locator('#dispatcher-control-status').textContent(),'');dispatchGate=null;
  dispatchStatus=204;await page.locator('[data-view=dashboard]').click();await page.locator('#dispatcher-preview').click();await page.waitForFunction(()=>document.querySelector('#dispatcher-control-status').textContent.includes('Preview dispatcher requested'));assert.match(await page.locator('#dispatcher-permission-status').textContent(),/request was accepted/);assert.equal(await page.locator('#dispatcher-permissions-fix').isVisible(),false);assert.equal(requests.length,3);assert.equal(requests.every(request=>request.inputs.dry_run===true),true);assert.deepEqual(errors,[]);
  console.log('Dispatcher access checks passed: separate capabilities, actionable redacted 403, saving after denied workflow, reconnect reset, and accepted preview request.');
 }finally{await context.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {chromium}=await import('playwright'),port=4287,base=`http://127.0.0.1:${port}`;
 const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});let browser;
 try{for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}browser=await chromium.launch({headless:true});await checkDispatcherAccess(browser,base);}finally{if(browser)await browser.close();server.kill();}
}
