const CACHE_NAME='techgeekph-installer-v3';
const APP_SHELL=[
  '/admin-portal/technician-checklist.html',
  '/admin-portal/installer-manifest.webmanifest',
  '/admin-portal/assets/TechGeekPH%20-%20logo.png'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).catch(()=>{}));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;

  const freshUi = url.pathname.includes('technician-checklist') ||
    url.pathname.includes('technician-live-sync') ||
    url.pathname.includes('service-catalog') ||
    url.pathname.endsWith('/app.html') ||
    url.pathname.endsWith('/app-tickets.html') ||
    /\/app-v[2-6]\.html$/.test(url.pathname);

  if(freshUi){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(req,{cache:'no-store'});
        const cache=await caches.open(CACHE_NAME);
        cache.put(req,fresh.clone()).catch(()=>{});
        return fresh;
      }catch(e){
        return (await caches.match(req)) || (await caches.match('/admin-portal/technician-checklist.html'));
      }
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(req);
    if(cached) return cached;
    try{
      const fresh=await fetch(req);
      const cache=await caches.open(CACHE_NAME);
      cache.put(req,fresh.clone()).catch(()=>{});
      return fresh;
    }catch(e){
      return caches.match('/admin-portal/technician-checklist.html');
    }
  })());
});
