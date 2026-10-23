// Generated into docs/sw.js by scripts/pwa.mjs. Keep all URLs inside this app's scope.
const VERSION = 'bf8d01bcab870a13';
const FILES = ["academic-years.mjs","app.js","assets/fonts/dm-serif-display-latin.woff2","assets/fonts/inter-latin.woff2","assets/icons/facebook-mono.svg","assets/icons/linkedin-blue.png","assets/icons/linkedin-white.png","assets/icons/linktree.svg","assets/logos/apple-touch-icon.png","assets/logos/chapter-simple.png","assets/logos/favicon-32.png","assets/logos/groupme-bot.png","assets/logos/icon-512.png","assets/logos/mark.png","assets/logos/primary-reverse.png","assets/logos/primary.png","assets/logos/social-hub-180.png","assets/logos/social-hub-192.png","assets/logos/social-hub-32.png","assets/logos/social-hub-512.png","assets/logos/social-hub.png","assets/social-preview.png","calendar-changes.mjs","calendar-links.mjs","calendar-suggestions.mjs","campaign-delete.mjs","campaign-insights.mjs","campaign-save.mjs","caption.mjs","carousel.mjs","channel-preferences.mjs","config/chapter.json","data/archive-index.json","data/candidates.json","detail-preview.mjs","dispatcher-health.mjs","display-time.mjs","editor-sections.mjs","event-links.mjs","event-page.css","event-page.mjs","event.css","event.mjs","flyer-preview.mjs","flyer-render.mjs","flyer-uploads.mjs","github-access.mjs","groupme-message.mjs","groupme-preview.mjs","home-campaigns.mjs","hub-design.css","hub-guide.mjs","image-policy.mjs","index.html","instagram-preview.mjs","manifest.webmanifest","pwa.mjs","revision-conflict.mjs","schedule-status.mjs","schedule-warning.mjs","social-links.mjs","story-controls.mjs","story-design.mjs","styles.css","templates/assembly-card.html","templates/blueprint.html","templates/editorial-poster.html","templates/editorial.html","templates/refined-blueprint.html","theme.mjs","time.mjs"];
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
