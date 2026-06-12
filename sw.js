// Service Worker для Мебель Фаворит — V41
// Стратегии:
//   - HTML / index — network-first (свежий контент с фолбэком в кэш при оффлайне)
//   - catalog.js и catalog-data/*.js — network-first (данные каталога всегда свежие)
//   - Прочая статика (CSS/шрифты/изображения собственного домена) — stale-while-revalidate
//   - Чужие домены (images.weserv.nl, fonts.gstatic.com) — cache-first
//   - sitemap.xml / stock.xlsx — network-first без кэширования при ошибке
// Версия кэша поднимается при обновлении сайта — старые кэши удаляются автоматически.

const SW_VERSION = 'mf-v41-45';
const PRECACHE = SW_VERSION + '-precache';
const RUNTIME  = SW_VERSION + '-runtime';

// Минимальный набор ресурсов для оффлайн-загрузки
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/catalog.js',
  '/catalog-data/wardrobe-attic.js',
  '/catalog-data/bed-options.js',
  '/catalog-data/wardrobe-coupe.js',
  '/catalog-data/seat-options.js',
  '/og-preview.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PRECACHE).then(cache => 
      // Прекэшируем поодиночке — чтобы один битый URL не сломал всю установку
      Promise.all(PRECACHE_URLS.map(url => 
        cache.add(url).catch(err => console.warn('[sw] precache skip', url, err.message))
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Удаляем старые кэши (любая версия кроме текущей)
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== PRECACHE && k !== RUNTIME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // Не кэшируем не-GET и админ-эндпоинты
  if(url.pathname.startsWith('/api/') || url.search.includes('admin=')) return;

  // 1. stock.xlsx и sitemap.xml — network-first без записи в кэш при неудаче
  if(url.pathname.includes('stock.xlsx') || url.pathname.includes('sitemap')){
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // 1b. Данные каталога (catalog.js и catalog-data/*.js) — network-first.
  // Эти файлы меняются при каждом обновлении ассортимента/фото, поэтому
  // их нужно тянуть свежими сразу, а не через один заход (как было при
  // stale-while-revalidate). Кэш используется только как офлайн-фолбэк.
  const isCatalogData = url.pathname.endsWith('/catalog.js')
                      || url.pathname.includes('/catalog-data/');
  if(isCatalogData){
    event.respondWith(
      fetch(req).then(resp => {
        if(resp && resp.status === 200){
          const copy = resp.clone();
          caches.open(RUNTIME).then(cache => cache.put(req, copy));
        }
        return resp;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // 2. HTML-страницы — network-first
  const isHTML = req.headers.get('accept')?.includes('text/html') 
               || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  if(isHTML){
    event.respondWith(
      fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(RUNTIME).then(cache => cache.put(req, copy));
        return resp;
      }).catch(() => caches.match(req).then(r => r || caches.match('/index.html')))
    );
    return;
  }

  // 3. Свой домен: JS / CSS / изображения — stale-while-revalidate
  if(url.origin === self.location.origin){
    event.respondWith(
      caches.match(req).then(cached => {
        const fetchPromise = fetch(req).then(resp => {
          if(resp && resp.status === 200){
            const copy = resp.clone();
            caches.open(RUNTIME).then(cache => cache.put(req, copy));
          }
          return resp;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 4. Чужие домены (CDN, weserv, шрифты) — cache-first с фоновым обновлением
  event.respondWith(
    caches.match(req).then(cached => {
      if(cached) return cached;
      return fetch(req).then(resp => {
        if(resp && (resp.status === 200 || resp.type === 'opaque')){
          const copy = resp.clone();
          caches.open(RUNTIME).then(cache => cache.put(req, copy));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});

// Сообщение SKIP_WAITING — для принудительного обновления
self.addEventListener('message', event => {
  if(event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
