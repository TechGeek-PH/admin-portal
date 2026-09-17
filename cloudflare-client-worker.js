const ORIGIN = 'https://techgeek-ph.github.io/admin-portal';
const APK_ORIGIN = 'https://techgeek-ph.github.io/Payment-Center-V1.0/client-app-download/TechGeekPH-Client-v3.0.0.apk';

function mapPath(pathname) {
  if (pathname === '/' || pathname === '') return '/client/main.html';
  if (pathname === '/dashboard' || pathname === '/dashboard/') return '/client/index.html';
  if (pathname === '/payment' || pathname === '/payment/') return '/client/payment.html';
  if (pathname === '/downloads' || pathname === '/downloads/') return '/client/downloads.html';
  if (pathname.startsWith('/assets/')) return pathname;
  if (pathname.startsWith('/client/')) return pathname;
  return '/client' + pathname;
}

export default {
  async fetch(request) {
    const incoming = new URL(request.url);

    if (incoming.pathname === '/downloads/TechGeekPH-Client-v3.0.0.apk') {
      const apk = await fetch(APK_ORIGIN);
      const headers = new Headers(apk.headers);
      headers.set('Content-Type', 'application/vnd.android.package-archive');
      headers.set('Content-Disposition', 'attachment; filename="TechGeekPH-Client-v3.0.0.apk"');
      headers.set('Cache-Control', 'no-store');
      return new Response(apk.body, { status: apk.status, statusText: apk.statusText, headers });
    }

    const target = new URL(ORIGIN + mapPath(incoming.pathname));
    target.search = incoming.search;

    const upstream = await fetch(new Request(target.toString(), request), {
      cf: { cacheEverything: false }
    });

    const headers = new Headers(upstream.headers);
    headers.set('X-TechGeekPH-Origin', 'admin-portal-client');
    headers.set('X-Content-Type-Options', 'nosniff');

    if (
      incoming.pathname === '/' ||
      incoming.pathname === '/dashboard' ||
      incoming.pathname === '/dashboard/' ||
      incoming.pathname === '/payment' ||
      incoming.pathname === '/payment/' ||
      incoming.pathname === '/downloads' ||
      incoming.pathname === '/downloads/' ||
      incoming.pathname.endsWith('.html') ||
      incoming.pathname.endsWith('.js')
    ) {
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    });
  }
};
