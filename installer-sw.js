const CACHE_NAME='techgeekph-installer-v4';
const APP_SHELL=[
  '/admin-portal/technician-checklist.html',
  '/admin-portal/installer-manifest.webmanifest',
  '/admin-portal/assets/TechGeekPH%20-%20logo.png'
];

function patchTechGeekHtml(url,text){
  if(url.pathname.endsWith('/app.html')){
    // Employee field workflow: Repair and Relocation are ticket-only.
    // Keep New Installation as the only standalone service form.
    text=text
      .replace(",['application_form.html?form=repair','🛠','Repair Form','Existing client repair request']",'')
      .replace(",['application_form.html?form=relocation','↔','Relocation Form','Existing client transfer request']",'')
      .replace("const BUILD='20260830-ticket-ui-v6'","const BUILD='20260830-ticket-ui-v7'");
  }

  if(url.pathname.endsWith('/app-tickets.html')){
    // Give repair and relocation tickets their own technician checklist inside Update Ticket.
    const needle="else if(/install/.test(text))a=['Verify approved installation scope and client details','Inspect route, power, NAP/port and required materials','Install/mount/cable equipment safely','Configure ONU/router/service credentials','Run optical, ping and speed tests','Document final setup and client turnover'];";
    const replacement="else if(/relocat|transfer|lipat/.test(text))a=['Confirm current service location, target relocation address and approved scope','Inspect existing ONU/router/drop fiber and identify reusable equipment/materials','Verify target NAP/port, fiber route, power source and installation path','Safely remove/transfer equipment and install the new drop/fiber route as required','Reconnect/configure ONU/router and verify registration, optical level, ping and speed','Record old and new location details, materials used, test results and client turnover'];else if(/repair|troubleshoot|trouble|no internet|offline|intermittent/.test(text))a=['Confirm the reported problem and reproduce the client symptom','Inspect ONU/router, power, connectors, cabling/fiber and service indicators','Diagnose and record the exact root cause before repair','Repair, replace or reconfigure the approved faulty item or connection','Run final optical/WAN, ping and speed/function tests after repair','Record work done, materials used, final result and client confirmation'];else if(/install/.test(text))a=['Verify approved installation scope and client details','Inspect route, power, NAP/port and required materials','Install/mount/cable equipment safely','Configure ONU/router/service credentials','Run optical, ping and speed tests','Document final setup and client turnover'];";
    if(text.includes(needle)) text=text.replace(needle,replacement);
  }
  return text;
}

async function networkFresh(req,url){
  const fresh=await fetch(req,{cache:'no-store'});
  const type=fresh.headers.get('content-type')||'';
  if(type.includes('text/html') && (url.pathname.endsWith('/app.html') || url.pathname.endsWith('/app-tickets.html'))){
    const original=await fresh.text();
    const patched=patchTechGeekHtml(url,original);
    const headers=new Headers(fresh.headers);
    headers.set('cache-control','no-store, no-cache, must-revalidate');
    headers.delete('content-length');
    return new Response(patched,{status:fresh.status,statusText:fresh.statusText,headers});
  }
  return fresh;
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

  const freshUi = url.pathname.includes('technician-checklist') ||
    url.pathname.includes('technician-live-sync') ||
    url.pathname.includes('service-catalog') ||
    url.pathname.endsWith('/app.html') ||
    url.pathname.endsWith('/app-tickets.html') ||
    /\/app-v[2-6]\.html$/.test(url.pathname);

  if(freshUi){
    event.respondWith((async()=>{
      try{
        const fresh=await networkFresh(req,url);
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
