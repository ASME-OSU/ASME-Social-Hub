// Generated into docs/sw.js by scripts/pwa.mjs. Keep all URLs inside this app's scope.
const VERSION = '__VERSION__';
const FILES = __FILES__;
const BASE = new URL('./', self.location.href);
const PREFIX = `social-hub:${BASE.pathname}:`;
const CACHE = PREFIX + VERSION;
const PUBLIC_DATA = new Set(['config/chapter.json', 'data/archive-index.json', 'data/candidates.json']);
const URLS = new Set(FILES.map(path => new URL(path, BASE).href));
self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(path => new Request(new URL(path, BASE), {cache:'reload'})))));
});
self.addEventListener('activate', event => {
 event.waitUntil((async () => {
  for(const name of await caches.keys()) if(name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
  await self.clients.claim();
 })());
});
self.addEventListener('fetch', event => {
 const request = event.request;
 const url = new URL(request.url);
 if(request.method !== 'GET' || request.headers.has('Authorization') || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
 const path = url.pathname.slice(BASE.pathname.length) || 'index.html';
 // Never cache operational health, tokens, APIs, writes, or arbitrary navigations.
 const canonical = new URL(path, BASE).href;
 if(!URLS.has(canonical)) return;
 event.respondWith((async () => {
  const cache = await caches.open(CACHE);
  if(PUBLIC_DATA.has(path)) {
   try {
    const response = await fetch(request);
    if(response.ok) await cache.put(canonical, response.clone()).catch(() => {});
    return response; // A server error must remain an error, not become stale success.
   } catch(error) {
    const cached = await cache.match(canonical);
    if(!cached) throw error;
    const client = await self.clients.get(event.clientId);
    client?.postMessage({type:'PWA_CACHED_DATA'});
    return cached;
   }
  }
  return (await cache.match(canonical)) || fetch(request);
 })());
});
