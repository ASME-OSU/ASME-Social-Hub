import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {writePwa} from './pwa.mjs';
await writePwa();
const port=4297,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:String(port)},stdio:'pipe'});
const proxy=http.createServer(async(req,res)=>{
 if(!req.url.startsWith('/ASME-Social-Hub/')){res.writeHead(404);res.end();return;}
 try {const response=await fetch(base+req.url.slice('/ASME-Social-Hub'.length));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(502);res.end();}
});
let browser;
try {
 for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}
 browser=await chromium.launch({headless:true});
 await new Promise(resolve=>proxy.listen(port+1,'127.0.0.1',resolve));
 for(const appBase of [base,`http://127.0.0.1:${port+1}/ASME-Social-Hub`]) {
 const context=await browser.newContext();
 const page=await context.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(appBase+'/');
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{},{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('#campaign-list').getAttribute('aria-busy')==='false');
 assert.equal(await page.locator('#pwa-offline').isVisible(),false);
 const manifest=await page.evaluate(async()=>{const link=document.querySelector('link[rel=manifest]');return (await fetch(link.href)).json();});
 assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'./');
 for(const icon of manifest.icons) assert.equal((await fetch(`${appBase}/${icon.src}`)).ok,true);
 await page.locator('[data-view=settings]').click();
 assert.equal(await page.locator('#pwa-panel').isVisible(),true);
 // A fresh public response must be fetched on every request, including explicit no-store.
 const result=await page.evaluate(async()=>{
  const response=await fetch('./data/archive-index.json',{cache:'no-store'});
  const health=await fetch('./data/dispatcher-health.json',{cache:'no-store'});
  return {archive:response.ok,health:health.ok};
 });
 assert.equal(result.archive,true);assert.equal(result.health,true);
 await context.setOffline(true);
 await page.reload();
 await page.waitForFunction(()=>document.querySelector('#campaign-list').getAttribute('aria-busy')==='false');
 assert.equal(await page.locator('#pwa-offline').isVisible(),true);
 assert.match(await page.locator('#pwa-offline').textContent(),/saved public copy/);
 const offline=await page.evaluate(async()=>{
  const cached=await (await fetch('./data/archive-index.json')).json();
  const fails=async(url,options)=>{try{await fetch(url,options);return false;}catch{return true;}};
  return {cached:!!cached,health:await fails('./data/dispatcher-health.json'),write:await fails('./__preview/campaign',{method:'POST',body:'{}'}),auth:await fails('./data/archive-index.json',{headers:{Authorization:'Bearer test-only'}}),github:await fails('https://api.github.com/user')};
 });
 assert.deepEqual(offline,{cached:true,health:true,write:true,auth:true,github:true});
 const keys=await page.evaluate(async()=>{const result=[];for(const name of await caches.keys()){for(const req of await (await caches.open(name)).keys())result.push(req.url);}return result;});
 assert.ok(keys.length>20);assert.ok(keys.every(url=>url.startsWith(appBase)));
 assert.ok(!keys.some(url=>/dispatcher-health\.json|token-warning\.json|api\.github|__preview/.test(url)));
 await context.setOffline(false);await page.reload();
 await page.waitForFunction(()=>document.querySelector('#campaign-list').getAttribute('aria-busy')==='false');
 assert.equal(await page.locator('#pwa-offline').isVisible(),false);
 assert.deepEqual(errors,[]);
 await context.close();
 }
 console.log('PWA browser checks passed: install metadata, offline reload, public snapshot, network-only health/auth/writes, and reconnect.');
} finally {await browser?.close();server.kill();proxy.close();}
