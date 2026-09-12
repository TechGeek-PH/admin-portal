const ORIGIN = 'https://techgeek-ph.github.io/admin-portal';

function mapPath(pathname) {
  if (pathname === '/' || pathname === '') return '/client/';
  if (pathname === '/payment' || pathname === '/payment/') return '/client/payment.html';
  if (pathname.startsWith('/assets/')) return pathname;
  if (pathname.startsWith('/client/')) return pathname;
  return '/client' + pathname;
}

export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const target = new URL(ORIGIN + mapPath(incoming.pathname));
    target.search = incoming.search;

    const upstream = await fetch(new Request(target.toString(), request), {
      cf: { cacheEverything: false }
    });

    const headers = new Headers(upstream.headers);
    headers.set('X-TechGeekPH-Origin', 'admin-portal-client');
    headers.set('X-Content-Type-Options', 'nosniff');
    if (incoming.pathname === '/payment' || incoming.pathname === '/payment/' || incoming.pathname.endsWith('.html') || incoming.pathname.endsWith('.js')) {
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    });
  }
};
