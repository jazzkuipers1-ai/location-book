/* Location Book — Service Worker
   Caches the full app shell (local + CDN) so it loads offline.
   Supabase API calls are never intercepted — they go to network only.        */

const CACHE = 'lb-v6';

const LOCAL = [
  '/',
  '/index.html',
  '/app/styles.css',
  '/app/styles-2.css',
  '/app/styles-mobile.css',
  '/app/db.js',
  '/app/supabase.js',
  '/app/seed.js',
  '/app/parser.js',
  '/app/Home.jsx',
  '/app/tweaks-panel.jsx',
  '/app/components.jsx',
  '/app/CropModal.jsx',
  '/app/ShareView.jsx',
  '/app/ShareModal.jsx',
  '/app/ScheduleDiff.jsx',
  '/app/PasswordModal.jsx',
  '/app/MobileNav.jsx',
  '/app/Annotator.jsx',
  '/app/SketchPad.jsx',
  '/app/Adjustments.jsx',
  '/app/Sidebar.jsx',
  '/app/LocationFile.jsx',
  '/app/AddLocationModal.jsx',
  '/app/Board.jsx',
  '/app/Deck.jsx',
  '/app/App.jsx',
];

const CDN = [
  'https://unpkg.com/react@18.3.1/umd/react.development.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js',
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://cdn.jsdelivr.net/npm/cropperjs@1.5.13/dist/cropper.min.js',
  'https://cdn.jsdelivr.net/npm/cropperjs@1.5.13/dist/cropper.min.css',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      // Local files: standard cache
      await cache.addAll(LOCAL).catch(() => {});
      // CDN files: fetch with CORS so we get a cacheable response
      await Promise.allSettled(
        CDN.map(url =>
          fetch(url, { mode: 'cors', credentials: 'omit' })
            .then(r => { if (r.ok || r.type === 'opaque') cache.put(url, r); })
            .catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept Supabase API / storage — always needs network
  if (url.hostname.includes('supabase.co')) return;
  // Never intercept Google Fonts (complex CSS + CORS, low benefit)
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) return;
  // Never intercept non-GET requests
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      // Cache hit — serve immediately, revalidate in background for local files
      if (cached) {
        if (url.origin === self.location.origin) {
          // Stale-while-revalidate for local app files
          fetch(e.request).then(fresh => {
            if (fresh.ok) caches.open(CACHE).then(c => c.put(e.request, fresh));
          }).catch(() => {});
        }
        return cached;
      }
      // Cache miss — fetch from network and cache it
      return fetch(e.request, url.origin !== self.location.origin ? { mode: 'cors', credentials: 'omit' } : {})
        .then(r => {
          if (r.ok) {
            const clone = r.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return r;
        })
        .catch(() => cached || new Response('Offline', { status: 503 }));
    })
  );
});
