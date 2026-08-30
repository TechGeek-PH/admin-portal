const CACHE_NAME='techgeekph-installer-v11';
const APP_SHELL=[
  '/admin-portal/app.html',
  '/admin-portal/network-monitor.html',
  '/admin-portal/technician-checklist.html',
  '/admin-portal/installer-manifest.webmanifest',
  '/admin-portal/assets/TechGeekPH%20-%20logo.png'
];

async function fetchFresh(req,url){
  const fresh=await fetch(req,{cache:'no-store'});
  const type=fresh.headers.get('content-type')||'';
  if(type.includes('text/html')){
    let text=await fresh.text();
    let changed=false;
    if((url.pathname.endsWith('/app.html')||url.pathname.endsWith('/app-tickets.html'))&&!text.includes('client-proof-entry.js')){
      text=text.replace('</body>','<script src="assets/client-proof-entry.js?v=20260830-4"></script></body>');changed=true;
    }
    if(url.pathname.endsWith('/app.html')&&!text.includes('network-monitor-entry.js')){
      text=text.replace('</body>','<script src="assets/network-monitor-entry.js?v=20260830-3"></script></body>');changed=true;
    }
    if(changed){
      const headers=new Headers(fresh.headers);headers.set('cache-control','no-store, no-cache, must-revalidate');headers.delete('content-length');
      return new Response(text,{status:fresh.status,statusText:fresh.statusText,headers});
    }
  }
  return fresh;
}

function offlinePage(title,message){
  return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font-family:system-ui;margin:0;background:#f3f6fa;color:#17355d}.box{max-width:520px;margin:70px auto;padding:24px;text-align:center}.btn{display:inline-block;margin-top:16px;padding:12px 18px;border:0;border-radius:10px;background:#064f83;color:#fff;font-weight:800}</style></head><body><div class="box"><h2>${title}</h2><p>${message}</p><button class="btn" onclick="location.reload()">Retry</button></div></body></html>`,{status:503,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}

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

  const freshUi =
    url.pathname.includes('technician-checklist') ||
    url.pathname.includes('technician-live-sync') ||
    url.pathname.includes('service-catalog') ||
    url.pathname.includes('client-proof') ||
    url.pathname.includes('network-monitor') ||
    url.pathname.endsWith('/app.html') ||
    url.pathname.endsWith('/app-tickets.html') ||
    url.pathname.endsWith('/tickets.html') ||
    url.pathname.endsWith('/application_form.html') ||
    url.pathname.endsWith('/assets/admin-nav.js') ||
    /\/app-v[2-6]\.html$/.test(url.pathname);

  if(freshUi){
    event.respondWith((async()=>{
      try{
        const fresh=await fetchFresh(req,url);
        const cache=await caches.open(CACHE_NAME);
        cache.put(req,fresh.clone()).catch(()=>{});
        return fresh;
      }catch(e){
        const exact=await caches.match(req);
        if(exact) return exact;
        if(url.pathname.includes('network-monitor')) return offlinePage('Network Monitor unavailable','Unable to load the Network Monitor right now. Check the connection and retry.');
        if(url.pathname.includes('client-proof')) return offlinePage('Client Proof Photos unavailable','Unable to load this module right now. Check the connection and retry.');
        if(url.pathname.endsWith('/app-tickets.html')||url.pathname.includes('technician-checklist')){
          return (await caches.match('/admin-portal/technician-checklist.html')) || offlinePage('Technician Tickets unavailable','Unable to load technician tickets right now.');
        }
        return offlinePage('TechGeekPH module unavailable','Unable to load this module right now. Check the connection and retry.');
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
      return offlinePage('TechGeekPH offline','This resource is not available while offline.');
    }
  })());
});
