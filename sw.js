const CACHE_APP = 'c555-app-v1785429817';
const CACHE_TILES = 'c555-tiles-v1';
const APP_SHELL = ["./index.html", "./manifest.webmanifest", "./aide.html"];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_APP).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n.startsWith('c555-app-') && n !== CACHE_APP).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Crew positions: always network (never cache stale rider locations).
  if (url.hostname.includes('firebasedatabase.app') || url.hostname.includes('firebaseio.com')) {
    e.respondWith(fetch(e.request));
    return;
  }
  // Tile requests: cache-first
  if (url.hostname.includes('tiles.openfreemap.org') && (url.pathname.includes('.pbf') || url.pathname.includes('/fonts/') || url.pathname.includes('/sprites/'))) {
    e.respondWith(
      caches.open(CACHE_TILES).then(c =>
        c.match(e.request).then(hit => {
          if (hit) return hit;
          return fetch(e.request).then(resp => {
            if (resp.ok || resp.type === 'opaque') c.put(e.request, resp.clone());
            return resp;
          }).catch(() => new Response('', {status: 503}));
        })
      )
    );
    return;
  }
  // CDN assets (maplibre JS/CSS): cache-first
  if (url.hostname === 'unpkg.com') {
    e.respondWith(
      caches.open(CACHE_APP).then(c =>
        c.match(e.request).then(hit => {
          if (hit) return hit;
          return fetch(e.request).then(resp => {
            if (resp.ok) c.put(e.request, resp.clone());
            return resp;
          });
        })
      )
    );
    return;
  }
  // App shell: cache-first for race use. The site is frozen at build time and
  // must remain available even with unstable mountain/roaming connectivity.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(CACHE_APP).then(c =>
        c.match(e.request).then(hit => {
          if (hit) return hit;
          return fetch(e.request).then(resp => {
            if (e.request.method === 'GET' && resp.ok) c.put(e.request, resp.clone());
            return resp;
          });
        })
      )
    );
    return;
  }
  // Everything else: cache-first when already seen, network fallback otherwise.
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request))
  );
});
