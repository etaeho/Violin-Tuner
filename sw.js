// 버전 올리면 예전 캐시 삭제됨
const CACHE = 'violin-tuner-v2';

const PRECACHE = [
  './',
  'index.html',
  'manifest.json',
  'icons/icon.svg',
  'vendor/react.production.min.js',
  'vendor/react-dom.production.min.js',
  'vendor/lucide-react.min.js',
  'vendor/babel.min.js',
  'https://cdn.tailwindcss.com',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(PRECACHE.map(url => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 네트워크 우선 → 실패하면 캐시 (수정한 내용이 바로 반영되고, 오프라인이면 캐시로 동작)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(response => {
      if (response && response.status === 200 && response.type !== 'opaque') {
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
      }
      return response;
    }).catch(() =>
      caches.match(e.request).then(c => c || caches.match('index.html'))
    )
  );
});
