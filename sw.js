// Service Worker для Мебель Фаворит — V41
// Стратегии:
//   - HTML / index — network-first (свежий контент с фолбэком в кэш при оффлайне)
//   - catalog.js и catalog-data/*.js — network-first (данные каталога всегда свежие)
//   - Прочая статика (CSS/шрифты/изображения собственного домена) — stale-while-revalidate
//   - Чужие домены (images.weserv.nl, fonts.gstatic.com) — cache-first
//   - sitemap.xml / stock.xlsx — network-first без кэширования при ошибке
// Версия кэша поднимается при обновлении сайта — старые кэши удаляются автоматически.

const SW_VERSION = 'mf-v41-149';
const PRECACHE = SW_VERSION + '-precache';
const RUNTIME  = SW_VERSION + '-runtime';
// V41_147: кэш ВЕРСИОНИРОВАННЫХ данных каталога (catalog.js?v=… и
// catalog-data/*?v=…). Живёт МЕЖДУ релизами: имя без номера версии, activate
// его не чистит. Версия зашита в ?v= (хэш содержимого, sync_versions):
// совпал URL — данные точно те же, сеть не нужна вовсе.
const DATA_CACHE = 'mf-data-v1';

// Минимальный набор ресурсов для оффлайн-загрузки.
// V41_146: тяжёлые JS убраны — они качались при установке SW ПО ГОЛЫМ путям
// (без ?v=хэш), никогда не матчились с запросами страницы и добавляли ~4 МБ
// лишнего трафика на каждое обновление версии. Оффлайн обслуживает RUNTIME-кэш,
// который заполняется правильными URL (с ?v=) при первом визите.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/og-preview.jpg',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PRECACHE).then(cache => 
      // Прекэшируем поодиночке — чтобы один битый URL не сломал всю установку
      Promise.all(PRECACHE_URLS.map(url => 
        cache.add(url).catch(err => console.warn('[sw] precache skip', url, err.message))
      ))
    )
    // НЕ зовём skipWaiting автоматически: новая версия ждёт мягкого применения
    // (по плашке «Обновить» или при следующем действии — см. index.html A+B).
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Удаляем старые кэши (любая версия кроме текущей)
    const keys = await caches.keys();
    // V41_146: чистим только кэши нашего префикса — чужие имена не трогаем
    await Promise.all(keys.filter(k => k.startsWith('mf-v41-') && k !== PRECACHE && k !== RUNTIME).map(k => caches.delete(k)));
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

  // 1a2. V41_147: версионированные данные каталога — cache-first по точному
  // URL с ?v=хэш. Свежесть гарантирует index.html (network-first): новый релиз
  // приносит новые ?v=, старые версии файла вычищаются при загрузке новой.
  const isVersionedData = (url.pathname.endsWith('/catalog.js') || url.pathname.includes('/catalog-data/'))
                        && /(^|[?&])v=/.test(url.search);
  if(isVersionedData){
    event.respondWith((async () => {
      const cache = await caches.open(DATA_CACHE);
      const hit = await cache.match(req);
      if(hit) return hit;
      try{
        // Чистый запрос по URL, а не исходный req: script-теги несут условные
        // заголовки (If-Modified-Since) и сервер отвечает 304 без тела — такой
        // ответ невозможно положить в кэш. fetch по URL всегda даёт 200 с телом
        // (из HTTP-кэша браузера или из сети).
        const resp = await fetch(url.href, {cache: 'default'});
        if(resp && resp.status === 200){
          // Ошибка ХРАНИЛИЩА (квота и т.п.) не должна подменять свежий ответ
          // старьём — сохраняем в фоне, ответ отдаём в любом случае (Codex).
          event.waitUntil((async () => {
            await cache.put(req, resp.clone());
            // старые версии того же файла больше не нужны — чистим, чтобы
            // хранилище не росло на мегабайты с каждым релизом
            const keys = await cache.keys();
            await Promise.all(keys.filter(k => {
              const u = new URL(k.url);
              return u.pathname === url.pathname && u.search !== url.search;
            }).map(k => cache.delete(k)));
          })().catch(()=>{}));
        }
        return resp;
      }catch(_){
        // сеть упала: любая сохранённая версия файла лучше, чем ничего
        const any = (await cache.keys()).find(k => new URL(k.url).pathname === url.pathname);
        if(any) return cache.match(any);
        throw _;
      }
    })());
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
          event.waitUntil(caches.open(RUNTIME).then(cache => cache.put(req, copy)).catch(()=>{}));
        } else if(resp && resp.status >= 500){
          // V41_146: сервер временно отвечает ошибкой — отдаём рабочую копию из кэша
          return caches.match(req).then(r => r || resp);
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
        // V41_146: кэшируем только успешный ответ — временная 500-страница
        // не должна затирать рабочую копию в кэше
        if(resp && resp.ok){
          const copy = resp.clone();
          event.waitUntil(caches.open(RUNTIME).then(cache => cache.put(req, copy)).catch(()=>{}));
        } else if(resp && resp.status >= 500){
          return caches.match(req).then(r => r || resp);
        }
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
            event.waitUntil(caches.open(RUNTIME).then(cache => cache.put(req, copy)).catch(()=>{}));
          }
          return resp;
        }).catch(() => cached);
        // V41_146: фоновую ревалидацию удерживаем, чтобы браузер не убил SW
        // до завершения записи в кэш
        if(cached) event.waitUntil(fetchPromise.catch(()=>{}));
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
          event.waitUntil(caches.open(RUNTIME).then(cache => cache.put(req, copy)).catch(()=>{}));
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
