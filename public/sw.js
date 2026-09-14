const CACHE='smartscan-x-pro-v1';
const APP_SHELL=['/','/index.html','/src/main.jsx','/src/styles.css','/src/final-fixes.css'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL).catch(()=>{})).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(res=>{if(res.ok&&new URL(event.request.url).origin===location.origin){const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy))}return res}).catch(()=>cached||caches.match('/index.html'))))});
