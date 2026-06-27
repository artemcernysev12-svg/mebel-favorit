// ========== ЛЕНИВАЯ ЗАГРУЗКА ТЯЖЁЛЫХ СКРИПТОВ ==========
// kitchen-comp.js (~645 КБ) и kitchen-pools.js (~2.1 МБ) нужны
// только когда пользователь открывает карточку кухни / гарнитура / прихожей.
// SheetJS (~900 КБ) нужен только при работе с файлом остатков.
// Поэтому грузим их не сразу на главной, а по мере необходимости.
const _loadedScripts = new Map();
function loadScriptOnce(src){
  if(_loadedScripts.has(src)) return _loadedScripts.get(src);
  const p = new Promise((resolve, reject)=>{
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = ()=>resolve();
    s.onerror = ()=>{ _loadedScripts.delete(src); reject(new Error('Не удалось загрузить '+src)); };
    document.head.appendChild(s);
  });
  _loadedScripts.set(src, p);
  return p;
}
// Категории, которые реально используют данные из kitchen-comp / kitchen-pools
const KITCHEN_BUILDER_CATS = new Set(['Кухни','Гарнитуры и комплекты','Спальные гарнитуры','Прихожие и обувницы']);
function itemNeedsKitchenData(it){
  if(!it) return false;
  return KITCHEN_BUILDER_CATS.has(String(it.c || it.sheet || ''));
}
async function ensureKitchenData(){
  if(typeof window.__KITCHEN_COMP__ !== 'undefined' && typeof window.__KITCHEN_POOL__ !== 'undefined' && typeof window.__AGAVA_MODULES__ !== 'undefined') return;
  await Promise.all([
    loadScriptOnce('catalog-data/kitchen-comp.js?v=01844a0b'),
    loadScriptOnce('catalog-data/kitchen-pools.js?v=4ef74692'),
    loadScriptOnce('catalog-data/agava-modules.js?v=9b91d0ce')
  ]);
}
async function ensureXLSX(){
  if(typeof XLSX !== 'undefined') return;
  await loadScriptOnce('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
}
// В фоне, когда браузер простаивает, можно тихо подгрузить kitchen-данные
// заранее — чтобы при клике на карточку гарнитура/кухни не было паузы.
// Делаем это не раньше, чем через 3 секунды после загрузки, и только если
// соединение не экономное.
(function preloadKitchenDataWhenIdle(){
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  const saveData = !!(conn && conn.saveData);
  const slowNet = saveData || (conn && ['slow-2g','2g','3g'].includes(String(conn.effectiveType||'').toLowerCase()));
  if(slowNet) return; // на медленном/экономном не грузим вообще, пока пользователь не попросит
  const start = ()=>{
    ensureKitchenData().then(()=>{
      // Наличие гарнитуров вычисляется из состава модулей. Пока kitchen-comp
      // не был загружен, карточки гарнитуров не знали своего правильного статуса.
      // Теперь данные есть — пере-рендерим текущий список, чтобы бейджи
      // "В наличии" обновились.
      if(typeof apply === 'function') apply();
    }).catch(()=>{});
  };
  if('requestIdleCallback' in window){
    setTimeout(()=>requestIdleCallback(start, {timeout:6000}), 3000);
  } else {
    setTimeout(start, 4000);
  }
})();
// ==========================================================

// ========== НАСТРОЙКИ МАГАЗИНА ==========
// vkClubUrl — ссылка на саму страницу/группу ВК (стена, отзывы, фото)
// vkChatUrl — ссылка для написания сообщения. Если оставить пустым,
//   будет автоматически сформирована из vkClubUrl в виде vk.com/write-XXXXX
//   — этот формат работает и на десктопе, и в мобильном приложении ВК.
window.SHOP_CONFIG = {
  name: "Мебель Фаворит",
  city: "Стерлитамак",
  deliveryNote: "Доставка по Стерлитамаку и районам до 60 км",
  vkClubUrl: "https://vk.com/club77061353",
  vkChatUrl: "", // если пусто — генерится автоматически из vkClubUrl
  avitoShopUrl: "https://www.avito.ru/brands/i257017886/all/mebel_i_interer?sellerId=609e2f55b76a86b717ae9621aae47555",
  phone: "8 993 052 66 54",
  maxPhone: "8 999 622 66 54",
  siteUrl: "https://мебель-фаворит.рф/"
};

// ============================================================
// SEO ДЛЯ ОДНОСТРАНИЧНОГО КАТАЛОГА
// ============================================================
// Сайт остаётся одной HTML-страницей, но при открытии категории или товара
// обновляем title, description, canonical, Open Graph и JSON-LD Product.
// Это помогает поисковикам лучше понимать ?cat=... и ?item=... ссылки из sitemap.
const SEO_BASE_URL = 'https://мебель-фаворит.рф/';
function seoCleanText(v, maxLen){
  const txt = String(v || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  return maxLen && txt.length > maxLen ? txt.slice(0, maxLen - 1).trim() + '…' : txt;
}
function seoUrl(params){
  const u = new URL(SEO_BASE_URL);
  Object.entries(params || {}).forEach(([k,v])=>{ if(v !== undefined && v !== null && String(v) !== '') u.searchParams.set(k, String(v)); });
  return u.toString();
}
function seoSetMeta(selector, attr, value){
  if(value === undefined || value === null) return;
  let el = document.querySelector(selector);
  if(!el){
    el = document.createElement('meta');
    const mName = selector.match(/meta\[(name|property)=["']([^"']+)["']\]/);
    if(mName) el.setAttribute(mName[1], mName[2]);
    document.head.appendChild(el);
  }
  el.setAttribute(attr || 'content', String(value));
}
function seoSetLink(rel, href){
  let el = document.querySelector('link[rel="'+rel+'"]');
  if(!el){ el = document.createElement('link'); el.rel = rel; document.head.appendChild(el); }
  el.href = href;
}
function seoItemTitle(it){
  const bits = [it && it.t, it && it.f, it && it.col, formatMainDimsShort(it)].filter(Boolean);
  return seoCleanText(bits.join(' · '), 95) + ' — Мебель Фаворит, Стерлитамак';
}
function seoItemDescription(it){
  const parts = [];
  if(it && it.t) parts.push(it.t);
  if(it && it.f) parts.push('производитель ' + it.f);
  const dims = formatMainDimsText(it); if(dims) parts.push(dims);
  if(it && it.p) parts.push('цена от ' + Number(it.p).toLocaleString('ru-RU') + ' ₽');
  parts.push('Мебель Фаворит: доставка по Стерлитамаку и районам до 60 км, консультация в сообщениях.');
  return seoCleanText(parts.join('. '), 180);
}
function seoApply({title, description, url, image, type}){
  title = seoCleanText(title || 'Мебель Фаворит — Стерлитамак, каталог мебели', 100);
  description = seoCleanText(description || 'Каталог мебели в Стерлитамаке: шкафы, кухни, диваны, кровати. Доставка по Стерлитамаку и районам до 60 км.', 180);
  url = url || SEO_BASE_URL;
  image = image || (SEO_BASE_URL + 'og-preview.jpg?v=369e2ee7');
  document.title = title;
  seoSetMeta('meta[name="description"]', 'content', description);
  seoSetLink('canonical', url);
  seoSetMeta('meta[property="og:type"]', 'content', type || 'website');
  seoSetMeta('meta[property="og:title"]', 'content', title);
  seoSetMeta('meta[property="og:description"]', 'content', description);
  seoSetMeta('meta[property="og:url"]', 'content', url);
  seoSetMeta('meta[property="og:image"]', 'content', image);
  seoSetMeta('meta[name="twitter:title"]', 'content', title);
  seoSetMeta('meta[name="twitter:description"]', 'content', description);
  seoSetMeta('meta[name="twitter:image"]', 'content', image);
}
function seoRemoveProductJsonLd(){
  const old = document.getElementById('seoProductJsonLd');
  if(old) old.remove();
  document.querySelectorAll('meta[property^="product:"]').forEach(el=>el.remove());
}
function seoSetProductJsonLd(it){
  seoRemoveProductJsonLd();
  if(!it) return;
  const offer = {
    '@type': 'Offer',
    priceCurrency: 'RUB',
    url: seoUrl({item: it.id}),
    availability: (it._inStock || (it._stockQty && Number(it._stockQty) > 0)) ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder'
  };
  if(it.p) offer.price = String(Number(it.p));
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: seoCleanText(it.t || 'Товар', 120),
    description: seoItemDescription(it),
    sku: String(it.art || it.id || ''),
    category: it.c || '',
    image: it.img ? [it.img] : [SEO_BASE_URL + 'og-preview.jpg?v=369e2ee7'],
    brand: it.f ? {'@type':'Brand', name: it.f} : undefined,
    offers: offer
  };
  Object.keys(data).forEach(k=>{ if(data[k] === undefined || data[k] === '') delete data[k]; });
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'seoProductJsonLd';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}
function updateSeoHome(){
  seoRemoveProductJsonLd();
  seoApply({
    title: 'Мебель Фаворит — Стерлитамак, каталог мебели',
    description: 'Мебель Фаворит — каталог мебели в Стерлитамаке: кухни, шкафы, диваны, кровати, столы. Доставка по Стерлитамаку и районам до 60 км.',
    url: SEO_BASE_URL,
    type: 'website'
  });
}
function updateSeoCategory(cat, count){
  seoRemoveProductJsonLd();
  const name = (typeof displayCategoryName === 'function' ? displayCategoryName(cat) : cat) || 'Каталог мебели';
  const n = Number(count || 0);
  seoApply({
    title: name + ' — купить в Стерлитамаке | Мебель Фаворит',
    description: name + ' в каталоге Мебель Фаворит. ' + (n ? ('Найдено ' + n + ' товаров. ') : '') + 'Поможем подобрать мебель по размерам, цвету и бюджету. Доставка по Стерлитамаку и районам до 60 км.',
    url: seoUrl({cat}),
    type: 'website'
  });
}
function updateSeoProduct(it){
  if(!it) return;
  const url = seoUrl({item: it.id});
  seoApply({
    title: seoItemTitle(it),
    description: seoItemDescription(it),
    url,
    image: it.img || (SEO_BASE_URL + 'og-preview.jpg?v=369e2ee7'),
    type: 'product'
  });
  seoSetProductJsonLd(it);
  if(it.p){
    seoSetMeta('meta[property="product:price:amount"]', 'content', Number(it.p));
    seoSetMeta('meta[property="product:price:currency"]', 'content', 'RUB');
  }
}
function updateSeoForState(){
  if(document.getElementById('mOv') && document.getElementById('mOv').classList.contains('open') && window.__CUR_ITEM__){
    updateSeoProduct(window.__CUR_ITEM__);
  } else if(typeof S !== 'undefined' && S.cat){
    const cnt = (typeof filtered !== 'undefined' && Array.isArray(filtered)) ? filtered.length : (Array.isArray(window.CATALOG) ? CATALOG.filter(x=>x.c===S.cat).length : 0);
    updateSeoCategory(S.cat, cnt);
  } else {
    updateSeoHome();
  }
}

// ============================================================
// СТАТИСТИКА ДЛЯ АДМИНА
// ============================================================
// Двухслойная система:
//   1. Яндекс.Метрика (вверху <head>) — реальная статистика всех посетителей,
//      смотреть на metrika.yandex.ru: посетители, города, устройства,
//      какие товары смотрят, откуда пришли, конверсии в клики на ВК/телефон.
//   2. Локальный счётчик ниже — для собственника: открывается по ссылке
//      ?admin=mebel2026 (можно поменять ADMIN_CODE), пишет события в localStorage
//      этого браузера и показывает сводку: количество просмотров каждого товара,
//      кликов на ВК/Авито/телефон. Полезно для отладки и быстрого взгляда
//      "что делал последний посетитель на этом конкретном устройстве".
// ============================================================
// URL-токен от случайного попадания (а не от взлома — он виден в исходниках страницы,
// просто прячет панель от обычных посетителей). Локальные данные лежат в твоём
// localStorage, ни на каком сервере не хранятся, так что серьёзной защиты тут не нужно.
// Если меняешь — менять в одном месте, обновится для всего сайта.
const ADMIN_CODE = 'mebel2026';
const STATS_KEY = 'favStatsV1';

// Загружаем накопленную статистику из браузера
function statsLoad(){
  try{
    const raw = localStorage.getItem(STATS_KEY);
    if(!raw) return { events: [], counters: {}, started: Date.now() };
    return JSON.parse(raw);
  }catch(_){ return { events: [], counters: {}, started: Date.now() }; }
}
function statsSave(s){
  try{ localStorage.setItem(STATS_KEY, JSON.stringify(s)); }catch(_){}
}
// Главная функция трекинга. Шлёт событие в:
// 1) Яндекс.Метрику (если она инициализирована)
// 2) Локальный счётчик в localStorage
// Отправка целей в Яндекс.Метрику.
// В Метрике должны быть созданы JavaScript-цели с идентификаторами:
// lead_any, open_product, open_category, open_kitchen, open_builder, add_module.
// Дополнительно оставляем внутренние события для локальной админ-статистики.
function getMetrikaGoalAliases(eventName, payload){
  const goals = [];
  const p = payload || {};
  const cat = String(p.c || p.category || p.value || '').toLowerCase();
  const title = String(p.t || p.title || '').toLowerCase();
  const isKitchen = cat.includes('кухн') || title.includes('кухн');
  const isAgava = title.includes('агава') || String(p.series || '').toLowerCase().includes('агава');

  if(eventName === 'view_item'){
    goals.push('open_product');
    if(isKitchen) goals.push('open_kitchen');
    if(isAgava) goals.push('open_agava');
  }
  if(eventName === 'filter_used' && p.type === 'category'){
    goals.push('open_category');
    if(isKitchen) goals.push('open_kitchen');
  }
  if([
    'click_phone', 'click_phone_dial',
    'click_vk_generic', 'click_vk_product', 'click_vk_calc',
    'click_max', 'avito_click'
  ].includes(eventName)){
    goals.push('lead_any');
  }
  return goals;
}

function sendMetrikaGoal(goalName, payload){
  try{
    const id = window.__YM_ID__ || 108770964;
    if(typeof ym === 'function' && id && goalName){
      ym(id, 'reachGoal', goalName, payload || {});
    }
  }catch(_){}
}

window.statsTrack = function(eventName, payload){
  const data = payload || {};
  // 1. Метрика: отправляем само событие и нужные рекламные алиасы.
  try{
    const goals = [eventName].concat(getMetrikaGoalAliases(eventName, data));
    const sent = {};
    goals.forEach(g => {
      if(!g || sent[g]) return;
      sent[g] = true;
      sendMetrikaGoal(g, data);
    });
  }catch(_){}
  // 2. Локальный счётчик
  try{
    const s = statsLoad();
    s.counters[eventName] = (s.counters[eventName]||0) + 1;
    s.events.push({
      name: eventName,
      ts: Date.now(),
      data: data || null
    });
    // Не храним больше 500 последних событий — не раздуваем localStorage
    if(s.events.length > 500) s.events = s.events.slice(-500);
    statsSave(s);
  }catch(_){}
};

// Извлекаем ID Метрики из её инициализации (для использования в reachGoal)
// Когда вы пропишете номер счётчика наверху, он сохранится в window.__YM_ID__
(function detectYmId(){
  // Парсим из script-тега вверху страницы
  try{
    const scripts = document.querySelectorAll('script');
    for(const s of scripts){
      const m = (s.textContent||'').match(/ym\(\s*(\d+)\s*,\s*["']init["']/);
      if(m && m[1] && m[1] !== '0'){
        window.__YM_ID__ = parseInt(m[1], 10);
        break;
      }
    }
  }catch(_){}
})();

// Проверка: режим админа?
function isAdminMode(){
  try{
    const params = new URLSearchParams(window.location.search);
    return params.get('admin') === ADMIN_CODE;
  }catch(_){ return false; }
}

// Рисует админ-панель: модальное окно справа со статистикой
function renderAdminPanel(){
  if(document.getElementById('adminPanel')) return;
  const s = statsLoad();
  const counters = s.counters || {};
  const events = s.events || [];

  // Считаем топ-просматриваемые товары
  const itemViews = {};
  for(const ev of events){
    if(ev.name === 'view_item' && ev.data && ev.data.id){
      const key = ev.data.id;
      if(!itemViews[key]) itemViews[key] = { count: 0, title: ev.data.t || '—' };
      itemViews[key].count++;
    }
  }
  const topItems = Object.entries(itemViews)
    .sort((a,b)=>b[1].count - a[1].count)
    .slice(0, 15);

  const startDate = new Date(s.started || Date.now()).toLocaleDateString('ru-RU');
  const cfg = window.SHOP_CONFIG || {};
  const ymUrl = window.__YM_ID__
    ? 'https://metrika.yandex.ru/dashboard?id=' + window.__YM_ID__
    : 'https://metrika.yandex.ru/list';

  const totalEvents = events.length;
  const tot = (k)=>counters[k]||0;

  const div = document.createElement('div');
  div.id = 'adminPanel';
  div.innerHTML = `
    <div class="admin-bd"></div>
    <div class="admin-box">
      <div class="admin-h">
        <div>
          <div class="admin-t">📊 Статистика админа</div>
          <div class="admin-sub">Этот браузер · с ${esc(startDate)} · событий: ${totalEvents}</div>
        </div>
        <button class="admin-close" id="adminClose" aria-label="Закрыть">✕</button>
      </div>
      <div class="admin-body">
        <div class="admin-section">
          <div class="admin-section-h">⚡ Действия посетителей</div>
          <div class="admin-grid">
            <div class="admin-stat"><div class="admin-stat-n">${tot('view_item')}</div><div class="admin-stat-l">Открыто карточек</div></div>
            <div class="admin-stat"><div class="admin-stat-n">${tot('click_vk_product')}</div><div class="admin-stat-l">ВК по товару</div></div>
            <div class="admin-stat"><div class="admin-stat-n">${tot('click_vk_generic')}</div><div class="admin-stat-l">ВК общий</div></div>
            <div class="admin-stat"><div class="admin-stat-n">${tot('click_phone')}</div><div class="admin-stat-l">Звонок</div></div>
            <div class="admin-stat"><div class="admin-stat-n">${tot('avito_click')}</div><div class="admin-stat-l">Авито</div></div>
            <div class="admin-stat"><div class="admin-stat-n">${tot('filter_used')}</div><div class="admin-stat-l">Фильтры</div></div>
          </div>
        </div>
        <div class="admin-section">
          <div class="admin-section-h">🔥 Топ-15 просмотренных товаров</div>
          ${topItems.length ? `
            <table class="admin-table">
              <thead><tr><th>#</th><th>Товар</th><th>Просм.</th></tr></thead>
              <tbody>
                ${topItems.map(([id, v], i)=>`
                  <tr><td>${i+1}</td><td><a href="?item=${esc(id)}" target="_blank">${esc(v.title)}</a></td><td>${v.count}</td></tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<div class="admin-empty">Пока никто не открывал карточки</div>'}
        </div>
        <div class="admin-section">
          <div class="admin-section-h">📦 Файл остатков</div>
          ${(()=>{
            const stockLoaded = window.STOCK && STOCK.loaded;
            const date = stockLoaded ? (STOCK.date || '—') : null;
            const stockSize = stockLoaded ? Object.keys(STOCK.map||{}).length : 0;
            const cat = window.CATALOG || [];
            const withArt = cat.filter(i=>i.art).length;
            const matched = cat.filter(i=>i._inStock).length;
            const partial = cat.filter(i=>i.art && i._stockQty > 0).length;
            return stockLoaded ? `
              <div class="admin-grid">
                <div class="admin-stat"><div class="admin-stat-n">${stockSize}</div><div class="admin-stat-l">Артикулов в файле</div></div>
                <div class="admin-stat"><div class="admin-stat-n">${matched}</div><div class="admin-stat-l">В наличии</div></div>
                <div class="admin-stat"><div class="admin-stat-n">${withArt}</div><div class="admin-stat-l">Товаров с арт.</div></div>
                <div class="admin-stat"><div class="admin-stat-n">${cat.length - withArt}</div><div class="admin-stat-l">Без артикула</div></div>
              </div>
              <p class="admin-note" style="margin-top:11px">
                Дата файла: <b>${esc(date)}</b>. Совпало по артикулу: ${partial} из ${withArt}.
                Товары без артикула в каталоге не могут быть привязаны к остаткам автоматически.
              </p>
            ` : `
              <p class="admin-warn">
                ⚠ Файл остатков НЕ загружен. Проверь что:
                <br>1. Файл лежит как <code>stock-data/stock.xlsx</code> в репозитории
                <br>2. Имя файла именно <code>stock.xlsx</code> (не stock 1.xlsx и т.п.)
                <br>3. После загрузки прошло 1-2 минуты (GitHub Pages обновляет с задержкой)
              </p>
            `;
          })()}
        </div>
        <div class="admin-section">
          <div class="admin-section-h">🌐 Глубокая аналитика — Яндекс.Метрика</div>
          <p class="admin-note">
            Локальный счётчик показывает только то, что делалось в этом браузере.
            Для статистики всех посетителей (откуда пришли, какие города, какие устройства,
            тепловая карта кликов, видеозапись действий) — откройте Метрику:
          </p>
          <a href="${esc(ymUrl)}" target="_blank" rel="noopener" class="admin-btn">
            Открыть Яндекс.Метрику →
          </a>
          ${!window.__YM_ID__ ? `
            <p class="admin-warn">
              ⚠ Метрика ещё не настроена. Зарегистрируйтесь на metrika.yandex.ru,
              получите номер счётчика и впишите его в начало index.html
              (там указано, куда вставлять).
            </p>
          ` : `<p class="admin-ok">✓ Метрика подключена (счётчик ${window.__YM_ID__})</p>`}
        </div>
        <div class="admin-section">
          <div class="admin-section-h">⚙ Управление</div>
          <button class="admin-btn-sec" id="adminExport">💾 Скачать события (JSON)</button>
          <button class="admin-btn-sec admin-btn-danger" id="adminClear">🗑 Очистить локальную статистику</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(div);

  document.getElementById('adminClose').onclick = ()=>{
    div.remove();
  };
  document.getElementById('adminClear').onclick = ()=>{
    if(!confirm('Очистить всю локальную статистику этого браузера?')) return;
    localStorage.removeItem(STATS_KEY);
    div.remove();
    showToast('Статистика очищена');
  };
  document.getElementById('adminExport').onclick = ()=>{
    const blob = new Blob([JSON.stringify(statsLoad(), null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mebel-favorit-stats-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };
}

const PG=36;
const CI={
  'Шкафы и буфеты':'🗄️','Комоды и тумбы':'🗃️','Стеллажи и этажерки':'📚','Полки':'📦','Столы':'🪑',
  'Компьютерные столы':'💻','Гарнитуры и комплекты':'🏠','Тумбы под телевизор':'📺','Спальные гарнитуры':'🛏️',
  'Кровати':'🛏️','Прихожие и обувницы':'🚪','Гардеробные системы и вешалки':'👔','Тумбы':'🗃️',
  'Прикроватные тумбы':'🌙','Зеркала':'🪞','Кухни':'🍳','Кухонные модули':'🔧','Комплектующие':'⚙️',
  'Диваны':'🛋️','Кресла':'💺','Подвесные кресла':'🪑','Матрасы':'🛌','Стулья':'🪑','Подставки':'📦'
};
const S={q:'',cat:'',fac:'',sort:'',pMin:'',pMax:'',wMin:'',wMax:'',hMin:'',hMax:'',dMin:'',dMax:'',op:false,od:false,os:false,oa:false,attrs:{},facetSearch:{}};
let page=1,filtered=[],mPh=[],mPhI=0;

// Глобальный тост
window.showToast = function(text, ms){
  let t = document.getElementById('favToast');
  if(!t){ t=document.createElement('div'); t.id='favToast'; t.className='fav-toast'; document.body.appendChild(t); }
  t.textContent = text||''; t.classList.add('show');
  clearTimeout(window.__favToastTimer__);
  window.__favToastTimer__ = setTimeout(()=>t.classList.remove('show'), ms||4200);
};

// Диалог "Перед отправкой в ВК" — показывает готовое сообщение и большую
// кнопку для перехода в ВК. Сообщение уже скопировано в буфер (или, если
// автокопирование не сработало, можно скопировать руками из textarea).
//
// Зачем такой промежуточный шаг:
//   • На iOS Safari clipboard API часто блокируется при переходе window.open
//   • Многие пользователи не знают, что что-то скопировано — и теряются в чате ВК
//   • На мобильном надо вручную сделать долгое нажатие → "Вставить", это нужно подсказать
//
// Использование: showVkPrepareDialog({ text, vkUrl, copied })
window.showVkPrepareDialog = function(opts){
  opts = opts || {};
  const text = String(opts.text || '');
  const vkUrl = String(opts.vkUrl || '#');
  const copied = !!opts.copied;
  // Удаляем предыдущий, если был
  const old = document.getElementById('vkPrepDlg');
  if(old) old.remove();

  const wrap = document.createElement('div');
  wrap.id = 'vkPrepDlg';
  wrap.innerHTML = `
    <div class="vkp-bd"></div>
    <div class="vkp-box">
      <button class="vkp-close" type="button" aria-label="Закрыть">✕</button>
      <div class="vkp-h"><img src="assets/icons/vk.png" class="bIco" alt=""> Открыть ВК и отправить</div>
      <div class="vkp-status ${copied ? 'ok' : 'warn'}">
        ${copied
          ? '✅ Сообщение уже скопировано — осталось вставить его в ВК'
          : '⚠ Скопируйте текст ниже вручную (выделите его и зажмите → Копировать)'}
      </div>
      <textarea class="vkp-text" readonly>${esc(text)}</textarea>
      <button class="vkp-copy" type="button">📋 Скопировать текст</button>
      <a class="vkp-go" href="${esc(vkUrl)}" target="_blank" rel="noopener">
        Открыть ВК →
      </a>
      <div class="vkp-hint">
        Откроется чат с магазином. Зажмите поле ввода и выберите <b>«Вставить»</b>,
        затем нажмите отправку.
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const close = ()=>{ wrap.remove(); };
  wrap.querySelector('.vkp-close').onclick = close;
  wrap.querySelector('.vkp-bd').onclick = close;

  // Кнопка "Скопировать ещё раз" — на случай если автоматическое копирование не сработало
  const copyBtn = wrap.querySelector('.vkp-copy');
  copyBtn.onclick = function(){
    const ok = copyTextSync(text);
    if(ok){
      copyBtn.textContent = '✅ Скопировано!';
      setTimeout(()=>{ copyBtn.textContent = '📋 Скопировать текст'; }, 2000);
    } else {
      // Выделяем текст в textarea, чтобы пользователь скопировал руками
      const ta = wrap.querySelector('.vkp-text');
      ta.focus(); ta.select();
      showToast('Зажмите выделенный текст и выберите "Копировать"', 5000);
    }
  };

  // Кнопка "Открыть ВК" — закрывает диалог при клике
  wrap.querySelector('.vkp-go').onclick = ()=>{
    // не вызываем preventDefault — пусть переход состоится
    setTimeout(close, 200);
  };

  // Esc закрывает
  const onKey = (e)=>{
    if(e.key === 'Escape'){ close(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);
};

function deb(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function uniq(arr){return[...new Set(arr.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'ru'))}

// V40_62: Прокси-resize через images.weserv.nl УБРАН.
// Раньше эта функция оборачивала ссылку в https://images.weserv.nl/?url=...
// чтобы получить уменьшенную WebP-версию. Но weserv хостится на Cloudflare,
// который в России периодически блокируется — клиенты без VPN видели белые
// карточки. Плюс прокси кэшировал старые версии по неделям, из-за чего
// обновления фото в репозитории не подхватывались.
// Теперь все фото в catalog-favorit1 предварительно сжаты до ~1600px
// (quality 82) и грузятся напрямую с github.io. Это быстрее и надёжнее.
// Функция imgU() сохранена для совместимости с остальным кодом
// (вызывается в 5 местах), просто возвращает оригинальный URL.
function imgU(src, w){
  return src || '';
}
// Возвращает строку атрибутов для тега <img ...>. data-orig больше не нужен
// (нет прокси, с которого мог бы упасть fallback), но оставлен для совместимости
// с глобальным onerror-обработчиком, чтобы случайно ничего не сломать.
function imgAttrs(src, w){
  if(!src) return '';
  return `src="${esc(src)}" data-orig="${esc(src)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"`;
}
// Этап 1 (v41_104): лёгкое WebP-превью 500px для плиток/подсказок.
// Первое фото товара .../items/{id}/01.jpg -> .../items/{id}/thumb.webp (генерируется в репо catalog-favorit1).
// data-orig = полный JPG: если превью нет/не грузится, глобальный onerror подставит оригинал (graceful fallback).
function thumbU(src){
  return /\/items\/.+\/[^/]+\.(?:jpe?g|png|webp)$/i.test(src||'') ? src.replace(/\/[^/]+$/, '/thumb.webp') : (src||'');
}
function imgAttrsThumb(src){
  if(!src) return '';
  return `src="${esc(thumbU(src))}" data-orig="${esc(src)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"`;
}

function digitsOnly(v){return String(v||'').replace(/\D+/g,'')}
function phoneHref(v){
  const d = digitsOnly(v);
  if(!d) return '#';
  if(d.length===11 && d[0]==='8') return 'tel:+7'+d.slice(1);
  if(d.length===11 && d[0]==='7') return 'tel:+'+d;
  return 'tel:+'+d;
}

// =============================================================
// Диалог "Позвонить" — показывает крупный номер в зелёной рамке
// =============================================================
// Поведение по платформам:
// - Мобильный: тап по номеру → инициирует tel:// звонок (через href).
// - Десктоп: tel:// открывает Skype/FaceTime/Settings или ничего не делает,
//   поэтому акцент на копирование номера в буфер обмена.
// В обоих случаях есть кнопка "Скопировать" для удобства.
function openPhoneDlg(){
  const cfg = window.SHOP_CONFIG || {};
  const dlg = document.getElementById('phoneDlg');
  if(!dlg) return;
  // Заполняем основной номер
  const main = document.getElementById('phoneDlgMain');
  if(main && cfg.phone){
    main.textContent = cfg.phone;
    main.href = phoneHref(cfg.phone);
    main.dataset.num = cfg.phone;
  }
  // Подсказка по платформе
  const hint = document.getElementById('phoneDlgHint');
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if(hint){
    hint.textContent = isMobile
      ? 'Нажмите на номер, чтобы позвонить'
      : 'Нажмите на номер — он скопируется в буфер';
  }
  dlg.classList.add('open');
  // Считаем событие открытия диалога — это и есть "click_phone" (контакт начат)
  try{ if(window.statsTrack) statsTrack('click_phone'); }catch(_){}
}
function closePhoneDlg(){
  document.getElementById('phoneDlg').classList.remove('open');
}
function phoneDlgOutClick(e){
  // Клик по фону диалога (не по содержимому) — закрыть
  if(e.target.id === 'phoneDlg') closePhoneDlg();
}
function onPhoneNumClick(e, el){
  // На мобильном href="tel:" работает сам — браузер инициирует звонок.
  // На десктопе tel: открывает Skype/FaceTime/Phone Link, что часто бесполезно.
  // Поэтому на десктопе ОТМЕНЯЕМ переход и просто КОПИРУЕМ номер в буфер,
  // показав на номере "✅ Скопировано!" на пару секунд.
  const cfg = window.SHOP_CONFIG || {};
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  try{ if(window.statsTrack) statsTrack('click_phone_dial'); }catch(_){}

  if(isMobile){
    // На мобильном — пусть браузер откроет звонилку через href=tel:
    // Дополнительно ничего не делаем.
    return;
  }
  // На десктопе — копируем номер в буфер и показываем подтверждение
  e.preventDefault();
  const num = (el && el.dataset.num) || cfg.phone || '';
  if(!num) return;
  const ok = copyTextSync(num);
  if(ok && el){
    const original = el.textContent;
    el.textContent = '✅ Скопировано!';
    setTimeout(()=>{ el.textContent = original; }, 1800);
  } else if(el){
    // Запасной путь — выделяем номер чтобы пользователь скопировал руками
    showToast('Не удалось скопировать. Номер: ' + num, 5000);
  }
}
function makeMaxShareUrl(phone){
  const txt = 'Здравствуйте! Хочу уточнить наличие мебели. Контакт MAX: ' + String(phone||'');
  return 'https://max.ru/:share?text=' + encodeURIComponent(txt);
}
// Копирование в буфер. ПРИНЦИПИАЛЬНО синхронная функция — это важно для iOS Safari
// и многих мобильных браузеров: они разрешают доступ к буферу обмена ТОЛЬКО
// внутри того же тика обработки пользовательского события (клик/тап).
// Любой await/Promise разрывает эту связь, и копирование тихо падает.
//
// Возвращает true/false синхронно.
function copyTextSync(text){
  const value = String(text||'');
  if(!value) return false;

  // Безусловно используем execCommand-путь: он быстрый и всегда синхронный.
  // navigator.clipboard.writeText применяем только как фоновый дубль ниже.
  let ok = false;
  let savedRange = null;
  try{
    // Сохраняем текущее выделение (если что-то выделено) — вернём после
    const sel = window.getSelection();
    if(sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
  }catch(_){}

  try{
    const ta = document.createElement('textarea');
    ta.value = value;
    // Делаем элемент видимым для движка iOS, но невидимым для глаза.
    // Вариант с opacity:0/position:fixed/top:-9999px — самый надёжный кросс-платформенный.
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1em;height:1em;padding:0;border:none;outline:none;boxShadow:none;background:transparent;opacity:0';
    ta.setAttribute('readonly','');
    ta.contentEditable = 'true';
    document.body.appendChild(ta);

    // На iOS обязательно: focus + selection через Range
    if(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream){
      const range = document.createRange();
      range.selectNodeContents(ta);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      ta.setSelectionRange(0, value.length);
    } else {
      ta.focus();
      ta.select();
      try{ ta.setSelectionRange(0, value.length); }catch(_){}
    }

    ok = document.execCommand('copy');
    document.body.removeChild(ta);
  }catch(err){ ok = false; }

  // Восстанавливаем выделение пользователя (если было)
  try{
    if(savedRange){
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
  }catch(_){}

  // Запасной канал — асинхронный navigator.clipboard. Он МОЖЕТ перезаписать буфер
  // после того, как synchronously execCommand уже сделал работу. Это безопасно:
  // если execCommand провалился, а clipboard работает — буфер будет правильным.
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(value).catch(()=>{});
    }
  }catch(_){}

  return ok;
}
// Совместимость: copyText остаётся, но теперь возвращает Promise<bool> для тех мест,
// где он уже используется по-старому. Внутри — вызов синхронной функции.
function copyText(text){
  return Promise.resolve(copyTextSync(text));
}
// Извлекает числовой ID группы ВК из любого формата ссылки.
// Возвращает строку с минусом для групп (-77061353), или пустую строку.
function getVkDialogId(url){
  const raw = String(url||'');
  const patterns = [
    /[?&]sel=(-?\d+)/i,        // vk.com/im?sel=-77061353
    /\/im\/convo\/(-?\d+)/i,   // vk.com/im/convo/-77061353
    /\/write(-?\d+)/i,         // vk.com/write-77061353
    /\/club(\d+)/i,            // vk.com/club77061353  -> 77061353 -> добавим минус
    /\/public(\d+)/i,          // vk.com/public123     -> аналогично
    /\/gim(\d+)/i              // vk.com/gim123        -> аналогично
  ];
  for(const re of patterns){
    const m = raw.match(re);
    if(m && m[1]){
      let id = m[1];
      // Для club/public/gim ID идёт без минуса в URL, но в API групп ID отрицательный
      if(/\/(club|public|gim)\d+/i.test(raw) && !id.startsWith('-')){
        id = '-' + id;
      }
      return id;
    }
  }
  return '';
}
// Универсальная ссылка для написания в группу. Формат vk.com/write-XXXXX
// надёжно открывает диалог и на десктопе, и в мобильном приложении ВК.
function makeVkChatUrl(baseUrl){
  // Сначала проверим явно заданный chatUrl в конфиге
  const cfg = window.SHOP_CONFIG || {};
  if(cfg.vkChatUrl) return cfg.vkChatUrl;
  // Иначе генерим из club-ссылки или из baseUrl
  const src = baseUrl || cfg.vkClubUrl || '';
  if(!src) return '#';
  const id = getVkDialogId(src);
  if(id){
    // Убираем минус из ID, добавляем его в URL: vk.com/write-77061353
    const num = id.replace(/^-/, '');
    return 'https://vk.com/write-' + num;
  }
  return src;
}
function getProductVkMessage(it, avUrl){
  if(typeof hasMattressOptions==='function' && hasMattressOptions(it)){
    try{ const _r=getMattressOptions(it); const _c=getMattressChoice(it,_r); const _v=findMattressVariant(_r,_c.size,_c.ftype); if(_v) return mattressVkMessage(it,_v); }catch(_){}
  }
  const coupeMsg = (typeof getWardrobeCoupeMessageInfo === 'function') ? getWardrobeCoupeMessageInfo(it) : null;
  const waMsg = (typeof getWardrobeAtticMessageInfo === 'function') ? getWardrobeAtticMessageInfo(it) : null;
  const bedMsg = (typeof getBedOptionMessageInfo === 'function') ? getBedOptionMessageInfo(it) : null;
  const seatMsg = (typeof getSeatOptionMessageInfo === 'function') ? getSeatOptionMessageInfo(it) : null;
  const optionMsg = coupeMsg || bedMsg || waMsg || seatMsg;
  const priceStr = optionMsg && optionMsg.price ? rub(optionMsg.price) : (it && it.p ? (it.p.toLocaleString('ru-RU')+' ₽') : 'цену уточнить');
  // V40_133: title с суффиксом опции (например, «+ мягкое сиденье»)
  let title = (it && it.t) ? it.t : 'товар';
  if(seatMsg && seatMsg.titleSuffix) title += seatMsg.titleSuffix;
  const art = (it && it.art) || (it && it.a && (it.a['Артикул'] || it.a['Артикул поставщика'])) || '';

  // Используется ровно одна ссылка — на Авито (если она есть).
  // Только Авито отдаёт ВК-боту полноценное OG-превью с фото товара и названием,
  // поэтому у клиента в чате появится та самая «карточка с фото» под сообщением.
  // Нашу ссылку ?item=... сейчас не вкладываем — она бы дала общий превью магазина.
  const link = avUrl || '';

  const lines = [];
  lines.push('Здравствуйте! Интересует товар:');
  lines.push('• ' + title);
  const productDetailLines = (typeof getProductVkMessageDetailLines === 'function') ? getProductVkMessageDetailLines(it) : [];
  if(productDetailLines && productDetailLines.length) lines.push(...productDetailLines);
  // Артикул выводим только если он реально есть — пустую строку "Арт: —" не пишем
  if(art) lines.push('• Арт: ' + art);
  lines.push('• Цена: ' + priceStr);
  if(optionMsg && optionMsg.lines && optionMsg.lines.length) lines.push(...optionMsg.lines);
  if(link) lines.push('• Ссылка: ' + link);
  lines.push('');
  lines.push('Подскажите как сделать заказ?');
  return lines.join('\n');
}
// Сообщение по умолчанию для общих ВК-кнопок (шапка/hero/футер) — без товара,
// просто короткое приветствие, чтобы менеджер видел откуда пришёл клиент.
function getGenericVkMessage(){
  return 'Здравствуйте! Пишу с сайта Мебель Фаворит. Подскажите по наличию и доставке.';
}

// =============================================================
// Сообщение для ВК из калькулятора (комплект из конструктора).
// =============================================================
// Формат:
//   Здравствуйте! Интересует товар:
//   • Готовая Спальня Сицилия (Велес)
//   • Цена: 76 854 ₽
//   • Ссылка: https://www.avito.ru/items/7739789546
//
//   Подбор из модулей:
//   • Тумба прикроватная Сицилия 500 ×2 — 5 838 ₽
//   • Кровать Сицилия 1600 ×1 — 14 048 ₽
//   ...
//
//   Итого: 6 модулей · Ширина: 160 см · Сумма: 68 548 ₽
//
//   Подскажите как сделать заказ?
function getCalcVkMessage(){
  const items = (typeof BUILDER_CART === 'object' && BUILDER_CART) ? Object.values(BUILDER_CART) : [];

  // Информация про "родительский" товар (диван-конструктор/кухня), из которого открыли калькулятор
  const cur = window.__CUR_ITEM__;
  const lines = [];

  if(cur){
    const priceStr = cur.p ? (cur.p.toLocaleString('ru-RU')+' ₽') : 'цену уточнить';
    const avLink = cur.avito || '';
    lines.push('Здравствуйте! Интересует товар:');
    lines.push('• ' + (cur.t || 'товар'));
    const art = cur.art || (cur.a && (cur.a['Артикул'] || cur.a['Артикул поставщика']));
    if(art) lines.push('• Арт: ' + art);
    lines.push('• Цена: ' + priceStr);
    if(avLink) lines.push('• Ссылка: ' + avLink);
  } else {
    lines.push('Здравствуйте! Интересует комплект:');
  }

  if(items.length){
    // Сортируем как в панели: сначала верхние, потом нижние, потом прочие
    const order = { top:0, bottom:1, 'living-width':1, 'bedroom-width':1, 'hallway-width':1, other:2 };
    const sorted = items.slice().sort((a,b)=>{
      const ga = order[moduleWidthGroup(a.m)] ?? 2;
      const gb = order[moduleWidthGroup(b.m)] ?? 2;
      if(ga !== gb) return ga - gb;
      return String(a.m.title||'').localeCompare(String(b.m.title||''),'ru');
    });

    lines.push('');
    lines.push('Подбор из модулей:');
    for(const {qty, m} of sorted){
      const linkedItem = m && m.id ? findItemById(m.id) : null;
      lines.push(formatModuleMessageLine(qty, m));
      if(linkedItem && shouldShowBedOptions(linkedItem)){
        const optText = getBedOptionShortText(linkedItem);
        if(optText) lines.push('   ' + optText);
      }
    }

    // Подсчёт сводки — берём из существующей calcSummary, если она доступна
    let summary = null;
    try{ if(typeof calcSummary === 'function') summary = calcSummary(); }catch(_){}
    if(summary){
      lines.push('');
      const widthStr = summary.width ? ` · Ширина: ${formatCmNumber(summary.width)} см` : '';
      lines.push(`Итого: ${summary.count} модулей${widthStr} · Сумма: ${summary.sum.toLocaleString('ru-RU')} ₽`);
    }
  }

  lines.push('');
  lines.push('Подскажите как сделать заказ?');
  return lines.join('\n');
}
function bindMaxButton(el){
  if(!el) return;
  const cfg = window.SHOP_CONFIG || {};
  const maxPhone = cfg.maxPhone || '';
  if(!maxPhone){ el.style.display='none'; return; }
  el.style.display='';
  el.addEventListener('click', async function(e){
    e.preventDefault();
    try{ if(window.statsTrack) statsTrack('click_max'); }catch(_){}
    try{ await copyText(maxPhone); showToast('Номер MAX скопирован: ' + maxPhone + '. Вставьте его в приложении MAX.'); }
    catch(_){ showToast('Номер MAX: ' + maxPhone); }
    try{ window.open(makeMaxShareUrl(maxPhone), '_blank', 'noopener'); }catch(_){ }
  });
}

// Логический порядок категорий — выводим в таком порядке, остальные в конец по алфавиту
const LOGICAL_CAT_ORDER = [
  "Диваны","Кресла","Подвесные кресла","Тумбы под телевизор",
  "Кровати","Матрасы","Прикроватные тумбы","Спальные гарнитуры",
  "Шкафы и буфеты","Комоды и тумбы","Тумбы","Прихожие и обувницы",
  "Гардеробные системы и вешалки","Стеллажи и этажерки","Полки",
  "Кухни","Кухонные модули","Комплектующие",
  "Столы","Компьютерные столы","Стулья",
  "Зеркала","Подставки","Гарнитуры и комплекты"
];
const CATEGORY_FILTER_LABELS = {
  'Комоды и тумбы':'Комоды',
  'Тумбы':'Тумбы и Обувницы',
  'Прихожие и обувницы':'Прихожие'
};
function displayCategoryName(cat){
  return CATEGORY_FILTER_LABELS[cat] || cat || '';
}
function formatFacetValue(cat, key, value){
  if(cat === 'Тумбы' && key === 'Подтип тумбы' && String(value).trim() === 'Тумбы') return 'Консоль';
  return value;
}
function orderCategories(cats){
  const present = new Set(cats);
  const ordered = LOGICAL_CAT_ORDER.filter(c=>present.has(c));
  const extras = cats.filter(c=>!LOGICAL_CAT_ORDER.includes(c)).sort((a,b)=>String(a).localeCompare(String(b),'ru'));
  return ordered.concat(extras);
}
// Сортировка внутри категории (Шкафы → Антресоли → Надстройки → Другой)
const INTRA_RULES = {
  "Шкафы и буфеты": { key:"Тип шкафов", order:["Шкаф","Антресоль","надстройка","Надстройка","Другой"] }
};
function intraRank(it){
  if(!S.cat) return 0;
  const rule = INTRA_RULES[S.cat]; if(!rule) return 0;
  const v = String((it.a && it.a[rule.key]) || '').trim();
  if(!v) return 999;
  const ix = rule.order.findIndex(x => x.toLowerCase() === v.toLowerCase());
  return ix>=0 ? ix : 500;
}

function initSelects(){
  const cats=orderCategories(uniq(CATALOG.map(i=>i.c)));
  const cs=document.getElementById('catSel');

  const GROUPS = [
    ['Гостиная', ['Диваны','Кресла','Подвесные кресла','Тумбы под телевизор','Гарнитуры и комплекты']],
    ['Спальня', ['Кровати','Матрасы','Прикроватные тумбы','Спальные гарнитуры']],
    ['Хранение и прихожая', ['Шкафы и буфеты','Комоды и тумбы','Тумбы','Прихожие и обувницы','Гардеробные системы и вешалки','Стеллажи и этажерки','Полки','Зеркала']],
    ['Кухня', ['Кухни','Кухонные модули','Комплектующие']],
    ['Столы и рабочая зона', ['Столы','Компьютерные столы','Стулья']],
    ['Другое', ['Подставки']]
  ];

  const present = new Set(cats);
  const used = new Set();
  GROUPS.forEach(([label, items])=>{
    const available = items.filter(c=>present.has(c));
    if(!available.length) return;
    const grp = document.createElement('optgroup');
    grp.label = label;
    available.forEach(c=>{
      const o=document.createElement('option');
      o.value=c; o.textContent=displayCategoryName(c);
      grp.appendChild(o);
      used.add(c);
    });
    cs.appendChild(grp);
  });

  const extras = cats.filter(c=>!used.has(c));
  if(extras.length){
    const grp = document.createElement('optgroup');
    grp.label = 'Остальное';
    extras.forEach(c=>{
      const o=document.createElement('option');
      o.value=c; o.textContent=displayCategoryName(c);
      grp.appendChild(o);
    });
    cs.appendChild(grp);
  }

  updateFactoryOptions('');
}

function updateFactoryOptions(cat){
  const fs=document.getElementById('facSel');
  if(!fs) return;
  const current = S.fac || '';
  const pool = cat ? CATALOG.filter(i=>i.c===cat) : CATALOG;
  const facs = uniq(pool.map(i=>i.f).filter(Boolean)).sort((a,b)=>String(a).localeCompare(String(b),'ru'));
  fs.innerHTML = '<option value="">Все</option>' + facs.map(f=>`<option value="${esc(f)}">${esc(f)}</option>`).join('');
  if(current && facs.includes(current)){
    fs.value = current;
  }else{
    S.fac = '';
    fs.value = '';
  }
}

function setCat(cat){
  S.cat=cat;
  S.attrs={};
  S.facetSearch={};
  document.getElementById('catSel').value=cat;
  updateFactoryOptions(cat);
  page=1;buildFacets();apply();
  try{ if(window.statsTrack && cat) statsTrack('filter_used', { type:'category', value: cat }); }catch(_){}
}

function initHero(){
  const TILE_CATS = [
    "Диваны",              // большая, первая
    "Кухни",
    "Шкафы и буфеты",
    "Кровати",
    "Комоды и тумбы",
    "Тумбы под телевизор",
  ];
  const box = document.getElementById('heroImgs');
  if(!box) return;

  function pickPhotos(cat, max){
    const items = CATALOG.filter(i => i.c === cat && i.img);
    // перемешиваем
    for(let i=items.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [items[i],items[j]]=[items[j],items[i]]; }
    return items.slice(0, max).map(i=>i.img);
  }

  box.innerHTML = '';
  TILE_CATS.forEach(cat=>{
    const items = CATALOG.filter(i => i.c === cat);
    if(!items.length) return;
    const photos = pickPhotos(cat, 4);
    if(!photos.length) return;

    const tile = document.createElement('div');
    tile.className = 'hi-c';
    tile.onclick = ()=>{ setCat(cat); goCat(); };

    const ph = document.createElement('div'); ph.className='hi-ph';
    photos.forEach((src,i)=>{
      const img = document.createElement('img');
      img.loading='lazy'; img.decoding='async'; img.referrerPolicy='no-referrer';
      img.alt=cat; img.dataset.orig=src; img.src=imgU(src, 400);
      if(i===0) img.classList.add('on');
      ph.appendChild(img);
    });
    tile.appendChild(ph);

    const tag = document.createElement('span'); tag.className='hi-tag';
    tag.textContent = cat;
    tile.appendChild(tag);

    box.appendChild(tile);

    // Ротация фото каждые ~4 секунды со сдвигом, чтобы плашки не моргали синхронно
    if(photos.length>1){
      let idx = 0;
      const imgs = ph.querySelectorAll('img');
      setInterval(()=>{
        const next = (idx+1) % imgs.length;
        imgs[idx].classList.remove('on');
        imgs[next].classList.add('on');
        idx = next;
      }, 3500 + Math.random()*1500);
    }
  });
}


function buildPopularTiles(){
  const grid = document.getElementById('tilesGrid');
  if(!grid || !Array.isArray(window.CATALOG)) return;
  const POP = [
    ["Гарнитуры и комплекты","Гарнитуры и комплекты","Готовые наборы в одном стиле"],
    ["Кухни","Кухни","Готовые решения и модули"],
    ["Прихожие и обувницы","Прихожие","Компактные решения для входной зоны"],
    ["Спальные гарнитуры","Спальные гарнитуры","Полные комплекты для спальни"],
    ["Компьютерные столы","Компьютерные столы","Для дома, офиса и учебы"],
    ["Стеллажи и этажерки","Стеллажи","Открытое хранение и декор"],
    ["Диваны","Диваны","Лучшие варианты для гостиной"],
    ["Столы","Столы","Обеденные, письменные и журнальные"],
    ["Шкафы и буфеты","Шкафы","Купе, распашные, пеналы"],
    ["Кровати","Кровати","Спальни и отдельные модели"],
    ["Комоды и тумбы","Комоды","Практичные решения для хранения"],
    ["Тумбы под телевизор","Тумбы под ТВ","Современные ТВ-зоны"]
  ];
  grid.innerHTML='';
  POP.forEach(([cat, title, desc])=>{
    const items = CATALOG.filter(i=>i.c===cat);
    if(!items.length) return;
    const tile = document.createElement('div');
    tile.className='tilex';
    tile.setAttribute('role','button');
    tile.tabIndex=0;
    tile.setAttribute('aria-label', 'Открыть категорию ' + title);
    tile.addEventListener('click', ()=>{ setCat(cat); goCat(); });
    tile.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); setCat(cat); goCat(); } });

    const photosWrap = document.createElement('div');
    photosWrap.className='tilex-photos';
    const pool = items.filter(i=>i.img).slice();
    for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
    const photos = pool.slice(0,4).map(i=>i.img).filter(Boolean);
    photos.forEach((src,idx)=>{
      const img = document.createElement('img');
      img.dataset.orig = src; img.src = imgU(src, 400); img.alt = title;
      img.loading='lazy'; img.decoding='async'; img.referrerPolicy='no-referrer';
      if(idx===0) img.classList.add('on');
      photosWrap.appendChild(img);
    });
    tile.appendChild(photosWrap);

    const body = document.createElement('div');
    body.className='tilex-body';
    body.innerHTML = `
      <div class="tilex-top">
        <div class="tilex-ico">${esc(CI[cat] || '📦')}</div>
        <div class="tilex-count">${items.length} шт.</div>
      </div>
      <div>
        <div class="tilex-title">${esc(title)}</div>
        <div class="tilex-desc">${esc(desc)}</div>
      </div>`;
    tile.appendChild(body);
    grid.appendChild(tile);

    if(photos.length>1){
      let ix = 0;
      const imgs = photosWrap.querySelectorAll('img');
      setInterval(()=>{
        const next = (ix+1)%imgs.length;
        imgs[ix].classList.remove('on'); imgs[next].classList.add('on'); ix = next;
      }, 3500 + Math.random()*1500);
    }
  });
}

function buildQuickFactories(){
  const wrap = document.getElementById('quickFactoryWrap');
  const caseBox = document.getElementById('quickFactoryCaseChips');
  const softBox = document.getElementById('quickFactorySoftChips');
  const caseGroup = document.getElementById('quickFactoryCaseGroup');
  const softGroup = document.getElementById('quickFactorySoftGroup');
  if(!wrap || !caseBox || !softBox || !Array.isArray(window.CATALOG)) return;

  const softCats = new Set(['Диваны','Кресла','Подвесные кресла']);
  const caseCnt = new Map();
  const softCnt = new Map();

  CATALOG.forEach(it=>{
    if(!it.f) return;
    const target = softCats.has(it.c) ? softCnt : caseCnt;
    target.set(it.f, (target.get(it.f) || 0) + 1);
  });

  const caseTop = [...caseCnt.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
  const softTop = [...softCnt.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);

  if(!caseTop.length && !softTop.length){ wrap.style.display='none'; return; }
  wrap.style.display='';
  caseBox.innerHTML='';
  softBox.innerHTML='';

  const makeBtn = (factory, num, mountPoint) => {
    const btn = document.createElement('button');
    btn.type='button';
    btn.className='quickx-chip';
    btn.textContent = factory + ' · ' + num;
    btn.addEventListener('click', ()=>{
      S.fac = factory;
      const fs = document.getElementById('facSel'); if(fs) fs.value = factory;
      page = 1; apply(); if(window.matchMedia('(max-width:991px)').matches) goCat();
    });
    mountPoint.appendChild(btn);
  };

  caseTop.forEach(([factory, num])=> makeBtn(factory, num, caseBox));
  softTop.forEach(([factory, num])=> makeBtn(factory, num, softBox));

  if(caseGroup) caseGroup.style.display = caseTop.length ? '' : 'none';
  if(softGroup) softGroup.style.display = softTop.length ? '' : 'none';
}

function initScrollTools(){
  const btn = document.getElementById('toTopBtn');
  if(!btn) return;
  const onScroll = ()=>{ if(window.scrollY > 650) btn.classList.add('show'); else btn.classList.remove('show'); };
  window.addEventListener('scroll', onScroll, {passive:true}); onScroll();
  btn.addEventListener('click', ()=>window.scrollTo({top:0, behavior:'smooth'}));
}


function formatCmNumber(value){
  const n = Number(value);
  if(Number.isFinite(n)){
    const rounded = Math.round(n * 10) / 10;
    return String(rounded).replace(/\.0$/, '').replace('.', ',');
  }
  return String(value || '').replace(/\.0$/, '');
}
function dimsLookLikeMm(w, h, d){
  const W = Number(w) || 0;
  const H = Number(h) || 0;
  // В основной базе почти все товары уже в см.
  // Исключение — отдельные позиции, где из прайса пришли миллиметры: 900×400×300 и т.п.
  return W >= 450 || H >= 350;
}
function cmValueFromMaybeMm(it, value){
  if(value === undefined || value === null || String(value).trim() === '') return '';
  const n = Number(value);
  if(!Number.isFinite(n)) return value;
  return dimsLookLikeMm(it && it.w, it && it.h, it && it.d) ? (n / 10) : n;
}
function formatMainDimValue(it, value){
  if(value === undefined || value === null || String(value).trim() === '') return '';
  return formatCmNumber(cmValueFromMaybeMm(it, value)) + ' см';
}
function formatMainDimsShort(it){
  const parts = [];
  if(it && it.w) parts.push(formatCmNumber(cmValueFromMaybeMm(it, it.w)) + 'Ш');
  if(it && it.h) parts.push(formatCmNumber(cmValueFromMaybeMm(it, it.h)) + 'В');
  if(it && it.d) parts.push(formatCmNumber(cmValueFromMaybeMm(it, it.d)) + 'Г');
  return parts.length ? (parts.join('×') + ' см') : '';
}
function formatMainDimsText(it){
  const parts = [];
  if(it && it.w) parts.push('ширина ' + formatMainDimValue(it, it.w));
  if(it && it.h) parts.push('высота ' + formatMainDimValue(it, it.h));
  if(it && it.d) parts.push('глубина ' + formatMainDimValue(it, it.d));
  return parts.join(', ');
}


const USEFUL_ATTRS_BY_CATEGORY = {
  'Диваны':['Название модели','Форма','Угол','Модульный','Раскладной механизм','Тип раскладного механизма','Материал обивки','Спальное место','Ширина спального места','Длина спального места','Особенности'],
  'Кресла':['Тип мебели','Раскладной механизм','Материал обивки','Спальное место','Особенности'],
  'Подвесные кресла':['Материал каркаса','Материал сиденья','Количество мест','Установка'],
  'Кровати':['Название модели','Тип кровати','Каркас','Наличие подъемного механизма','Матрас в комплекте','Ширина спального места','Длина спального места','Что есть у кровати'],
  'Матрасы':['Серия','Размер спального места','Жёсткость','Тип','Для кого','Особенности состава','Доп. особенности'],
  'Спальные гарнитуры':['Состав комплекта','Ширина спального места','Длина спального места','Длина'],
  'Шкафы и буфеты':['Название модели','Наполнение','Зеркало','Исполнение','Тип шкафов','Тип дверей','Количество створок','Форма','Материал'],
  'Комоды и тумбы':['Тип комодов','Материал','Что есть у товара'],
  'Тумбы':['Подтип тумбы','Материал','Что есть у товара'],
  'Тумбы под телевизор':['Подтип тумбы','Тип расположения','Материал'],
  'Прикроватные тумбы':['Подтип тумбы','Материал','Что есть у товара'],
  'Прихожие и обувницы':['Тип прихожих и обувниц','Материал','Что есть у товара'],
  'Гардеробные системы и вешалки':['Тип гардеробов','Тип размещения','Материал'],
  'Стеллажи и этажерки':['Тип стеллажей','Крепление','Материал','Что есть у товара'],
  'Полки':['Тип полки','Тип размещения','Материал','Что есть у товара'],
  'Гарнитуры и комплекты':['Состав комплекта','Подсветка'],
  'Кухни':['Тип кухни','Форма кухни','Материал фасада','Поверхность фасада','Столешница в комплекте','Материал столешницы','Цвет столешницы','Остров в комплекте','Комплектация'],
  'Кухонные модули':['Название модели','Тип шкафов','Тип дверей','Форма','Количество створок','Материал'],
  'Столы':['Тип стола','Форма','Раскладной механизм','Материал столешницы','Материал основания','Длина в разложенном виде','Что есть у товара'],
  'Компьютерные столы':['Тип стола','Форма','Регулировка высоты','Материал столешницы','Материал основания','Что есть у стола'],
  'Стулья':['Тип стула','Материал сиденья','Материал основания','Количество стульев','Складной','Что есть у стула'],
  'Зеркала':['Тип зеркала','Расположение','Подсветка','Форма','Рама/Окантовка'],
  'Комплектующие':['Тип товара','Тип комплектующих'],
  'Подставки':['Подтип подставки и полки']
};
const DETAIL_ATTR_SKIP = new Set([
  'вид товара','подвид товара','тип товара','категория','цена','фабрика','шаблон ссылок github',
  'уникальный идентификатор объявления','номер объявления на авито','ссылки на фото','название мультиобъявления',
  'ширина','высота','глубина','длина','ширина, см','длина, см','высота, см',
  'поместится ли товар в одну коробку?','ширина коробки'
]);
function getCategoryUsefulAttrKeys(cat){
  return USEFUL_ATTRS_BY_CATEGORY[cat] || [];
}
function getUsefulAttrPairs(it, limit){
  const attrs = it && it.a ? it.a : {};
  const out = [];
  const usedLabels = new Set();
  const usedValues = new Set();
  // Эти поля показываем всегда отдельно, даже если значение совпадает с уже добавленным
  // (например, «Цвет» и «Цвет от производителя» оба = «Белый»).
  const EXEMPT_FROM_VALUE_DEDUP = new Set(['цвет от производителя','цвет производителя']);
  function valueKey(v){
    return String(v===undefined||v===null?'':v).replace(/\s+/g,' ').trim().toLowerCase();
  }
  function add(label, value){
    const cleanLabel = String(label||'').trim();
    const cleanValue = String(value===undefined||value===null?'':value).replace(/\s+/g,' ').trim();
    if(!cleanLabel || !cleanValue) return;
    const lv = cleanLabel.toLowerCase();
    const vv = valueKey(cleanValue);
    if(usedLabels.has(lv)) return;
    if(usedValues.has(vv) && !EXEMPT_FROM_VALUE_DEDUP.has(lv)) return;
    usedLabels.add(lv);
    usedValues.add(vv);
    out.push([cleanLabel, cleanValue]);
  }
  if(it && it.w) add('Ширина', formatMainDimValue(it, it.w));
  if(it && it.h) add('Высота', formatMainDimValue(it, it.h));
  if(it && it.d) add('Глубина', formatMainDimValue(it, it.d));
  if(it && it.f) add('Производитель', it.f);
  if(it && it.col) add('Цвет', it.col);
  if(it && it.art) add('Артикул', it.art);

  const preferred = getCategoryUsefulAttrKeys((it && (it.sheet || it.c)) || '');
  preferred.forEach(key=>{
    const val = attrs[key];
    if(val===undefined || val===null || String(val).trim()==='') return;
    if(String(key).toLowerCase()==='основной цвет' && valueKey(val)===valueKey(it && it.col)) return;
    add(key, val);
  });

  Object.entries(attrs).forEach(([key,val])=>{
    if(val===undefined || val===null || String(val).trim()==='') return;
    const lk = String(key).toLowerCase().trim();
    if(DETAIL_ATTR_SKIP.has(lk)) return;
    if(preferred.includes(key)) return;
    if(lk==='основной цвет' && valueKey(val)===valueKey(it && it.col)) return;
    add(key, val);
  });
  return out.slice(0, limit || 14);
}

const FACET_SKIP_KEYS = new Set(['вид товара','контактное лицо','поместится ли товар в одну коробку?','глубина кухни','глубина нижних шкафов','ширина','высота','глубина','название мультиобъявления','шаблон ссылок github']);
const FACET_DYNAMIC_EXCLUDE = new Set(['Гарнитуры и комплекты','Спальные гарнитуры','Прихожие и обувницы']);
const FACET_SEARCHABLE_KEYS = new Set(['цвет от производителя']);

function facetValueParts(raw){
  const val = String(raw===undefined||raw===null?'':raw).trim();
  if(!val) return [];
  return val.includes('|') ? val.split('|').map(x=>x.trim()).filter(Boolean) : [val];
}
function facetNorm(v){
  return String(v===undefined||v===null?'':v).toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
}
function isDynamicFacetCategory(cat){
  return !!cat && !FACET_DYNAMIC_EXCLUDE.has(cat);
}
function bedFilterWidth(it){
  // Для кроватей фильтр по ширине считаем по спальному месту, а не по габариту.
  if(it && it.c==='Кровати' && it.a){
    const sw=Number(it.a['Ширина спального места']);
    if(Number.isFinite(sw) && sw>0) return sw;
  }
  return Number(it && it.w);
}
const FACET_VALUE_ORDER={
  'Серия':['Эксклюзив','Элит','Карбон','Линум','Премиум','Анатомик','Джуниор','Кидс','Платинум','Титан','Тренд','Ультра','Эволюшн'],
  'Для кого':['Взрослым','Детям','Подросткам','Для дачи','Пожилым','Спортсменам','Тяжеловесам'],
  'Жёсткость':['Жёсткий','Мягкий','Средне-жёсткий','Средне-мягкий','Средний']
};
function sortFacetValues(key, values){
  if(key==='Размер спального места') return values.slice().sort(function(a,b){ return (parseFloat(a)||0)-(parseFloat(b)||0); });
  const ord=FACET_VALUE_ORDER[key];
  if(ord) return values.slice().sort(function(a,b){ let ia=ord.indexOf(a), ib=ord.indexOf(b); if(ia<0)ia=999; if(ib<0)ib=999; return (ia-ib)||String(a).localeCompare(String(b),'ru'); });
  return values.slice().sort(function(a,b){ return String(a).localeCompare(String(b),'ru'); });
}
function rangeFieldValues(it, dim){
  if(it && it.c==='Матрасы' && typeof hasMattressOptions==='function' && hasMattressOptions(it)){
    const rec=getMattressOptions(it); const vs=(rec&&rec.variants)||[];
    if(dim==='w') return vs.map(function(v){return Number(v.w);});
    if(dim==='h') return vs.map(function(v){return Number(v.h);});
    if(dim==='d') return vs.map(function(v){return Number(v.l);});
  }
  if(dim==='w') return [bedFilterWidth(it)];
  if(dim==='h') return [Number(it&&it.h)];
  if(dim==='d') return [Number(it&&it.d)];
  return [];
}
function inRange(it, dim, mn, mx){
  if(mn==='' && mx==='') return true;
  const vals=rangeFieldValues(it,dim).filter(function(v){return Number.isFinite(v);});
  if(!vals.length) return false;
  return vals.some(function(v){ return (mn===''||v>= +mn) && (mx===''||v<= +mx); });
}
function matchesCurrentFilters(it, opts){
  opts = opts || {};
  if(S.cat && it.c!==S.cat) return false;
  if(S.q && !favItemMatchesQ(it, S.q)) return false;
  if(S.fac && it.f!==S.fac) return false;
  if(opts.excludeRange!=='price'){
    if(S.pMin!=='' && !(it.p>= +S.pMin)) return false;
    if(S.pMax!=='' && !(it.p<= +S.pMax)) return false;
  }
  if(opts.excludeRange!=='w' && !inRange(it,'w',S.wMin,S.wMax)) return false;
  if(opts.excludeRange!=='h' && !inRange(it,'h',S.hMin,S.hMax)) return false;
  if(opts.excludeRange!=='d' && !inRange(it,'d',S.dMin,S.dMax)) return false;
  if(S.op && !it.img) return false;
  if(S.od && !(it.w||it.h||it.d)) return false;
  if(S.os && !getCatalogAvailability(it).available) return false;
  if(S.oa && !it.avito) return false;
  if(Object.keys(S.attrs).length){
    for(const [k,vals] of Object.entries(S.attrs)){
      if(opts.excludeAttr && opts.excludeAttr===k) continue;
      if(!vals || !vals.length) continue;
      const pts = facetValueParts(it.a && it.a[k]);
      if(!pts.length) return false;
      if(!vals.some(v=>pts.includes(v))) return false;
    }
  }
  return true;
}
function updateRangeHints(){
  const defs = {
    price:['pMin','pMax','От','До'],
    w:['wMin','wMax','От','До'],
    h:['hMin','hMax','От','До'],
    d:['dMin','dMax','От','До']
  };
  Object.entries(defs).forEach(([rangeKey,[minId,maxId,defMin,defMax]])=>{
    const items = CATALOG.filter(it=>matchesCurrentFilters(it,{excludeRange:rangeKey}));
    const field = rangeKey==='price' ? 'p' : rangeKey;
    let vals; if(field==='p'){ vals=items.map(it=>Number(it.p)).filter(v=>Number.isFinite(v)&&v>0); } else { vals=[]; items.forEach(function(it){ rangeFieldValues(it,field).forEach(function(v){ if(Number.isFinite(v)&&v>0) vals.push(v); }); }); }
    const minEl = document.getElementById(minId);
    const maxEl = document.getElementById(maxId);
    if(!minEl || !maxEl) return;
    if(vals.length){
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      minEl.placeholder = `${defMin} ${Math.round(min)}`;
      maxEl.placeholder = `${defMax} ${Math.round(max)}`;
      minEl.min = String(Math.round(min));
      minEl.max = String(Math.round(max));
      maxEl.min = String(Math.round(min));
      maxEl.max = String(Math.round(max));
      minEl.title = `Доступный диапазон: ${Math.round(min)}–${Math.round(max)}`;
      maxEl.title = `Доступный диапазон: ${Math.round(min)}–${Math.round(max)}`;
    }else{
      minEl.placeholder = defMin;
      maxEl.placeholder = defMax;
      minEl.removeAttribute('min');
      minEl.removeAttribute('max');
      maxEl.removeAttribute('min');
      maxEl.removeAttribute('max');
      minEl.removeAttribute('title');
      maxEl.removeAttribute('title');
    }
  });
}

function buildFacets(){
  enrichMattressFacets();
  if(!S.openFacets) S.openFacets=new Set();
  const box=document.getElementById('attrBox');
  box.innerHTML='';
  if(!S.cat){
    box.innerHTML='<div class="fhints">Выберите категорию — появятся дополнительные фильтры по параметрам товара</div>';
    return;
  }

  const catItems=CATALOG.filter(i=>i.c===S.cat);
  const dynamic = isDynamicFacetCategory(S.cat);
  const km=new Map();

  catItems.forEach(it=>{
    if(!it.a) return;
    Object.entries(it.a).forEach(([k,v])=>{
      const keyNorm = String(k).toLowerCase().trim();
      if(!v || FACET_SKIP_KEYS.has(keyNorm)) return;
      if(!km.has(k)) km.set(k,new Set());
      facetValueParts(v).forEach(p=>{ if(p) km.get(k).add(p); });
    });
  });

  const priority = getCategoryUsefulAttrKeys(S.cat);
  const pIndex = new Map(priority.map((key, idx)=>[key, idx]));
  const keys=[...km.keys()].sort((a,b)=>{
    const ai = pIndex.has(a) ? pIndex.get(a) : Number.MAX_SAFE_INTEGER;
    const bi = pIndex.has(b) ? pIndex.get(b) : Number.MAX_SAFE_INTEGER;
    if(ai !== bi) return ai - bi;
    return a.localeCompare(b,'ru');
  });

  const nextAttrs = {};
  let added=0;

  keys.forEach(key=>{
    const allValues = sortFacetValues(key, [...(km.get(key) || new Set())]);
    const selected = Array.isArray(S.attrs[key]) ? S.attrs[key].filter(v=>allValues.includes(v)) : [];
    if(selected.length) nextAttrs[key] = selected.slice();

    if(allValues.length < 2 && !selected.length) return;
    const keyNorm = facetNorm(key);
    const searchable = FACET_SEARCHABLE_KEYS.has(keyNorm);

    if(allValues.length > 100 && !selected.length && !searchable) return;

    const sourceItems = dynamic
      ? CATALOG.filter(it=>matchesCurrentFilters(it,{excludeAttr:key}))
      : catItems;

    const counts = new Map();
    sourceItems.forEach(it=>{
      facetValueParts(it.a && it.a[key]).forEach(val=>{
        counts.set(val, (counts.get(val)||0)+1);
      });
    });

    const enabledCount = allValues.reduce((acc, val)=>{
      const cnt = counts.get(val)||0;
      return acc + ((cnt>0 || selected.includes(val)) ? 1 : 0);
    },0);

    const det=document.createElement('details');
    det.className='facet';
    det.open = (S.openFacets && S.openFacets.has(key)) || selected.length>0;
    det.addEventListener('toggle', function(){ if(!S.openFacets) S.openFacets=new Set(); if(det.open) S.openFacets.add(key); else S.openFacets.delete(key); });

    const sum=document.createElement('summary');
    const hintVal = dynamic ? enabledCount : allValues.length;
    sum.innerHTML=`<span>${esc(key)}</span><span class="fhint">${hintVal}</span>`;
    det.appendChild(sum);

    const body=document.createElement('div');
    body.className='fbody';

    let searchInput = null;
    if(searchable){
      const searchWrap = document.createElement('div');
      searchWrap.className = 'facet-search';
      searchWrap.innerHTML = `<input type="text" placeholder="Найти цвет..." value="${esc(S.facetSearch[key] || '')}">`;
      searchInput = searchWrap.querySelector('input');
      body.appendChild(searchWrap);
    }

    const list = document.createElement('div');
    body.appendChild(list);

    const empty = document.createElement('div');
    empty.className = 'facet-empty';
    empty.textContent = 'Ничего не найдено';
    empty.style.display = 'none';
    body.appendChild(empty);

    allValues.forEach(v=>{
      const cnt = counts.get(v) || 0;
      const checked = selected.includes(v);
      const disabled = dynamic && !checked && cnt===0;
      const id='c'+Math.random().toString(36).slice(2);
      const lb=document.createElement('label');
      lb.className='optl' + (disabled ? ' off' : '');
      lb.setAttribute('for',id);
      lb.dataset.text = facetNorm(formatFacetValue(S.cat, key, v));
      const displayValue = formatFacetValue(S.cat, key, v);
      lb.innerHTML=`<input id="${id}" type="checkbox" data-attr="${esc(key)}" value="${esc(v)}"${checked?' checked':''}${disabled?' disabled':''}><span class="optt">${esc(displayValue)}</span><span class="optc">${cnt}</span>`;
      list.appendChild(lb);
    });

    function applySearchFilter(){
      const query = facetNorm(searchInput ? searchInput.value : '');
      let visible = 0;
      list.querySelectorAll('.optl').forEach(row=>{
        const ok = !query || String(row.dataset.text || '').includes(query);
        row.style.display = ok ? '' : 'none';
        if(ok) visible++;
      });
      empty.style.display = visible ? 'none' : '';
    }

    if(searchInput){
      searchInput.addEventListener('input', e=>{
        S.facetSearch[key] = e.target.value || '';
        applySearchFilter();
      });
      applySearchFilter();
    }

    det.appendChild(body);
    box.appendChild(det);
    added++;
  });

  S.attrs = nextAttrs;

  if(!added){
    box.innerHTML='<div class="fhints">Для этой категории нет дополнительных фильтров</div>';
    return;
  }

  box.querySelectorAll('input[type=checkbox][data-attr]').forEach(ch=>ch.addEventListener('change',()=>{
    const k=ch.getAttribute('data-attr'),v=ch.value;
    if(!S.attrs[k])S.attrs[k]=[];
    if(ch.checked){
      if(!S.attrs[k].includes(v))S.attrs[k].push(v);
    }else{
      S.attrs[k]=S.attrs[k].filter(x=>x!==v);
    }
    if(!S.attrs[k].length)delete S.attrs[k];
    page=1;apply();
  }));
}

function apply(){
  var __sy=(typeof window!=='undefined'&&window.scrollY)||0;
  enrichMattressFacets();
  let items=CATALOG.filter(it=>matchesCurrentFilters(it));
  if(S.sort==='pa')items.sort((a,b)=>(a.p||0)-(b.p||0));
  else if(S.sort==='pd')items.sort((a,b)=>(b.p||0)-(a.p||0));
  else if(S.sort==='az')items.sort((a,b)=>a.t.localeCompare(b.t,'ru'));
  else if(S.q){
    // Поиск активен: как у маркетплейсов, сортируем по релевантности
    const _qt=favTok(S.q), _ql=S.q.toLowerCase().replace(/\u0451/g,'\u0435');
    items.forEach(i=>{ i.__sc=favScoreItem(i,_qt,_ql); });
    items.sort((a,b)=>(b.__sc-a.__sc) || ((Number(a.ord)||0)-(Number(b.ord)||0)));
  }
  else if(S.cat) items.sort((a,b)=>{
    const rankDiff = intraRank(a)-intraRank(b);
    if(rankDiff) return rankDiff;
    return (Number(a.ord)||0) - (Number(b.ord)||0);
  });
  else items.sort((a,b)=>(Number(a.ord)||0)-(Number(b.ord)||0));
  filtered=items;
  updateRangeHints();
  renderGrid();
  buildFacets();
  if(typeof updateMattressSeriesTiles==='function') updateMattressSeriesTiles();
  if(typeof updateSeoForState === 'function') updateSeoForState();
  if(typeof window!=='undefined' && window.matchMedia && !window.matchMedia('(max-width:991px)').matches){
    if(window.__goCatPending__){
      // Мы намеренно листаем к каталогу (поиск/категория/чип) — НЕ возвращаем позицию назад
      if(window.__restoreRAF__){ cancelAnimationFrame(window.__restoreRAF__); window.__restoreRAF__=0; }
    } else {
      if(window.__restoreRAF__) cancelAnimationFrame(window.__restoreRAF__);
      window.__restoreRAF__=requestAnimationFrame(function(){ window.scrollTo(0, __sy); window.__restoreRAF__=0; });
    }
  }
}


// V40_62: Единый режим отображения фото в карточках каталога.
// Раньше тут была гибридная логика: одни категории "Кухни/Диваны/..."
// шли с object-fit:cover (заполнить кадр), другие "Шкафы/Комоды/..."
// — с object-fit:contain (вписать целиком), плюс корректировка по
// соотношению сторон фото. Из-за этого каталог визуально выглядел
// неровно: соседние карточки одного типа товара могли отображаться
// по-разному в зависимости от того, на каком фоне снято фото.
//
// Теперь ВСЕ карточки используют contain — фото вписывается целиком,
// без обрезки. Это даёт единый стиль для всех 1600+ товаров.
// Цена решения: у фото с интерьером появляются тёмные поля сверху/снизу
// (т.к. фото горизонтальное, а карточка квадратная), у вертикальных
// фото прихожих/шкафов — поля по бокам. Это нормально и предсказуемо.
//
// Списки CARD_IMG_COVER_CATS и CARD_IMG_CONTAIN_CATS оставлены ниже
// закомментированными — если когда-нибудь захочется вернуть гибридную
// логику, можно раскомментировать и развернуть код обратно.

// const CARD_IMG_COVER_CATS = new Set(['Кухни','Кухонные модули','Диваны','Тумбы под телевизор','Гарнитуры и комплекты','Спальные гарнитуры','Кровати','Столы','Компьютерные столы','Прихожие и обувницы']);
// const CARD_IMG_CONTAIN_CATS = new Set(['Шкафы и буфеты','Комоды и тумбы','Тумбы','Стеллажи и этажерки','Полки','Зеркала','Прикроватные тумбы','Гардеробные системы и вешалки','Подставки']);

// V40_62: карточки в каталоге переведены в пропорцию 5:4 (вместо
// 4:3 в V40_60). По высоте чуть больше — у вертикальных фото
// обрезка минимальная. Плюс расширили max-width страницы с 1520
// до 1700 пикс — на широких мониторах (1920x1080 и больше) карточки
// физически шире и крупнее. Cover остался — фото заполняют карточку.
//
// Если хочешь вернуться — поменяй aspect-ratio в .pc-img:
//   5/4   - текущая (V40_62)
//   4/3   - чуть ниже  (V40_60)
//   16/9  - заметно ниже (V40_59)
//   1/1   - квадрат (V40_55)
// И max-width:1700px можно вернуть на 1520px если карточки слишком крупные.

function adaptSingleCardImage(img){
  if(!img) return;
  // V40_62: всегда cover для нового 16:9 формата карточки.
  img.classList.remove('fit-cover','fit-contain');
  img.classList.add('fit-cover');
}

function adaptCardImages(scope){
  const root = scope || document;
  root.querySelectorAll('.pc-img img').forEach(img => {
    if(img.complete && img.naturalWidth){
      adaptSingleCardImage(img);
    } else {
      img.addEventListener('load', ()=>adaptSingleCardImage(img), {once:true});
    }
  });
}

function renderGrid(){
  const g=document.getElementById('pgrid'),em=document.getElementById('empty'),lm=document.getElementById('lmW');
  const ri=document.getElementById('rInfo'),rt=document.getElementById('rTitle'),sc=document.getElementById('sbCnt');
  const shown=filtered.slice(0,page*PG);
  ri.textContent='Найдено: '+filtered.length+' товаров';
  sc.textContent=filtered.length+' товаров';
  // Обновляем текст на нижней кнопке "Показать N товаров" в мобильном фильтре
  if(typeof updateApplyBtnText === 'function') updateApplyBtnText();
  // Обновляем бейджи активных фильтров
  if(typeof updateFilterBadges === 'function') updateFilterBadges();
  rt.textContent=displayCategoryName(S.cat)||'Все товары';
  if(!filtered.length){g.innerHTML='';em.style.display='block';lm.style.display='none';return}
  em.style.display='none';lm.style.display=shown.length<filtered.length?'block':'none';
  g.innerHTML=shown.map(it=>{
    const pr=getItemInitialPriceText(it);
    const dims=formatMainDimsShort(it);
    const chips=[];
    const chipSeen=new Set();
    function addCardChip(v){
      const s=String(v||'').trim();
      if(!s) return;
      const key=s.toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ');
      if(chipSeen.has(key)) return;
      chipSeen.add(key);
      if(chips.length<3) chips.push(s);
    }
    if(it.a){['Основной цвет','Цвет','Наполнение','Зеркало','Исполнение','Материал','Тип шкафов','Тип стола','Подвид товара'].forEach(k=>addCardChip(it.a[k]))}
    return`<div class="pcard" onclick="openM('${esc(it.id)}')">
<div class="pc-img">${(()=>{ const stockState=getCatalogAvailability(it); return `${it.img?`<img ${imgAttrsThumb(it.img)} alt="${esc(it.t)}" data-cat="${esc(it.c)}">`:`<div class="pc-ph">${CI[it.c]||'📦'}</div>`}${stockState.available?'<span class="pc-stock">В наличии</span>':''}${it.pn>1?`<span class="pc-phocount">${it.pn} фото</span>`:''}`; })()}</div>
<div class="pc-body">
<div class="pc-cat">${esc(it.c)}</div>
<div class="pc-title">${esc(it.t)}</div>
${dims?`<div class="pc-meta">📐 ${dims}</div>`:''}
${it.f?`<div class="pc-meta">🏭 ${esc(it.f)}</div>`:''}
${chips.length?`<div class="pc-chips">${chips.map(c=>`<span class="pch">${esc(c)}</span>`).join('')}</div>`:''}
</div>
<div class="pc-foot"><div class="pc-price">${pr}</div><button class="btn-ask" onclick="event.stopPropagation();openM('${esc(it.id)}')">Узнать</button></div>
</div>`;
  }).join('');
  adaptCardImages(g);
}
function loadMore(){page++;renderGrid()}

function tog(k){S[k]=!S[k];
  const map={op:'togPh',od:'togDm',os:'togSt',oa:'togAv'};
  const el=document.getElementById(map[k]); if(el) el.classList.toggle('on',S[k]);
  page=1;apply();}

function resetAll(){
  ['q','cat','fac','sort','pMin','pMax','wMin','wMax','hMin','hMax','dMin','dMax'].forEach(k=>S[k]='');
  S.op=false;S.od=false;S.os=false;S.oa=false;S.attrs={};S.facetSearch={};
  ['hQ','sQ','catSel','facSel','sortSel','pMin','pMax','wMin','wMax','hMin','hMax','dMin','dMax'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
  ['togPh','togDm','togSt','togAv'].forEach(id=>{const el=document.getElementById(id); if(el) el.classList.remove('on');});
  document.getElementById('attrBox').innerHTML='<div class="fhints">Выберите категорию — появятся дополнительные фильтры по параметрам товара</div>';
  updateFactoryOptions('');
  page=1;apply();
}

// MODAL
function getModalScrollEl(){
  return document.querySelector('#mOv .mBox');
}

// ========== ШКАФЫ ВЕЛЕС + АНТРЕСОЛИ ==========
let WARDROBE_ATTIC_CHOICE = {};
function rub(n){
  n = Number(n || 0);
  return n ? (n.toLocaleString('ru-RU') + ' ₽') : 'Цена по запросу';
}
function getWardrobeAttic(it){
  if(!it || !window.__WARDROBE_ATTIC__) return null;
  const rec = window.__WARDROBE_ATTIC__[String(it.id || '')];
  return (rec && rec.attic && rec.attic.atticId) ? rec : null;
}
function hasWardrobeAtticOption(it){ return !!getWardrobeAttic(it); }
function getWardrobeAtticChoice(it){
  const rec = getWardrobeAttic(it);
  if(!rec) return 'base';
  return WARDROBE_ATTIC_CHOICE[String(it.id)] || 'base';
}
function setWardrobeAtticChoice(id, choice){
  WARDROBE_ATTIC_CHOICE[String(id || '')] = (choice === 'attic') ? 'attic' : 'base';
  const it = findItemById(id);
  if(it) updateWardrobeAtticSelection(it);
}
function getWardrobeStockQtyFromArt(art, fallbackItem){
  if(!STOCK.loaded) return {qty:0, missing:true};
  const key = (typeof normArt === 'function') ? normArt(art) : String(art || '').replace(/[\s\u00A0]+/g,'').trim();
  if(key && STOCK.map && Object.prototype.hasOwnProperty.call(STOCK.map, key)){
    return {qty:Math.max(0, Number(STOCK.map[key]) || 0), missing:false};
  }
  if(fallbackItem && String(fallbackItem.art || '').trim()){
    const fkey = (typeof normArt === 'function') ? normArt(fallbackItem.art) : String(fallbackItem.art || '').replace(/[\s\u00A0]+/g,'').trim();
    if(fkey && STOCK.map && Object.prototype.hasOwnProperty.call(STOCK.map, fkey)){
      return {qty:Math.max(0, Number(STOCK.map[fkey]) || 0), missing:false};
    }
  }
  return {qty:0, missing:true};
}
function getWardrobeBaseAvailability(it, rec){
  if(!STOCK.loaded){
    return {loaded:false, available:false, qty:null, className:'nodata', label:'Остатки не загружены', badgeLabel:'', fromWardrobeAttic:true};
  }
  const q = getWardrobeStockQtyFromArt(rec && rec.cabinetArt, it);
  const qty = Math.max(0, Number(q.qty) || 0);
  const available = qty > 0 && !q.missing;
  return {
    loaded:true,
    available,
    qty,
    className: available ? 'instock' : 'preorder',
    label: available ? ('✓ В наличии — ' + qty + ' шт.') : 'Под заказ',
    badgeLabel: available ? 'В наличии' : '',
    fromWardrobeAttic:true
  };
}
function getWardrobeAtticAvailability(it, rec, choice){
  const atticItem = rec && rec.attic ? findItemById(rec.attic.atticId) : null;
  if(choice !== 'attic') return getWardrobeBaseAvailability(it, rec);
  if(!rec || !rec.attic){
    return {loaded:true, available:false, qty:0, className:'preorder', label:'Под заказ', badgeLabel:'', fromWardrobeAttic:true};
  }
  if(!STOCK.loaded){
    return {loaded:false, available:false, qty:null, className:'nodata', label:'Остатки не загружены', badgeLabel:'', fromWardrobeAttic:true};
  }
  const needAttic = Math.max(1, Number(rec.attic.atticQty) || 1);
  const cab = getWardrobeStockQtyFromArt(rec.cabinetArt, it);
  const attic = getWardrobeStockQtyFromArt(rec.attic.atticArt, atticItem);
  const cabQty = cab.missing ? 0 : Math.max(0, Number(cab.qty) || 0);
  const atticQty = attic.missing ? 0 : Math.max(0, Number(attic.qty) || 0);
  const kits = Math.min(cabQty, Math.floor(atticQty / needAttic));
  const available = kits > 0;
  return {
    loaded:true,
    available,
    qty:kits,
    className: available ? 'instock' : 'preorder',
    label: available ? ('✓ В наличии — ' + kits + ' компл.') : 'Под заказ',
    badgeLabel: available ? 'В наличии' : '',
    fromWardrobeAttic:true,
    cabinetQty:cabQty,
    atticQty:atticQty,
    atticNeed:needAttic
  };
}
function wardrobeAtticStockHtml(state){
  if(!state) return '<span class="waOpt-choice-stock none">Нет данных</span>';
  const cls = state.loaded ? (state.available ? 'ok' : 'none') : '';
  return `<span class="waOpt-choice-stock ${cls}">${esc(state.loaded ? state.label : 'Остатки не загружены')}</span>`;
}
function wardrobeAtticPopupTotalStockHtml(state){
  if(!state) return '';
  const cls = state.loaded ? (state.available ? 'ok' : 'none') : '';
  return `<span class="wardrobeOpt-pop-total-stock ${cls}">${esc(state.loaded ? state.label : 'Остатки не загружены')}</span>`;
}
function updateWardrobeAtticPopupStock(it, rec){
  const host = document.getElementById('wardrobePopupHost');
  if(!host || !host.innerHTML || !rec) return;
  const baseState = getWardrobeAtticAvailability(it, rec, 'base');
  const atticState = getWardrobeAtticAvailability(it, rec, 'attic');
  const baseEl = host.querySelector('[data-wa-stock="base"]');
  const atticEl = host.querySelector('[data-wa-stock="attic"]');
  if(baseEl) baseEl.outerHTML = wardrobeAtticStockHtml(baseState).replace('waOpt-choice-stock', 'waOpt-choice-stock').replace('<span ', '<span data-wa-stock="base" ');
  if(atticEl) atticEl.outerHTML = wardrobeAtticStockHtml(atticState).replace('waOpt-choice-stock', 'waOpt-choice-stock').replace('<span ', '<span data-wa-stock="attic" ');
}
function updateWardrobeAtticStockBadge(state){
  const stockEl = document.getElementById('mStock');
  if(!stockEl || !state) return;
  if(state.loaded){
    stockEl.className = state.className === 'instock' ? 'm-stock ok' : 'm-stock none';
    stockEl.textContent = state.label;
    stockEl.style.display = 'inline-flex';
  }else{
    stockEl.style.display = 'none';
  }
}
function getWardrobeAtticMessageInfo(it){
  const rec = getWardrobeAttic(it);
  if(!rec || getWardrobeAtticChoice(it) !== 'attic') return null;
  const attic = rec.attic || {};
  return {
    price: Number(attic.price || rec.base.price || it.p || 0),
    lines: [
      '• Комплектация: шкаф + антресоль',
      attic.heightLabel || ''
    ].filter(Boolean)
  };
}
function closeWardrobeOptionWindow(){
  const host = document.getElementById('wardrobePopupHost');
  if(host) host.innerHTML = '';
}
function openWardrobeOptionWindow(it){
  const rec = getWardrobeAttic(it);
  const host = document.getElementById('wardrobePopupHost');
  if(!rec || !host) return;
  const basePrice = Number((rec.base && rec.base.price) || it.p || 0);
  const atticTotal = Number((rec.attic && rec.attic.price) || 0);
  const atticExtra = Number((rec.attic && (rec.attic.totalAtticPrice || rec.attic.atticPrice)) || Math.max(0, atticTotal - basePrice));
  const qty = Math.max(1, Number(rec.attic && rec.attic.atticQty) || 1);
  const atticWidth = rec.attic && rec.attic.atticWidth ? formatMaybeMmWidthCm(rec.attic.atticWidth) : '';
  const atticItem = rec && rec.attic ? findItemById(rec.attic.atticId) : null;
  const baseImg = (it && it.img) ? it.img : '';
  const atticImg = (atticItem && atticItem.img) ? atticItem.img : baseImg;
  const baseState = getWardrobeAtticAvailability(it, rec, 'base');
  const atticState = getWardrobeAtticAvailability(it, rec, 'attic');
  host.innerHTML = `
    <div class="wardrobeOpt-pop-backdrop" onclick="closeWardrobeOptionWindow()"></div>
    <div class="wardrobeOpt-pop">
      <div class="wardrobeOpt-pop-h">
        <div>
          <div class="wardrobeOpt-pop-title">Опции шкафа</div>
          <div class="wardrobeOpt-pop-hint">Выберите: только шкаф или шкаф с антресолью. Итоговая цена справа пересчитается сразу.</div>
        </div>
        <button type="button" class="wardrobeOpt-close" onclick="closeWardrobeOptionWindow()" aria-label="Закрыть">×</button>
      </div>
      <div class="waOpt-choices" style="margin-top:12px">
        <label class="waOpt-choice" data-choice="base">
          <input type="radio" name="waOptPopup" value="base" onchange="setWardrobeAtticChoice('${esc(it.id)}','base')">
          <span>
            <div class="waOpt-choice-visual">${baseImg ? `<img src="${esc(baseImg)}" alt="Только шкаф" loading="lazy">` : ''}</div>
            <div class="waOpt-choice-copy">
              <div class="waOpt-choice-name">Только шкаф</div>
              <div class="waOpt-choice-price">+0 ₽</div>
              ${wardrobeAtticStockHtml(baseState).replace('<span ', '<span data-wa-stock="base" ')}
            </div>
          </span>
        </label>
        <label class="waOpt-choice" data-choice="attic">
          <input type="radio" name="waOptPopup" value="attic" onchange="setWardrobeAtticChoice('${esc(it.id)}','attic')">
          <span>
            <div class="waOpt-choice-visual">${atticImg ? `<img src="${esc(atticImg)}" alt="Шкаф + антресоль" loading="lazy">` : ''}</div>
            <div class="waOpt-choice-copy">
              <div class="waOpt-choice-name">Шкаф + антресоль</div>
              <div class="waOpt-choice-price">+${rub(atticExtra)}</div>
              <div class="waOpt-choice-meta">${qty} шт. × ${esc(atticWidth)}</div>
              ${wardrobeAtticStockHtml(atticState).replace('<span ', '<span data-wa-stock="attic" ')}
            </div>
          </span>
        </label>
      </div>
      <div class="wardrobeOpt-pop-note" id="wardrobeOptPopupNote" style="display:none"></div>
      <div class="wardrobeOpt-pop-actions"><div class="wardrobeOpt-pop-total" id="wardrobeOptPopupTotal">Итог: —</div><button type="button" class="wardrobeOpt-done" onclick="closeWardrobeOptionWindow()">Готово</button></div>
    </div>`;
  updateWardrobeAtticSelection(it);
}
function mountWardrobeOptionToolsHost(){
  const tools = document.getElementById('mWardrobeOptionTools');
  if(!tools) return;
  const inlineHost = document.querySelector('#mMultiSizes .mMulti-controls');
  if(inlineHost){
    inlineHost.appendChild(tools);
    tools.classList.add('wardrobeOptTools-inline');
  }else{
    const fallbackHost = document.querySelector('.mGal');
    if(fallbackHost && tools.parentNode !== fallbackHost) fallbackHost.appendChild(tools);
    tools.classList.remove('wardrobeOptTools-inline');
  }
}
function updateWardrobeAtticSelection(it){
  const rec = getWardrobeAttic(it);
  const box = document.getElementById('mWardrobeAttic');
  if(!box || !rec) return;
  const choice = getWardrobeAtticChoice(it);
  const selected = choice === 'attic' ? rec.attic : rec.base;
  const price = Number((selected && selected.price) || it.p || 0);
  const priceEl = document.getElementById('mPri');
  if(priceEl) priceEl.textContent = rub(price);
  const state = getWardrobeAtticAvailability(it, rec, choice);
  updateWardrobeAtticStockBadge(state);
  const detail = box.querySelector('#waOptDetail');
  if(detail){
    if(choice === 'attic'){
      const a = rec.attic || {};
      const qty = Math.max(1, Number(a.atticQty) || 1);
      detail.innerHTML = `
        <div><b>Итог:</b> ${esc(rec.title || it.t || 'Шкаф')}</div>
        <div class="waOpt-list">
          <div>Комплектация: шкаф + антресоль</div>
          <div style="margin-top:6px;color:var(--muted)">В комплекте:</div>
          <div>${esc(rec.title || it.t || 'Шкаф')} — 1 шт.</div>
          <div>${esc(a.atticTitle || 'Антресоль')} — ${qty} шт.</div>
          ${a.heightLabel ? `<div style="margin-top:6px;color:var(--muted)">${esc(a.heightLabel)}</div>` : ''}
          <div style="margin-top:6px"><b>Наличие комплекта:</b> ${esc(state.loaded ? state.label : 'Остатки не загружены')}</div>
        </div>
        <div class="waOpt-foot">
          ${a.atticId ? `<button type="button" class="waOpt-link" onclick="navOpen('${esc(a.atticId)}')">Посмотреть антресоль</button>` : ''}
          <span class="waOpt-stock ${state.available ? 'ok' : 'none'}">${esc(state.loaded ? state.label : 'Остатки не загружены')}</span>
        </div>`;
    }else{
      detail.innerHTML = `
        <div><b>Итог:</b> ${esc(rec.title || it.t || 'Шкаф')}</div>
        <div class="waOpt-list">
          <div>Комплектация: только шкаф</div>
          ${rec.base && rec.base.heightLabel ? `<div style="margin-top:6px;color:var(--muted)">${esc(rec.base.heightLabel)}</div>` : ''}
        </div>
        <div class="waOpt-foot"><span class="waOpt-stock ${state.available ? 'ok' : 'none'}">${esc(state.loaded ? state.label : 'Остатки не загружены')}</span></div>`;
    }
  }
  const tools = document.getElementById('mWardrobeOptionTools');
  if(tools){
    const label = choice === 'attic' ? 'Выбрано: шкаф + антресоль' : 'Выбрано: только шкаф';
    tools.innerHTML = `<div class="wardrobeOptTools-in"><button type="button" class="wardrobeOpt-open" onclick="event.stopPropagation(); openWardrobeOptionWindow(findItemById('${esc(it.id)}')); return false;">⚙️ Выбрать опции</button><div class="wardrobeOptCurrent">${esc(label)}</div></div>`;
    tools.style.display = 'flex';
    mountWardrobeOptionToolsHost();
  }
  const host = document.getElementById('wardrobePopupHost');
  if(host && host.innerHTML){
    host.querySelectorAll('.waOpt-choice').forEach(el=>el.classList.toggle('on', el.dataset.choice === choice));
    host.querySelectorAll('input[name="waOptPopup"]').forEach(inp=>{ inp.checked = inp.value === choice; });
    const note = host.querySelector('#wardrobeOptPopupNote');
    if(note){
      const txt = (choice === 'attic' && rec.attic && rec.attic.heightLabel) ? rec.attic.heightLabel : '';
      note.textContent = txt;
      note.style.display = txt ? 'block' : 'none';
    }
    updateWardrobeAtticPopupStock(it, rec);
    const total = host.querySelector('#wardrobeOptPopupTotal');
    if(total) total.innerHTML = `Итог: <b>${rub(price)}</b>${wardrobeAtticPopupTotalStockHtml(state)}`;
  }
}
function renderWardrobeAttic(it){
  const box = document.getElementById('mWardrobeAttic');
  const tools = document.getElementById('mWardrobeOptionTools');
  if(!box) return;
  const rec = getWardrobeAttic(it);
  if(!rec){ box.style.display='none'; box.innerHTML=''; if(tools){tools.style.display='none'; tools.innerHTML='';} closeWardrobeOptionWindow(); return; }
  box.style.display='flex';
  box.innerHTML = `
    <div class="waOpt-h">
      <div class="waOpt-title">Итог комплектации</div>
      <div class="waOpt-hint">Цена зависит от выбранной комплектации.</div>
    </div>
    <div class="waOpt-detail" id="waOptDetail"></div>`;
  updateWardrobeAtticSelection(it);
}

// ========== КРОВАТИ ВЕЛЕС// ========== КРОВАТИ ВЕЛЕС: КОМПЛЕКТАЦИИ ОСНОВАНИЯ ==========
let BED_OPTION_CHOICE = {};

// ========== ТУМБЫ МИКОН: ДОП. ОПЦИЯ «МЯГКОЕ СИДЕНЬЕ» ==========
// Артём (V40_123): для тумб прихожих Микон (Арбе/Кевин/Мэнкс) мягкое сиденье вынесено
// в отдельную опцию. По умолчанию — без сиденья; пользователь жмёт «Опции» → «с сиденьем».
// SEAT_OPTION_CHOICE[tumbaId] = true|false  (true = добавить сиденье к цене)
let SEAT_OPTION_CHOICE = {};
// V41_33: выбор цвета варианта доп-опции (напр. куб для Тумбы ТВ Мэнкс — 1 из 3 цветов)
let SEAT_OPTION_VARIANT = {};
function getSeatVariants(opt){ return (opt && Array.isArray(opt.seatVariants) && opt.seatVariants.length) ? opt.seatVariants : null; }
function getSeatVariantIndex(tumbaId){ return Number(SEAT_OPTION_VARIANT[String(tumbaId||'')]||0); }
function getSeatVariantColor(opt, tumbaId){
  const vs=getSeatVariants(opt);
  if(!vs) return (opt && opt.seatColor) || '';
  const i=getSeatVariantIndex(tumbaId);
  return (vs[i] && vs[i].color) || (vs[0] && vs[0].color) || '';
}
function setSeatVariant(tumbaId, idx){
  SEAT_OPTION_VARIANT[String(tumbaId||'')] = Number(idx)||0;
  setSeatOptionChoice(tumbaId, true); // выбор цвета = включить опцию
}
function getSeatOption(tumbaId){
  if(!tumbaId || !window.__SEAT_OPTIONS__) return null;
  return window.__SEAT_OPTIONS__[String(tumbaId)] || null;
}
function shouldShowSeatOption(it){
  return !!(it && getSeatOption(it.id));
}
function isSeatOptionOn(tumbaId){
  return !!SEAT_OPTION_CHOICE[String(tumbaId || '')];
}
// V40_133: формирование сообщения ВК если выбрана опция «с мягким сиденьем»
// Возвращает суффикс к названию и итоговую цену — встраивается прямо в строку товара.
function getSeatOptionMessageInfo(it){
  if(!it || !shouldShowSeatOption(it)) return null;
  if(!isSeatOptionOn(it.id)) return null;
  const opt = getSeatOption(it.id);
  if(!opt) return null;
  const tumbaPrice = Number(it.p || 0);
  const seatPrice = Number(opt.seatPrice || 0);
  const vColor = getSeatVariantColor(opt, it.id);
  const colorTag = (getSeatVariants(opt) && vColor) ? (' (' + vColor + ')') : '';
  return {
    titleSuffix: (opt.optSuffix||' + мягкое сиденье') + colorTag,
    inlineSuffix: (opt.optInline||' (С мягким сиденьем)'),
    price: tumbaPrice + seatPrice,
    lines: [] // пусто — не добавляем отдельных строк, всё в названии
  };
}
function getSeatOptionExtraPrice(tumbaId){
  if(!isSeatOptionOn(tumbaId)) return 0;
  const opt = getSeatOption(tumbaId);
  return opt ? Number(opt.seatPrice || 0) : 0;
}

// V40_128: расчёт наличия комплекта тумба+сиденье.
// Сиденье ищется в STOCK.map по артикулу из seatArt (как для обычных товаров).
// Комплект «в наличии» если И тумба И сиденье есть на складе.
function getSeatStockQty(opt){
  if(!opt || !opt.seatArt) return 0;
  if(typeof STOCK === 'undefined' || !STOCK || !STOCK.loaded || !STOCK.map) return 0;
  let qty = 0;
  const arts = (typeof artVariants === 'function') ? artVariants(opt.seatArt) : [opt.seatArt];
  for(const a of arts){
    if(Object.prototype.hasOwnProperty.call(STOCK.map, a)){
      qty += Number(STOCK.map[a]) || 0;
    }
  }
  return Math.max(0, qty);
}
function getSeatOptionAvailability(it, opt, withSeat){
  if(!it){
    return {loaded:false, available:false, qty:null, className:'nodata', label:'Остатки не загружены'};
  }
  if(typeof STOCK === 'undefined' || !STOCK || !STOCK.loaded){
    return {loaded:false, available:false, qty:null, className:'nodata', label:'Остатки не загружены'};
  }
  const tumbaQty = Math.max(0, Number(it._stockQty) || 0);
  const tumbaOk = !!it._inStock;
  if(!withSeat){
    // Без сиденья — статус самой тумбы
    return {
      loaded:true,
      available: tumbaOk,
      qty: tumbaQty,
      className: tumbaOk ? 'instock' : 'preorder',
      label: tumbaOk ? ('✓ В наличии' + (tumbaQty ? (' — ' + tumbaQty + ' шт.') : '')) : 'Под заказ'
    };
  }
  // С сиденьем — учитываем оба
  const seatQty = getSeatStockQty(opt);
  const seatOk = seatQty > 0;
  const both = tumbaOk && seatOk;
  const minQty = Math.min(tumbaQty, seatQty);
  return {
    loaded:true,
    available: both,
    qty: minQty,
    className: both ? 'instock' : 'preorder',
    label: both 
      ? ('✓ Комплект с сиденьем в наличии' + (minQty ? (' — ' + minQty + ' шт.') : ''))
      : (!tumbaOk && !seatOk ? 'Комплект под заказ' 
         : (!tumbaOk ? 'Тумба под заказ' : 'Сиденье под заказ'))
  };
}
function seatOptionAvailabilityHtml(state){
  if(!state) return '';
  if(!state.loaded) return `<span class="wardrobeOpt-pop-total-stock">${esc(state.label || 'Остатки не загружены')}</span>`;
  const cls = state.available ? 'ok' : 'none';
  return `<span class="wardrobeOpt-pop-total-stock ${cls}">${esc(state.label)}</span>`;
}

function getSeatOptionShortBadge(it){
  if(!shouldShowSeatOption(it)) return '';
  const tumbaId = String(it.id || '');
  const opt = getSeatOption(tumbaId);
  if(!opt) return '';
  if(isSeatOptionOn(tumbaId)){
    return `<span class="kitCard-seatbadge on">+ ${esc(opt.optBadge||'Сиденье')} · ${Number(opt.seatPrice).toLocaleString('ru-RU')} ₽</span>`;
  }
  return `<span class="kitCard-seatbadge off">${esc(opt.optBadge||'Сиденье')} — опция</span>`;
}

function setSeatOptionChoice(tumbaId, on){
  SEAT_OPTION_CHOICE[String(tumbaId || '')] = !!on;
  // V40_127: НЕ закрываем попап — обновляем его внутри и пересчитываем состав
  updateSeatOptionPopup(String(tumbaId || ''));
  // Перерисуем состав комплекта (бейджи, сумма)
  const cur = window.__CUR_ITEM__;
  if(cur) renderKitComposition(cur);
  // Обновим обычную карточку тумбы (если открыта)
  refreshTumbaSeatOptionUI(tumbaId);
  // V41_34: оперативно пересчитываем сетку модулей и корзину «Выбрано»
  try{ if(typeof renderBuilderGrid === 'function') renderBuilderGrid(); }catch(_){}
  try{ if(typeof renderCalcPanel === 'function') renderCalcPanel(); }catch(_){}
}
function updateSeatOptionPopup(tumbaId){
  const overlay = document.getElementById('seatOptionPopup');
  if(!overlay) return;
  const currentlyOn = isSeatOptionOn(tumbaId);
  const opt = getSeatOption(tumbaId);
  if(!opt) return;
  // Подсветка активной карточки выбора
  overlay.querySelectorAll('.waOpt-choice').forEach(el=>{
    const c = el.getAttribute('data-seat-choice');
    el.classList.toggle('on', (c === 'on' && currentlyOn) || (c === 'off' && !currentlyOn));
  });
  // Радио
  overlay.querySelectorAll(`input[name="seatOpt_${tumbaId}"]`).forEach(inp=>{
    inp.checked = (inp.value === 'on' && currentlyOn) || (inp.value === 'off' && !currentlyOn);
  });
  // Бейджи наличия в обеих карточках (могут различаться когда сиденья нет в STOCK)
  const tumbaItem = (typeof findItemById === 'function') ? findItemById(tumbaId) : null;
  const stockNo = getSeatOptionAvailability(tumbaItem, opt, false);
  const stockYes = getSeatOptionAvailability(tumbaItem, opt, true);
  const noStockEl = overlay.querySelector('[data-seat-stock="off"]');
  const yesStockEl = overlay.querySelector('[data-seat-stock="on"]');
  if(noStockEl){
    noStockEl.className = 'waOpt-choice-stock ' + (stockNo.available ? 'ok' : (stockNo.loaded ? 'none' : ''));
    noStockEl.textContent = stockNo.label;
  }
  if(yesStockEl){
    yesStockEl.className = 'waOpt-choice-stock ' + (stockYes.available ? 'ok' : (stockYes.loaded ? 'none' : ''));
    yesStockEl.textContent = stockYes.label;
  }
  // Итог + бейдж наличия в футере
  const tumbaPrice = tumbaItem ? Number(tumbaItem.p || 0) : 0;
  const seatPrice = Number(opt.seatPrice || 0);
  const totalPrice = tumbaPrice + (currentlyOn ? seatPrice : 0);
  const totalEl = overlay.querySelector('#seatOptPopupTotal');
  if(totalEl){
    const stockHtml = seatOptionAvailabilityHtml(currentlyOn ? stockYes : stockNo);
    totalEl.innerHTML = `Итог: <b>${rub(totalPrice)}</b>${stockHtml}`;
  }
  // Подсветка выбранного цвета варианта (куб и т.п.)
  const ci = getSeatVariantIndex(tumbaId);
  overlay.querySelectorAll('[data-seat-variant]').forEach(btn=>{
    const onv = (Number(btn.getAttribute('data-seat-variant')) === ci);
    btn.style.background = onv ? 'var(--accent,#0a7d55)' : '#fff';
    btn.style.color = onv ? '#fff' : 'var(--ink,#222)';
  });
}

// V40_128: Доп.опция сиденья в ОБЫЧНОЙ карточке тумбы — в стиле renderWardrobeAttic.
// V40_131: кнопка встроена прямо в HTML блока итога, не теряется при innerHTML-перерисовке.
function renderTumbaSeatOption(it){
  const box = document.getElementById('mTumbaSeatOption');
  const tools = document.getElementById('mTumbaSeatOptionTools');
  if(!box) return;
  if(!shouldShowSeatOption(it)){
    box.style.display='none';
    box.innerHTML='';
    if(tools){ tools.style.display='none'; tools.innerHTML=''; }
    return;
  }
  // Базовая разметка с встроенной кнопкой (один раз)
  box.style.display = 'flex';
  box.innerHTML = `
    <div class="waOpt-h">
      <div class="waOpt-title">Итог комплектации</div>
      <div class="waOpt-hint">Цена зависит от выбранной комплектации.</div>
    </div>
    <div class="waOpt-detail" id="seatOptDetail"></div>
    <div class="waOpt-actions" id="seatOptActionsHost"></div>`;
  updateTumbaSeatOptionSelection(it);
}
function updateTumbaSeatOptionSelection(it){
  const opt = getSeatOption(it.id);
  if(!opt) return;
  const on = isSeatOptionOn(it.id);
  const tumbaPrice = Number(it.p || 0);
  const seatPrice = Number(opt.seatPrice || 0);
  const totalPrice = tumbaPrice + (on ? seatPrice : 0);

  // Обновляем цену сверху модалки (как у Альте)
  const priceEl = document.getElementById('mPri');
  if(priceEl) priceEl.textContent = rub(totalPrice);

  const state = getSeatOptionAvailability(it, opt, on);
  const stateLabel = state.loaded ? state.label : 'Остатки не загружены';
  const stateCls = state.available ? 'ok' : (state.loaded ? 'none' : '');

  const detail = document.getElementById('seatOptDetail');
  if(detail){
    if(on){
      detail.innerHTML = `
        <div><b>Итог:</b> ${esc(it.t || 'Тумба')}</div>
        <div class="waOpt-list">
          <div>Комплектация: ${esc(opt.optSelectedOn||'тумба + мягкое сиденье')}</div>
          <div style="margin-top:6px;color:var(--muted)">В комплекте:</div>
          <div>${esc(it.t || 'Тумба')} — 1 шт.</div>
          <div>${esc(opt.seatTitle || 'Мягкое сиденье')} — 1 шт.</div>
          ${(()=>{ const vc=getSeatVariantColor(opt,it.id); return vc ? `<div style="margin-top:6px;color:var(--muted)">${getSeatVariants(opt)?'Выбран цвет':'Цвет сиденья'}: ${esc(vc)}</div>` : ''; })()}
          <div style="margin-top:6px"><b>Наличие комплекта:</b> ${esc(stateLabel)}</div>
        </div>
        <div class="waOpt-foot">
          <span class="waOpt-stock ${stateCls}">${esc(stateLabel)}</span>
        </div>`;
    }else{
      detail.innerHTML = `
        <div><b>Итог:</b> ${esc(it.t || 'Тумба')}</div>
        <div class="waOpt-list">
          <div>Комплектация: ${esc(opt.optSelectedOff||'только тумба')}</div>
          <div style="margin-top:6px;color:var(--muted)">${esc(opt.optAddHint||'Мягкое сиденье можно добавить как доп. опцию.')}</div>
        </div>
        <div class="waOpt-foot"><span class="waOpt-stock ${stateCls}">${esc(stateLabel)}</span></div>`;
    }
  }

  // V40_131: Кнопка встроена прямо в блок итога (никуда не перемещается).
  // Для тумб с мультиобъявлением — ДОПОЛНИТЕЛЬНО монтируем копию рядом с селектом размера (как у Альте).
  const label = on ? ('Выбрано: '+(opt.optSelectedOn||'тумба + мягкое сиденье')) : ('Выбрано: '+(opt.optSelectedOff||'только тумба'));
  const btnHtml = `<button type="button" class="wardrobeOpt-open" onclick="event.stopPropagation(); openMiniSeatOptionPopup(event,'${esc(it.id)}'); return false;">⚙️ Выбрать опции</button><div class="wardrobeOptCurrent">${esc(label)}</div>`;

  // V40_132: кнопка ТОЛЬКО внутри блока итога (правая колонка),
  // никакого дублирования рядом с селектом размера.
  const inBoxActions = document.getElementById('seatOptActionsHost');
  if(inBoxActions){
    inBoxActions.innerHTML = btnHtml;
  }
  // Внешний tools всегда скрываем — не используем
  const tools = document.getElementById('mTumbaSeatOptionTools');
  if(tools){ tools.style.display = 'none'; tools.innerHTML = ''; }
}
function refreshTumbaSeatOptionUI(tumbaId){
  const cur = window.__CUR_ITEM__;
  if(cur && String(cur.id) === String(tumbaId)) updateTumbaSeatOptionSelection(cur);
}
window.renderTumbaSeatOption = renderTumbaSeatOption;
function openMiniSeatOptionPopup(ev, tumbaId){
  if(ev){ try{ ev.stopPropagation(); ev.preventDefault(); }catch(_){} }
  closeMiniSeatOptionPopup();
  const opt = getSeatOption(tumbaId);
  if(!opt) return;
  const currentlyOn = isSeatOptionOn(tumbaId);
  const tumbaItem = (typeof findItemById === 'function') ? findItemById(tumbaId) : null;
  const tumbaPrice = tumbaItem ? Number(tumbaItem.p || 0) : 0;
  const seatPrice = Number(opt.seatPrice || 0);
  const overlay = document.createElement('div');
  overlay.id = 'seatOptionPopup';

  // Бейдж наличия каждого варианта (использует тот же стиль .waOpt-choice-stock)
  const stockNo = getSeatOptionAvailability(tumbaItem, opt, false);
  const stockYes = getSeatOptionAvailability(tumbaItem, opt, true);
  const stockNoCls = stockNo.available ? 'ok' : (stockNo.loaded ? 'none' : '');
  const stockYesCls = stockYes.available ? 'ok' : (stockYes.loaded ? 'none' : '');

  const noChoice = `
    <label class="waOpt-choice${!currentlyOn?' on':''}" data-seat-choice="off">
      <input type="radio" name="seatOpt_${esc(tumbaId)}" value="off" ${!currentlyOn?'checked':''} onchange="setSeatOptionChoice('${esc(tumbaId)}', false)">
      <span>
        <div class="waOpt-choice-copy">
          <div class="waOpt-choice-name">${esc(opt.optBaseName||'Только тумба')}</div>
          <div class="waOpt-choice-price">+0 ₽</div>
          <div class="waOpt-choice-meta">${esc(opt.optBaseMeta||'Базовая комплектация без мягкого сиденья.')}</div>
          <span class="waOpt-choice-stock ${stockNoCls}" data-seat-stock="off">${esc(stockNo.label)}</span>
        </div>
      </span>
    </label>`;
  const yesChoice = `
    <label class="waOpt-choice${currentlyOn?' on':''}" data-seat-choice="on">
      <input type="radio" name="seatOpt_${esc(tumbaId)}" value="on" ${currentlyOn?'checked':''} onchange="setSeatOptionChoice('${esc(tumbaId)}', true)">
      <span>
        <div class="waOpt-choice-copy">
          <div class="waOpt-choice-name">${esc(opt.optWithName||'Тумба + мягкое сиденье')}</div>
          <div class="waOpt-choice-price">+${rub(seatPrice)}</div>
          <div class="waOpt-choice-meta">${esc(opt.seatTitle)}${opt.seatColor?(' · '+esc(opt.seatColor)):''}</div>
          <span class="waOpt-choice-stock ${stockYesCls}" data-seat-stock="on">${esc(stockYes.label)}</span>
        </div>
      </span>
    </label>`;
  const seatVariants = getSeatVariants(opt);
  const curVarIdx = getSeatVariantIndex(tumbaId);
  const variantPicker = seatVariants ? `
    <div class="waOpt-variants" style="margin:10px 2px 0">
      <div style="font-size:13px;color:var(--muted);margin:0 0 7px">${esc(opt.optWithName||'С опцией')} — выберите цвет:</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${seatVariants.map((v,i)=>`<button type="button" data-seat-variant="${i}" onclick="setSeatVariant('${esc(tumbaId)}',${i})" style="border:1px solid var(--line,#dcdcdc);background:${i===curVarIdx?'var(--accent,#0a7d55)':'#fff'};color:${i===curVarIdx?'#fff':'var(--ink,#222)'};border-radius:9px;padding:7px 13px;font-size:13px;font-weight:600;cursor:pointer">${esc(v.color)}</button>`).join('')}
      </div>
    </div>` : '';
  const totalPrice = tumbaPrice + (currentlyOn ? seatPrice : 0);
  const initialStockHtml = seatOptionAvailabilityHtml(currentlyOn ? stockYes : stockNo);
  overlay.innerHTML = `
    <div class="wardrobeOpt-pop-backdrop" onclick="closeMiniSeatOptionPopup()"></div>
    <div class="wardrobeOpt-pop">
      <div class="wardrobeOpt-pop-h">
        <div>
          <div class="wardrobeOpt-pop-title">${esc(opt.optTitle||'Опции тумбы')}</div>
          <div class="wardrobeOpt-pop-hint">${esc(opt.optHint||'Выберите: только тумба или тумба с мягким сиденьем. Итоговая цена справа пересчитается сразу.')}</div>
        </div>
        <button type="button" class="wardrobeOpt-close" onclick="closeMiniSeatOptionPopup()" aria-label="Закрыть">×</button>
      </div>
      <div class="waOpt-choices">${noChoice}${yesChoice}</div>${variantPicker}
      <div class="wardrobeOpt-pop-actions">
        <div class="wardrobeOpt-pop-total" id="seatOptPopupTotal">Итог: <b>${rub(totalPrice)}</b>${initialStockHtml}</div>
        <button type="button" class="wardrobeOpt-done" onclick="closeMiniSeatOptionPopup()">Готово</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}
function closeMiniSeatOptionPopup(){
  const el = document.getElementById('seatOptionPopup');
  if(el) el.remove();
}
window.openMiniSeatOptionPopup = openMiniSeatOptionPopup;
window.closeMiniSeatOptionPopup = closeMiniSeatOptionPopup;
window.setSeatOptionChoice = setSeatOptionChoice;

function getBedOptions(it){
  if(!it || !window.__BED_OPTIONS__) return null;
  const rec = window.__BED_OPTIONS__[String(it.id || '')];
  return rec && rec.choices ? rec : null;
}
function hasBedOptions(it){
  const rec = getBedOptions(it);
  return !!(rec && Number(rec.basePrice || 0) > 0);
}
function shouldShowBedOptions(it){
  const rec = getBedOptions(it);
  return !!(rec && rec.showOptions && rec.choices && Object.keys(rec.choices).length > 1);
}
function getBedInitialPriceText(it){
  const rec = getBedOptions(it);
  if(!rec || !Number(rec.basePrice || 0)) return rub(it && it.p);
  return (rec.showOptions && !isFixedPlankBed(rec, it)) ? ('от ' + rub(rec.basePrice)) : rub(rec.basePrice);
}
function getWardrobeCoupe(it){
  if(!it || !window.__WARDROBE_COUPE__) return null;
  return window.__WARDROBE_COUPE__[String(it.id || '')] || null;
}
function hasWardrobeCoupe(it){ return !!getWardrobeCoupe(it); }
function getWardrobeCoupePrice(it){
  const rec = getWardrobeCoupe(it);
  if(!rec) return Number(it && it.p || 0);
  return Number(rec.sitePrice || rec.manualPrice || rec.calcPrice || it.p || 0);
}
function getWardrobeCoupeComponentStock(comp, it){
  if(!comp) return {qty:0, missing:true};
  const art = String(comp.art || '').trim();
  if(art){
    const key = (typeof normArt === 'function') ? normArt(art) : art.replace(/[\s ]+/g,'').trim();
    if(STOCK && STOCK.map && Object.prototype.hasOwnProperty.call(STOCK.map,key)){
      return {qty:Math.max(0, Number(STOCK.map[key]) || 0), missing:false};
    }
  }
  // Если артикула комплектующей нет, наличие считаем неизвестным, чтобы не показывать ложное "в наличии".
  return {qty:0, missing:true};
}
function getWardrobeCoupeAvailability(it, rec){
  if(!rec) return getDisplayAvailability(it);
  if(!STOCK.loaded) return {loaded:false, available:false, qty:null, className:'nodata', label:'Остатки не загружены', badgeLabel:'', fromCoupe:true};
  const comps = (rec.components || []).filter(c=>String(c.stock || '').toLowerCase() !== 'нет');
  let minQty = Infinity, missing = false;
  comps.forEach(c=>{
    const q = getWardrobeCoupeComponentStock(c, it);
    const need = Math.max(1, Number(c.qty || 1));
    if(q.missing) missing = true;
    minQty = Math.min(minQty, Math.floor(q.qty / need));
  });
  if(!comps.length || minQty === Infinity) minQty = 0;
  const available = !missing && minQty > 0;
  return {loaded:true, available, qty:minQty, className:available?'instock':'preorder', label: available ? ('✓ В наличии — ' + minQty + ' шт.') : 'Под заказ', badgeLabel:available?'В наличии':'', fromCoupe:true};
}
function getCatalogAvailability(it){
  // Для общего каталога и фильтра "В наличии" учитываем не только прямой остаток товара,
  // но и внутреннюю сборку шкафа-купе: корпус + фасады.
  if(typeof hasWardrobeCoupe === 'function' && hasWardrobeCoupe(it)){
    return getWardrobeCoupeAvailability(it, getWardrobeCoupe(it));
  }
  return getDisplayAvailability(it);
}

function updateWardrobeCoupeStockBadge(state){
  const stockEl = document.getElementById('mStock');
  if(!stockEl || !state) return;
  if(state.loaded){
    stockEl.className = state.className === 'instock' ? 'm-stock ok' : 'm-stock none';
    stockEl.textContent = state.label;
    stockEl.style.display = 'inline-flex';
  }else{
    stockEl.style.display = 'none';
  }
}
function cleanCoupeColor(value){
  let s = String(value || '').trim();
  s = s.replace(/^фасад\s*\d*\s*,\s*/i, '');
  s = s.replace(/^корпус\s*,\s*/i, '');
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/\s*-\s*/g, '-');
  s = s.replace(/-зеркало/i, '-зеркало');
  s = s.replace(/-лакобель\s+бел/i, '-Лакобель бел');
  s = s.replace(/-лакобель\s+чер/i, '-Лакобель чер');
  s = s.replace(/лакобель\s+бел/i, 'Лакобель бел');
  s = s.replace(/лакобель\s+чер/i, 'Лакобель чер');
  return s.trim();
}
function uniqueCleanCoupeColors(list){
  const out = [];
  (list || []).forEach(v=>{
    const c = cleanCoupeColor(v);
    if(c && !out.some(x=>x.toLowerCase() === c.toLowerCase())) out.push(c);
  });
  return out;
}
function getCoupeVisibleLook(rec){
  const comps = (rec && rec.components) || [];
  const body = comps.find(c=>String(c.type || c.group || '').toLowerCase().includes('корпус'));
  const facades = comps.filter(c=>String(c.type || c.group || '').toLowerCase().includes('фасад'));
  const bodyColor = cleanCoupeColor(body && body.color);
  const facadeColors = uniqueCleanCoupeColors(facades.map(c=>c.color));
  let facadeLook = facadeColors.join(' - ');
  if(!facadeLook) return bodyColor || '';
  if(!bodyColor) return facadeLook;
  const b = bodyColor.toLowerCase();
  const f = facadeLook.toLowerCase();
  // Если фасад уже включает цвет корпуса: Белый гладкий-зеркало, Белый гладкий-Лакобель белый и т.д.
  if(f === b || f.startsWith(b + '-') || f.startsWith(b + ' ')) return facadeLook;
  return bodyColor + ' - ' + facadeLook;
}

function cleanCoupeComponentName(comp){
  let s = String((comp && comp.name) || '').trim();
  s = s.replace(/\s+/g, ' ');
  s = s.replace(/\s*-\s*купе/g, '-купе');
  s = s.replace(/Шкаф\s*-купе/i, 'Шкаф-купе');
  s = s.replace(/\s*—\s*/g, ' — ');
  s = s.replace(/\s*,\s*/g, ', ');
  return s.trim();
}
function getCoupeComponentRows(rec){
  return ((rec && rec.components) || []).filter(c=>String(c.stock || '').toLowerCase() !== 'нет').map(c=>{
    const group = String(c.type || c.group || '').toLowerCase().includes('фасад') ? 'Фасад' : 'Корпус';
    const price = Number(c.sum || (Number(c.price || 0) * Math.max(1, Number(c.qty || 1))) || c.price || 0);
    return {group, name: cleanCoupeComponentName(c), price};
  });
}
function renderWardrobeCoupeKit(it){
  const box = document.getElementById('mCoupeKit');
  if(!box) return;
  const rec = getWardrobeCoupe(it);
  if(!rec){ box.style.display='none'; box.innerHTML=''; return; }
  const price = getWardrobeCoupePrice(it);
  const priceEl = document.getElementById('mPri');
  if(priceEl) priceEl.textContent = rub(price);
  const state = getWardrobeCoupeAvailability(it, rec);
  updateWardrobeCoupeStockBadge(state);
  const componentRows = getCoupeComponentRows(rec);
  const componentHtml = componentRows.map(row=>`<div class="coupeKit-row"><div class="coupeKit-row-k">${esc(row.group)}</div><div class="coupeKit-row-v">${esc(row.name)}</div><div class="coupeKit-row-p">${rub(row.price)}</div></div>`).join('');
  const rule = rec.rule || ((rec.title||'').toLowerCase().includes('элегант') ? 'Элегант: 1 корпус + 1 фасад' : 'Гранд: 1 корпус + 2 фасада');
  const calc = Number(rec.calcPrice || 0);
  const manual = rec.manualPrice ? Number(rec.manualPrice) : 0;
  const priceNote = manual ? 'Цена комплекта задана вручную.' : 'Цена рассчитана по комплектующим.';
  box.style.display = 'flex';
  box.innerHTML = `
    <div class="coupeKit-h">
      <div>
        <div class="coupeKit-title">Итог комплектации шкафа-купе</div>
        <div class="coupeKit-tag">${esc(rule)}</div>
      </div>
      <div class="coupeKit-hint">Цена указана за готовый комплект.</div>
    </div>
    <div class="coupeKit-detail">
      <div><b>Итог:</b> ${esc(rec.title || it.t || 'Шкаф-купе')}</div>
      ${componentHtml ? `<div class="coupeKit-list">${componentHtml}</div>` : ''}
      <div class="coupeKit-total"><span class="coupeKit-stock ${state.available ? 'ok' : 'none'}">${esc(state.loaded ? state.label : 'Остатки не загружены')}</span><b>${rub(price)}</b></div>
      <div class="coupeKit-note">${esc(priceNote)}${calc && price !== calc ? ' Расчёт по деталям: ' + rub(calc) + '.' : ''}</div>
    </div>`;
}
function getWardrobeCoupeMessageInfo(it){
  const rec = getWardrobeCoupe(it);
  if(!rec) return null;
  const price = getWardrobeCoupePrice(it);
  const rows = getCoupeComponentRows(rec);
  const lines = ['• Цена за комплект: корпус + фасады'];
  rows.forEach(row=>lines.push('• ' + row.group + ': ' + row.name));
  return {price, lines};
}
function mattressNormFirm(f){
  return String(f||'').replace(/Жесткий/g,'Жёсткий').replace(/жесткий/g,'жёсткий');
}
function buildMattressFacetAttrs(it, rec){
  const a={};
  if(rec.series) a['Серия']=rec.series;
  const ws=[]; (rec.variants||[]).forEach(function(v){ if(v.w && ws.indexOf(v.w)<0) ws.push(v.w); });
  ws.sort(function(x,y){return x-y;});
  if(ws.length) a['Размер спального места']=ws.join('|');
  const firms=[];
  if(rec.firm && rec.firm!=='Разная'){ const f0=mattressNormFirm(rec.firm); if(f0) firms.push(f0); }
  else { [rec.s1,rec.s2].forEach(function(f){ f=mattressNormFirm(f); if(f && firms.indexOf(f)<0) firms.push(f); }); }
  if(firms.length) a['Жёсткость']=firms.join('|');
  if(rec.block) a['Тип']=rec.block;
  if(rec.audience && rec.audience.length) a['Для кого']=rec.audience.join('|');
  if(rec.features && rec.features.length) a['Особенности состава']=rec.features.join('|');
  if(rec.extra && rec.extra.length) a['Доп. особенности']=rec.extra.join('|');
  return a;
}
function enrichMattressFacets(){
  if(window.__MAT_FACETS_DONE__) return;
  if(typeof window.__MATTRESS_OPTIONS__==='undefined') return;
  if(!Array.isArray(window.CATALOG)) return;
  for(const it of window.CATALOG){
    if(it.c!=='Матрасы') continue;
    const rec=window.__MATTRESS_OPTIONS__[String(it.id)];
    if(rec) it.a=buildMattressFacetAttrs(it, rec);
  }
  window.__MAT_FACETS_DONE__=true;
}
var MAT_SERIES=[
 {n:'Эксклюзив',e:'\uD83D\uDECF\uFE0F',c:'#8a8f9a',d:'Недорогие, пружины «Боннель»'},
 {n:'Элит',e:'\uD83C\uDFC5',c:'#3b82f6',d:'Независимый блок TFK 500'},
 {n:'Тренд',e:'\uD83D\uDD25',c:'#f97316',d:'Актуальные и акционные'},
 {n:'Титан',e:'\uD83D\uDCAA',c:'#eab308',d:'Без ограничения по весу'},
 {n:'Эволюшн',e:'\u2728',c:'#14b8a6',d:'Повышенный комфорт'},
 {n:'Анатомик',e:'\uD83E\uDDE9',c:'#84cc16',d:'Зональное распределение веса'},
 {n:'Карбон',e:'\uD83E\uDEA8',c:'#6b7280',d:'Жёсткие, с угольной пеной'},
 {n:'Линум',e:'\uD83C\uDF3F',c:'#22c55e',d:'Натуральный льняной чехол'},
 {n:'Премиум',e:'\uD83D\uDC51',c:'#a855f7',d:'Премиальные, 1000 пружин'},
 {n:'Платинум',e:'\uD83D\uDC8E',c:'#38bdf8',d:'Комфорт «Royal Sleep»'},
 {n:'Ультра',e:'\uD83D\uDEE1\uFE0F',c:'#f59e0b',d:'Прочные, беспружинные'},
 {n:'Джуниор',e:'\uD83D\uDE42',c:'#2dd4bf',d:'Детям от 7 лет'},
 {n:'Кидс',e:'\uD83D\uDC76',c:'#ec4899',d:'Детям 0–7 лет'}
];
function renderMattressSeriesTiles(){
  var box=document.getElementById('mSeriesTiles'); if(!box||box.dataset.built) return;
  var h='<button type="button" class="mst-toggle" onclick="toggleMatSeries()" aria-expanded="false"><span class="mst-h">Серии матрасов</span><span class="mst-chev">\u25be</span></button><div class="mst-grid">';
  var _ord=(typeof FACET_VALUE_ORDER!=='undefined'&&FACET_VALUE_ORDER['Серия'])||[];
  var _arr=MAT_SERIES.slice().sort(function(a,b){var ia=_ord.indexOf(a.n),ib=_ord.indexOf(b.n);if(ia<0)ia=999;if(ib<0)ib=999;return ia-ib;});
  _arr.forEach(function(s){
    h+='<div class="mst" data-series="'+s.n+'" onclick="selectMattressSeries(\''+s.n+'\')">'
      +'<div class="mst-ic" style="background:'+s.c+'26">'+s.e+'</div>'
      +'<div><div class="mst-n">'+s.n+'</div><div class="mst-d">'+s.d+'</div></div></div>';
  });
  h+='</div>'; box.innerHTML=h; box.dataset.built='1';
  // На телефоне блок серий по умолчанию свёрнут (длинный список мешает дойти до товаров)
  if(window.matchMedia && window.matchMedia('(max-width:860px)').matches){
    box.classList.add('mst-collapsed');
  }
}
function toggleMatSeries(){
  var box=document.getElementById('mSeriesTiles'); if(!box) return;
  var btn=box.querySelector('.mst-toggle');
  var collapsed=box.classList.toggle('mst-collapsed');
  if(btn) btn.setAttribute('aria-expanded', collapsed?'false':'true');
}
function updateMattressSeriesTiles(){
  var box=document.getElementById('mSeriesTiles'); if(!box) return;
  if(S.cat==='Матрасы'){
    renderMattressSeriesTiles(); box.style.display='';
    var active=(S.attrs['Серия']&&S.attrs['Серия'].length===1)?S.attrs['Серия'][0]:'';
    box.querySelectorAll('.mst').forEach(function(el){ el.classList.toggle('active', el.getAttribute('data-series')===active); });
  } else { box.style.display='none'; }
}
function selectMattressSeries(series){
  var cur=(S.attrs['Серия']&&S.attrs['Серия'].length===1)?S.attrs['Серия'][0]:'';
  S.cat='Матрасы'; S.facetSearch={};
  S.attrs=(cur===series)?{}:{'Серия':[series]};
  var sel=document.getElementById('catSel'); if(sel) sel.value='Матрасы';
  if(typeof updateFactoryOptions==='function') updateFactoryOptions('Матрасы');
  page=1; buildFacets(); apply();
  // Адрес: ?series=Элит (сняли серию — остаётся ?cat=Матрасы)
  if(!window.__ROUTING__){ favWriteUrl(null, true); }
  goCat(); // листаем к товарам с учётом липкой шапки (на ПК больше не улетает вниз)
}
function getItemInitialPriceText(it){
  if(hasMattressOptions(it)) return 'от ' + rub(mattressMinPrice(it));
  if(hasWardrobeCoupe(it)) return rub(getWardrobeCoupePrice(it));
  if(hasWardrobeAtticOption(it)) return 'от ' + rub((getWardrobeAttic(it).base && getWardrobeAttic(it).base.price) || it.p);
  if(hasBedOptions(it)) return getBedInitialPriceText(it);
  return rub(it && it.p);
}
function getBedCardDisplayPrice(it, fallback){
  if(hasBedOptions(it)){
    const v = getBedSelectedVariant(it) || (getBedOptions(it) && getBedOptions(it).choices && getBedOptions(it).choices.base);
    const pv = Number(v && v.price || 0);
    if(pv > 0) return pv;
  }
  const pf = Number((it && it.p) || fallback || 0);
  return pf > 0 ? pf : 0;
}
function getBedCardDisplayPriceText(it, fallback){
  const p = getBedCardDisplayPrice(it, fallback);
  return p ? (p.toLocaleString('ru-RU') + ' ₽') : '—';
}
function getBedOptionShortParts(it){
  const rec = getBedOptions(it);
  if(!rec) return [];
  const st = getBedChoiceState(it);
  const base = (rec.choices && rec.choices[st.baseKey]) || (rec.choices && rec.choices.base) || null;
  const baseLabel = String((base && (base.label || base.rawLabel)) || '').toLowerCase().replace(/ё/g,'е');
  let shortBase = 'Без осн.';
  if(baseLabel.includes('настил')) shortBase = baseLabel.includes('лдсп') ? 'Настил ЛДСП' : (baseLabel.includes('дсп') ? 'Настил ДСП' : 'Настил');
  else if(baseLabel.includes('разбор')) shortBase = 'Орт. разб.';
  else if(baseLabel.includes('свар')) shortBase = 'Орт. свар.';
  else if(baseLabel.includes('ортоп')) shortBase = 'Ортопед';
  const parts = [shortBase];
  if(st.pm || baseLabel.includes('пм') || baseLabel.includes('подъем') || baseLabel.includes('подъём')) parts.push('ПМ');
  if(st.box || baseLabel.includes('дно') || baseLabel.includes('короб') || baseLabel.includes('ящик')) parts.push('Ящик');
  return parts;
}
function getBedOptionShortText(it){
  return getBedOptionShortParts(it).join(', ');
}
function getBedOptionShortBadge(it){
  if(!shouldShowBedOptions(it)) return '';
  const txt = getBedOptionShortText(it);
  return `<div class="kitCard-bedsummary${txt ? '' : ' empty'}">${esc(txt || 'Опции не выбраны')}</div>`;
}
function bedStateKey(id){ return String(id || ''); }
function getBedAllowedBaseKeys(rec){
  const keys = [];
  // V40_108: кроме Велес-ключей поддерживаем варианты Микон: ЛДСП, ДСП 2с, ортопед на опорах, ортопед+ПМ+ящик.
  ['base','plank','plankLdsp','plankDsp2','ortho','orthoSplit','orthoWeld','orthoPmBox'].forEach(k=>{ if(rec && rec.choices && rec.choices[k]) keys.push(k); });
  return keys;
}
function getBedFullKey(baseKey){
  if(baseKey === 'orthoSplit') return 'orthoSplitFull';
  if(baseKey === 'orthoWeld') return 'orthoWeldFull';
  if(baseKey === 'ortho') return 'orthoFull';
  return '';
}
function findBedAddonComponents(rec, baseKey){
  const fullKey = getBedFullKey(baseKey);
  const full = rec && rec.choices ? rec.choices[fullKey] : null;
  const comps = Array.isArray(full && full.components) ? full.components : [];
  const pm = comps.find(c=>/под[ъь]е?м|подъем|подъём/i.test(String((c && (c.type || c.label || c.name)) || '')));
  const box = comps.find(c=>/(короб|дно)/i.test(String((c && (c.type || c.label || c.name)) || '')));
  return {pm:pm || null, box:box || null, full};
}
function canBedBaseHaveAddons(rec, baseKey){
  if(!rec || !rec.allowAddons) return false;
  if(!String(baseKey || '').startsWith('ortho')) return false;
  const a = findBedAddonComponents(rec, baseKey);
  return !!a.pm;
}
function getBedChoiceState(it){
  const rec = getBedOptions(it);
  const id = bedStateKey(it && it.id);
  const allowed = getBedAllowedBaseKeys(rec);
  const saved = BED_OPTION_CHOICE[id] || {};
  let baseKey = allowed.includes(saved.baseKey) ? saved.baseKey : (allowed[0] || 'base');
  let pm = !!saved.pm;
  let box = !!saved.box;
  if(!canBedBaseHaveAddons(rec, baseKey)){
    pm = false;
    box = false;
  }
  // Короб/дно можно выбрать отдельно, но только после подъёмного механизма.
  // То есть подъёмник может быть без дна, а дно без подъёмника — нет.
  if(!pm) box = false;
  return {baseKey, pm, box};
}
function saveBedChoiceState(id, st){
  BED_OPTION_CHOICE[bedStateKey(id)] = {baseKey:st.baseKey || 'base', pm:!!st.pm, box:!!st.box};
}
function setBedBaseChoice(id, baseKey){
  const it = findItemById(id);
  const rec = getBedOptions(it);
  if(!rec) return;
  const allowed = getBedAllowedBaseKeys(rec);
  const st = getBedChoiceState(it);
  st.baseKey = allowed.includes(baseKey) ? baseKey : (allowed[0] || 'base');
  if(!canBedBaseHaveAddons(rec, st.baseKey)){
    st.pm = false;
    st.box = false;
  }
  saveBedChoiceState(id, st);
  updateBedOptionSelection(it);
}
function setBedAddon(id, addon, checked){
  const it = findItemById(id);
  const rec = getBedOptions(it);
  if(!rec || !rec.allowAddons) return;
  const st = getBedChoiceState(it);
  if(!canBedBaseHaveAddons(rec, st.baseKey)) return;
  if(addon === 'pm'){
    st.pm = !!checked;
    if(!st.pm) st.box = false;
  }else if(addon === 'box'){
    st.box = !!checked && !!st.pm;
  }
  saveBedChoiceState(id, st);
  updateBedOptionSelection(it);
}
function bedVariantKeyFromState(rec, st){
  const baseKey = (st && st.baseKey) || 'base';
  if(!rec || !rec.choices) return baseKey;
  if(rec.allowAddons && st && st.pm && st.box){
    const fullKey = getBedFullKey(baseKey);
    if(fullKey && rec.choices[fullKey]) return fullKey;
  }
  return rec.choices[baseKey] ? baseKey : (getBedAllowedBaseKeys(rec)[0] || 'base');
}
function cloneBedComponent(c){ return Object.assign({}, c || {}); }
function buildCustomBedVariant(rec, st){
  if(!rec || !rec.choices) return null;
  const baseKey = rec.choices[st.baseKey] ? st.baseKey : (getBedAllowedBaseKeys(rec)[0] || 'base');
  const base = rec.choices[baseKey];
  if(!base) return null;
  const addon = findBedAddonComponents(rec, baseKey);
  const comps = (Array.isArray(base.components) ? base.components : []).map(cloneBedComponent);
  let price = Number(base.price || 0);
  const labels = [String(base.label || base.rawLabel || 'Комплектация').trim()];
  const rawLabels = [String(base.rawLabel || base.label || 'Комплектация').trim()];
  if(canBedBaseHaveAddons(rec, baseKey) && st.pm && addon.pm){
    comps.push(cloneBedComponent(addon.pm));
    price += Number(addon.pm.price || 0);
    labels.push('подъёмный механизм');
    rawLabels.push('ПМ');
  }
  if(canBedBaseHaveAddons(rec, baseKey) && st.pm && st.box && addon.box){
    comps.push(cloneBedComponent(addon.box));
    price += Number(addon.box.price || 0);
    labels.push('короб/дно');
    rawLabels.push('дно');
  }
  const key = baseKey + (st.pm ? 'Pm' : '') + (st.box ? 'Box' : '');
  return {
    key,
    baseKey,
    label: labels.join(' + '),
    rawLabel: rawLabels.join(' + '),
    hint: base.hint || '',
    price,
    composition: comps.map(c=>c.label || c.type || '').filter(Boolean).join(' + '),
    status: '',
    availableKits: null,
    components: comps
  };
}
function getBedSelectedVariant(it){
  const rec = getBedOptions(it);
  if(!rec) return null;
  const st = getBedChoiceState(it);
  // Если выбраны обе доп. опции, используем готовую связку из прайса, если она есть.
  const fullKey = bedVariantKeyFromState(rec, st);
  if(st.pm && st.box && rec.choices && rec.choices[fullKey]) return rec.choices[fullKey];
  return buildCustomBedVariant(rec, st) || rec.choices.base || null;
}
function isFixedPlankBed(rec, it){
  const size = Number((rec && rec.size) || (it && (it.sw || it.w)) || 0);
  const choices = rec && rec.choices ? Object.keys(rec.choices) : [];
  // У Велес кровати 800 идут уже с настилом/ящиками, поэтому не показываем их как "без основания".
  return size === 800 && choices.length === 1 && !!(rec && rec.choices && rec.choices.base);
}
function bedOptionCustomerLabel(rec, variant){
  if(!variant) return 'только кровать';
  if(variant.key === 'base') return isFixedPlankBed(rec, null) ? 'с настилом' : 'только кровать';
  let label = String(variant.label || variant.rawLabel || 'комплектация').replace(/\s+/g,' ').trim();
  const raw = String(variant.rawLabel || '').replace(/ё/g,'е').toLowerCase();
  const hasBox = raw.includes('дно') || raw.includes('короб') || (Array.isArray(variant.components) && variant.components.some(c=>/(дно|короб)/i.test(String((c && (c.type || c.label || c.name)) || ''))));
  if(hasBox && !/(дно|короб)/i.test(label)){
    label += ' + дно для белья';
  }else if(hasBox){
    label = label.replace(/\bдно\b/gi, 'дно для белья').replace(/короб\/?дно/gi, 'дно для белья');
  }
  return label.replace(/\s*\+\s*/g,' + ').replace(/\s+/g,' ').trim();
}
function getBedComponentQtyFromStock(comp, it){
  if(!comp) return {qty:0, missing:true};
  const art = comp.art || '';
  if(!art) return {qty:0, missing:true};
  if(comp.type === 'Корпус кровати' && it && Number.isFinite(Number(it._stockQty))){
    return {qty:Math.max(0, Number(it._stockQty) || 0), missing:false};
  }
  const key = (typeof normArt === 'function') ? normArt(art) : String(art).replace(/[\s\u00A0]+/g,'').trim();
  if(!STOCK || !STOCK.map || !Object.prototype.hasOwnProperty.call(STOCK.map, key)) return {qty:0, missing:true};
  return {qty:Math.max(0, Number(STOCK.map[key]) || 0), missing:false};
}
function getBedVariantAvailabilityShort(it, variant){
  if(!variant) return {loaded:false, available:false, text:'', cls:'muted'};
  if(!STOCK.loaded) return {loaded:false, available:false, text:'Остатки не загружены', cls:'muted'};
  const comps = Array.isArray(variant.components) ? variant.components : [];
  let missing = false;
  let minQty = Infinity;
  comps.forEach(c=>{
    const q = getBedComponentQtyFromStock(c, it);
    if(q.missing) missing = true;
    minQty = Math.min(minQty, q.qty);
  });
  if(!comps.length || minQty === Infinity) minQty = 0;
  const ok = !missing && minQty > 0;
  return {loaded:true, available:ok, qty:minQty, text: ok ? 'В наличии' : 'Под заказ', cls: ok ? 'ok' : 'none'};
}
function getBedComponentAvailabilityShort(it, comp){
  if(!STOCK.loaded) return {loaded:false, available:false, text:'Остатки не загружены', cls:'muted'};
  const q = getBedComponentQtyFromStock(comp, it);
  const ok = !q.missing && q.qty > 0;
  return {loaded:true, available:ok, qty:q.qty, text: ok ? 'В наличии' : 'Под заказ', cls: ok ? 'ok' : 'none'};
}
function bedOptionAvailabilityHtml(state){
  if(!state || !state.text) return '';
  return `<div class="bedOpt-avail ${esc(state.cls || 'muted')}">${esc(state.text)}</div>`;
}
function isBedBaseOnlyVariant(variant){
  const key = String((variant && variant.key) || '').toLowerCase();
  return key === 'base';
}
function getBedOptionAvailability(it, rec, variant){
  if(!variant) return getDisplayAvailability(it);
  if(!STOCK.loaded){
    return {loaded:false, available:false, qty:null, className:'nodata', label:'Остатки не загружены', badgeLabel:'', fromBedOption:true};
  }
  const short = getBedVariantAvailabilityShort(it, variant);
  const available = !!short.available;
  const qty = Math.max(0, Number(short.qty) || 0);
  const unit = isBedBaseOnlyVariant(variant) ? ' шт.' : ' компл.';
  return {
    loaded:true,
    available,
    qty,
    className: available ? 'instock' : 'preorder',
    label: available ? ('✓ В наличии — ' + qty + unit) : 'Под заказ',
    badgeLabel: available ? 'В наличии' : '',
    fromBedOption:true
  };
}
function updateBedStockBadge(state){
  const stockEl = document.getElementById('mStock');
  if(!stockEl || !state) return;
  if(state.loaded){
    stockEl.className = state.className === 'instock' ? 'm-stock ok' : 'm-stock none';
    stockEl.textContent = state.label;
    stockEl.style.display = 'inline-flex';
  }else{
    stockEl.style.display = 'none';
  }
}
function bedOptionExtraPrice(rec, price){
  const basePrice = Number((rec && rec.choices && rec.choices.base && rec.choices.base.price) || rec.basePrice || 0);
  const delta = Math.max(0, Number(price || 0) - basePrice);
  return delta;
}
function bedOptionExtraText(rec, price){
  const delta = bedOptionExtraPrice(rec, price);
  return delta > 0 ? ('+' + rub(delta)) : '+0 ₽';
}
function renderBedOptionChoice(rec, key, id, it){
  const v = rec.choices[key];
  if(!v) return '';
  const avail = bedOptionAvailabilityHtml(getBedVariantAvailabilityShort(it, v));
  return `
    <label class="bedOpt-choice" data-choice="${esc(key)}">
      <input type="radio" name="bedBaseOpt" value="${esc(key)}" onchange="setBedBaseChoice('${esc(id)}','${esc(key)}')">
      <span>
        <div class="bedOpt-name">${esc(v.label || v.rawLabel || key)}</div>
        <div class="bedOpt-price">${bedOptionExtraText(rec, v.price)}</div>
        <div data-bed-base-avail="${esc(key)}">${avail}</div>
        ${v.hint ? `<div class="bedOpt-note">${esc(v.hint)}</div>` : ''}
      </span>
    </label>`;
}
function mountBedOptionToolsHost(){
  const tools = document.getElementById('mBedOptionTools');
  if(!tools) return;
  const inlineHost = document.querySelector('#mMultiSizes .mMulti-controls');
  if(inlineHost){
    inlineHost.appendChild(tools);
    tools.classList.add('bedOptTools-inline');
  }else{
    const fallbackHost = document.querySelector('.mGal');
    if(fallbackHost && tools.parentNode !== fallbackHost) fallbackHost.appendChild(tools);
    tools.classList.remove('bedOptTools-inline');
  }
}
function toggleBedOptionWindow(e, id){
  if(e) e.preventDefault();
  const pop = document.getElementById('bedOptPopup');
  const backdrop = document.getElementById('bedOptPopupBackdrop');
  if(!pop) return;
  const open = (pop.style.display === 'none' || !pop.style.display);
  pop.style.display = open ? 'block' : 'none';
  if(backdrop) backdrop.style.display = open ? 'block' : 'none';
}
function closeBedOptionWindow(){
  const pop = document.getElementById('bedOptPopup');
  const backdrop = document.getElementById('bedOptPopupBackdrop');
  if(pop) pop.style.display = 'none';
  if(backdrop) backdrop.style.display = 'none';
}
function renderBedOptionTools(it){
  const tools = document.getElementById('mBedOptionTools');
  if(!tools) return;
  const rec = getBedOptions(it);
  if(!rec || !rec.showOptions || isFixedPlankBed(rec, it)){ tools.style.display='none'; tools.innerHTML=''; tools.classList.remove('bedOptTools-inline'); return; }
  const id = String(it.id || '');
  const baseKeys = getBedAllowedBaseKeys(rec);
  const baseHtml = baseKeys.map(k=>renderBedOptionChoice(rec, k, id, it)).join('');
  tools.style.display = 'block';
  tools.innerHTML = `
    <div class="bedOptTools-in">
      <button type="button" class="bedOpt-open" onclick="toggleBedOptionWindow(event,'${esc(id)}')">⚙️ Выбрать опции</button>
      <div class="bedOpt-current" id="bedOptCurrentMini"></div>
    </div>
    <div class="bedOpt-pop-backdrop" id="bedOptPopupBackdrop" style="display:none" onclick="closeBedOptionWindow()"></div>
    <div class="bedOpt-pop" id="bedOptPopup" style="display:none">
      <div class="bedOpt-pop-h">
        <div>
          <div class="bedOpt-pop-title">Опции кровати</div>
          <div class="bedOpt-pop-hint">Выберите основание и дополнительные функции. Итоговая цена пересчитается.</div>
        </div>
        <button type="button" class="bedOpt-close" onclick="closeBedOptionWindow()" aria-label="Закрыть">×</button>
      </div>
      <div class="bedOpt-sub">Основание</div>
      <div class="bedOpt-grid">${baseHtml}</div>
      <div class="bedOpt-addons" id="bedOptAddons" style="display:none">
        <div class="bedOpt-sub">Дополнительные опции</div>
        <div class="bedOpt-checks">
          <label class="bedOpt-check" data-bed-addon-wrap="pm"><input type="checkbox" data-bed-addon="pm" onchange="setBedAddon('${esc(id)}','pm',this.checked)"> <span>Подъёмный механизм <b id="bedAddonPmPrice"></b><span id="bedAddonPmAvail"></span></span></label>
          <label class="bedOpt-check" data-bed-addon-wrap="box"><input type="checkbox" data-bed-addon="box" onchange="setBedAddon('${esc(id)}','box',this.checked)"> <span>Короб / дно для белья <b id="bedAddonBoxPrice"></b><span id="bedAddonBoxAvail"></span></span></label>
        </div>
        <div class="bedOpt-warn">Короб/дно можно добавить только при выбранном подъёмном механизме. Подъёмник можно выбрать и без дна.</div>
      </div>
      <div class="bedOpt-pop-actions"><div class="bedOpt-pop-total" id="bedOptPopupTotal">Итог: —</div><button type="button" class="bedOpt-done" onclick="closeBedOptionWindow()">Готово</button></div>
    </div>`;
  mountBedOptionToolsHost();
}
function updateBedOptionSelection(it){
  const rec = getBedOptions(it);
  const box = document.getElementById('mBedOptions');
  if(!box || !rec || !rec.showOptions) return;
  const st = getBedChoiceState(it);
  const selected = getBedSelectedVariant(it) || rec.choices.base;
  document.querySelectorAll('#mBedOptionTools .bedOpt-choice').forEach(el=>el.classList.toggle('on', el.dataset.choice === st.baseKey));
  document.querySelectorAll('#mBedOptionTools input[name="bedBaseOpt"]').forEach(inp=>{ inp.checked = inp.value === st.baseKey; });
  document.querySelectorAll('#mBedOptionTools [data-bed-base-avail]').forEach(el=>{
    const key = el.getAttribute('data-bed-base-avail');
    const v = rec && rec.choices ? rec.choices[key] : null;
    el.innerHTML = v ? bedOptionAvailabilityHtml(getBedVariantAvailabilityShort(it, v)) : '';
  });
  document.querySelectorAll('#mBedOptionTools input[data-bed-addon]').forEach(inp=>{
    inp.checked = inp.dataset.bedAddon === 'pm' ? !!st.pm : !!st.box;
  });
  const addons = document.querySelector('#mBedOptionTools #bedOptAddons');
  const canAdd = canBedBaseHaveAddons(rec, st.baseKey);
  if(addons) addons.style.display = canAdd ? 'flex' : 'none';
  const addonComps = findBedAddonComponents(rec, st.baseKey);
  const pmPriceEl = document.getElementById('bedAddonPmPrice');
  const boxPriceEl = document.getElementById('bedAddonBoxPrice');
  if(pmPriceEl) pmPriceEl.textContent = addonComps && addonComps.pm ? ('+' + rub(Number(addonComps.pm.price || 0))) : '';
  if(boxPriceEl) boxPriceEl.textContent = addonComps && addonComps.box ? ('+' + rub(Number(addonComps.box.price || 0))) : '';
  const pmAvailEl = document.getElementById('bedAddonPmAvail');
  const boxAvailEl = document.getElementById('bedAddonBoxAvail');
  if(pmAvailEl) pmAvailEl.innerHTML = addonComps && addonComps.pm ? bedOptionAvailabilityHtml(getBedComponentAvailabilityShort(it, addonComps.pm)) : '';
  if(boxAvailEl) boxAvailEl.innerHTML = addonComps && addonComps.box ? bedOptionAvailabilityHtml(getBedComponentAvailabilityShort(it, addonComps.box)) : '';
  const boxWrap = document.querySelector('#mBedOptionTools [data-bed-addon-wrap="box"]');
  const boxInp = document.querySelector('#mBedOptionTools input[data-bed-addon="box"]');
  if(boxInp){ boxInp.disabled = !st.pm; if(!st.pm) boxInp.checked = false; }
  if(boxWrap){ boxWrap.classList.toggle('off', !st.pm); boxWrap.title = st.pm ? '' : 'Сначала выберите подъёмный механизм'; }
  const mini = document.getElementById('bedOptCurrentMini');
  if(mini && selected){ mini.innerHTML = `Выбрано: <b>${esc(bedOptionCustomerLabel(rec, selected))}</b><br>${rub(selected.price)}`; }
  const popupTotal = document.getElementById('bedOptPopupTotal');
  if(popupTotal && selected){ popupTotal.innerHTML = `Итог: <b>${rub(selected.price)}</b>`; }
  const priceEl = document.getElementById('mPri');
  if(priceEl) priceEl.textContent = selected ? rub(selected.price) : getBedInitialPriceText(it);
  const state = getBedOptionAvailability(it, rec, selected);
  updateBedStockBadge(state);
  const detail = box.querySelector('#bedOptDetail');
  if(detail && selected){
    const customer = bedOptionCustomerLabel(rec, selected);
    const baseVariant = (rec.choices && rec.choices[st.baseKey]) ? rec.choices[st.baseKey] : (rec.choices && rec.choices.base ? rec.choices.base : null);
    const priceLines = [];
    if(baseVariant){
      const baseLabel = String(baseVariant.label || baseVariant.rawLabel || (st.baseKey === 'base' ? 'Без основания' : 'Основание')).trim();
      priceLines.push(`<div>${esc(baseLabel)} — <b>${bedOptionExtraText(rec, baseVariant.price)}</b></div>`);
    }
    if(st.pm && addonComps && addonComps.pm){
      priceLines.push(`<div>Подъёмный механизм — <b>+${rub(Number(addonComps.pm.price || 0))}</b></div>`);
    }
    if(st.box && addonComps && addonComps.box){
      priceLines.push(`<div>Короб / дно для белья — <b>+${rub(Number(addonComps.box.price || 0))}</b></div>`);
    }
    detail.innerHTML = `
      <div><b>Итог:</b> ${esc(it.t || rec.title || 'Кровать')}</div>
      <div class="bedOpt-list">
        <div>Комплектация: ${esc(customer)}</div>
        ${priceLines.length ? `<div style="margin-top:6px;color:var(--muted)">Доплата по опциям:</div><div style="margin-top:4px;display:grid;gap:3px">${priceLines.join('')}</div>` : ''}
      </div>
      <div class="bedOpt-total">
        <span class="bedOpt-stock ${state.available ? 'ok' : 'none'}">${esc(state.loaded ? state.label : 'Остатки не загружены')}</span>
      </div>`;
  }
}
/* ===== Матрасы Корона: размер × ткань, наличие, ВК (V41_7) ===== */
window.__MATTRESS_CHOICE__ = window.__MATTRESS_CHOICE__ || {};
function getMattressOptions(it){
  if(!it || typeof window.__MATTRESS_OPTIONS__==='undefined') return null;
  return window.__MATTRESS_OPTIONS__[String(it.id)] || null;
}
function hasMattressOptions(it){
  const r=getMattressOptions(it);
  return !!(r && r.variants && r.variants.length);
}
function mattressVariantQty(v){
  if(!v || !v.art) return 0;
  if(typeof STOCK==='undefined' || !STOCK || !STOCK.map) return 0;
  let q=0;
  try{ artVariants(v.art).forEach(function(a){ if(Object.prototype.hasOwnProperty.call(STOCK.map,a)) q+=Number(STOCK.map[a])||0; }); }catch(_){}
  return Math.max(0, q);
}
function mattressVariantInStock(v){ return mattressVariantQty(v)>0; }
function mattressMaxQty(it){
  const rec=getMattressOptions(it); if(!rec) return 0;
  let mx=0; rec.variants.forEach(function(v){ const q=mattressVariantQty(v); if(q>mx) mx=q; }); return mx;
}
function mattressSizeInStock(rec, size){
  return rec.variants.some(v=>v.size===size && mattressVariantInStock(v));
}
function mattressAnyInStock(it){
  const rec=getMattressOptions(it);
  if(!rec) return false;
  return rec.variants.some(v=>mattressVariantInStock(v));
}
function mattressSortedSizes(rec){
  const seen={}, out=[];
  rec.variants.slice().sort((a,b)=>((a.w||0)-(b.w||0))||((a.l||0)-(b.l||0))).forEach(v=>{
    if(!seen[v.size]){ seen[v.size]=1; out.push(v.size); }
  });
  return out;
}
function mattressFabricsForSize(rec, size){
  const seen={}, out=[];
  rec.variants.filter(v=>v.size===size).forEach(v=>{
    if(!seen[v.ftype]){ seen[v.ftype]=1; out.push(v.ftype); }
  });
  return out;
}
function findMattressVariant(rec, size, ftype){
  return rec.variants.find(v=>v.size===size && v.ftype===ftype)
      || rec.variants.find(v=>v.size===size)
      || rec.variants[0];
}
function mattressDefaultChoice(it, rec){
  const sizes = mattressSortedSizes(rec);
  let size = sizes.find(s=>mattressSizeInStock(rec,s)) || sizes[0];
  const fabs = mattressFabricsForSize(rec, size);
  let ftype = fabs.find(f=>mattressVariantInStock(findMattressVariant(rec,size,f))) || fabs[0];
  return {size:size, ftype:ftype};
}
function getMattressChoice(it, rec){
  const id=String(it.id);
  if(!window.__MATTRESS_CHOICE__[id]) window.__MATTRESS_CHOICE__[id]=mattressDefaultChoice(it,rec);
  return window.__MATTRESS_CHOICE__[id];
}
function mattressCardSizeVariant(rec){
  const vs=rec.variants||[];
  // Эталон — 80x200 (популярный размер для всех, включая детские).
  let ref=vs.find(function(v){ return v.w===80 && v.l===200; });
  if(ref) return ref;
  // Если 80x200 нет (напр. Платинум) — минимальный популярный (длину 190/180 не учитываем).
  let pool=vs.filter(function(v){ return v.l!==190 && v.l!==180; });
  if(!pool.length) pool=vs.slice();
  pool.sort(function(a,b){ return ((a.w||0)-(b.w||0))||((a.l||0)-(b.l||0)); });
  return pool[0]||null;
}
function mattressMinPrice(it){
  const rec=getMattressOptions(it); if(!rec || !rec.variants || !rec.variants.length) return (it&&it.p)||0;
  const sm=mattressCardSizeVariant(rec);
  if(!sm) return (it&&it.p)||0;
  // Цена минимального популярного размера (самый дешёвый из его тканей).
  let mn=Infinity;
  rec.variants.forEach(function(v){ if(v.size===sm.size){ const p=Number(v.price)||0; if(p>0 && p<mn) mn=p; } });
  return mn===Infinity ? (Number(sm.price)||(it&&it.p)||0) : mn;
}
function mattressInitialPrice(it){
  const rec=getMattressOptions(it); if(!rec) return it.p;
  const ch=getMattressChoice(it,rec);
  const v=findMattressVariant(rec,ch.size,ch.ftype);
  return (v && v.price) || it.p;
}
function mattressVariantLink(it, v){
  try{ return 'https://мебель-фаворит.рф/?item='+encodeURIComponent(it.id)+'&msize='+encodeURIComponent(v.size)+'&mfab='+encodeURIComponent(v.ftype); }
  catch(_){ return 'https://мебель-фаворит.рф/?item='+((it&&it.id)||''); }
}
function mattressVkMessage(it, v){
  const fab=(v.fabric||'').toLowerCase();
  const grade=(String(v.ftype||'').match(/(\d+)/)||[])[1]||'';
  const sizeMm=((v.l||0)*10)+'*'+((v.w||0)*10);
  const price=(Number(v.price)||0).toLocaleString('ru-RU');
  const link=mattressVariantLink(it, v);
  const tail=(fab+' '+grade).trim();
  return 'Здравствуйте! Интересует товар:\n'
       + '\u2022 ('+(it.f||'Корона')+') '+it.t+' '+sizeMm+(tail?(' '+tail):'')+'\n'
       + '\u2022 Цена: '+price+' \u20bd\n'
       + '\u2022 Ссылка: '+link+'\n'
       + 'Подскажите как сделать заказ?';
}
function selectMattressSize(id, i){
  const it=findItemById(id); if(!it) return;
  const rec=getMattressOptions(it); if(!rec) return;
  const size=mattressSortedSizes(rec)[i]; if(!size) return;
  const ch=getMattressChoice(it,rec); ch.size=size;
  const fabs=mattressFabricsForSize(rec,size);
  if(fabs.indexOf(ch.ftype)<0) ch.ftype=fabs[0];
  renderMattressOptions(it);
}
function selectMattressFabric(id, i){
  const it=findItemById(id); if(!it) return;
  const rec=getMattressOptions(it); if(!rec) return;
  const ch=getMattressChoice(it,rec);
  const f=mattressFabricsForSize(rec,ch.size)[i]; if(!f) return;
  ch.ftype=f; renderMattressOptions(it);
}
function copyMattressVk(id){
  const ta=document.getElementById('mMattressVkText'); if(!ta) return;
  const done=()=>{ const b=document.getElementById('mMattressVkCopy'); if(b){ const o=b.getAttribute('data-lbl')||b.textContent; b.setAttribute('data-lbl',o); b.textContent='Скопировано \u2713'; setTimeout(()=>{b.textContent=o;},1500);} };
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(ta.value).then(done, ()=>{ ta.removeAttribute('readonly'); ta.select(); document.execCommand('copy'); ta.setAttribute('readonly','readonly'); done(); });
    } else { ta.removeAttribute('readonly'); ta.select(); document.execCommand('copy'); ta.setAttribute('readonly','readonly'); done(); }
  }catch(_){ ta.select(); }
}
function mattressAttrPairs(it, v, rec){
  const pairs=[];
  if(v){
    pairs.push(['Ширина × Длина', ((v.w!=null?v.w:'?'))+' × '+((v.l!=null?v.l:'?'))+' см']);
    if(v.h) pairs.push(['Высота', v.h+' см']);
  }
  pairs.push(['Производитель', (it&&it.f)||'Корона']);
  const block=(rec&&rec.block)||'';
  if(block){
    pairs.push(['Тип матраса', block==='Беспружинный'?'Беспружинный':'Пружинный']);
    pairs.push(['Блок', block]);
  }
  if(rec){
    if(rec.firm==='Разная' && (rec.s1||rec.s2)) pairs.push(['Жёсткость', 'Разная ('+(rec.s1||'?')+' / '+(rec.s2||'?')+')']);
    else if(rec.firm) pairs.push(['Жёсткость', rec.firm]);
  } else if(v && v.firm){ pairs.push(['Жёсткость', v.firm]); }
  if(rec && rec.constr) pairs.push(['Конструкция', rec.constr]);
  if(rec && rec.maxload) pairs.push(['Макс. нагрузка', rec.maxload+' кг']);
  else if(rec && rec.extra && rec.extra.indexOf('Без ограничения веса')>=0) pairs.push(['Макс. нагрузка', 'Без ограничения']);
  let cover='';
  if(v && v.fabric){ cover=v.fabric; if(v.ftype) cover+=' «'+v.ftype+'»'; }
  if(cover) pairs.push(['Чехол (ткань)', cover]);
  if(rec && rec.features && rec.features.length) pairs.push(['Особенности состава', rec.features.join(', ')]);
  return pairs;
}
function renderMattressAttrs(it, v, rec){
  const att=document.getElementById('mAtt');
  if(!att) return;
  const pairs=mattressAttrPairs(it, v, rec);
  let h=pairs.map(function(p){ return '<div class="mA"><div class="mA-l">'+esc(p[0])+'</div><div class="mA-v">'+esc(String(p[1]))+'</div></div>'; }).join('');
  if(rec && rec.comp){ h+='<div class="mA"><div class="mA-l">Состав</div><div class="mA-v">'+esc(rec.comp)+'</div></div>'; }
  att.innerHTML=h;
}
function renderMattressOptions(it, opts){
  const box=document.getElementById('mMattressOptions');
  if(!box) return;
  const rec=getMattressOptions(it);
  if(!rec || !rec.variants || !rec.variants.length){ box.style.display='none'; box.innerHTML=''; return; }
  if(opts && (opts.msize || opts.mfab)){
    const ch0=getMattressChoice(it,rec);
    if(opts.msize && mattressSortedSizes(rec).indexOf(opts.msize)>=0){
      ch0.size=opts.msize;
      const fabs0=mattressFabricsForSize(rec,ch0.size);
      if(opts.mfab && fabs0.indexOf(opts.mfab)>=0) ch0.ftype=opts.mfab;
      else if(fabs0.indexOf(ch0.ftype)<0) ch0.ftype=fabs0[0];
    }
  }
  const ch=getMattressChoice(it,rec);
  const sizes=mattressSortedSizes(rec);
  const fabs=mattressFabricsForSize(rec,ch.size);
  const cur=findMattressVariant(rec,ch.size,ch.ftype);
  const curQty=mattressVariantQty(cur);
  const stockLoaded=(typeof STOCK!=='undefined' && STOCK && STOCK.loaded);
  const inStock=curQty>0;
  const sizeChips=sizes.map((s,i)=>{
    const st=mattressSizeInStock(rec,s);
    const on=(s===ch.size)?' on':'';
    return '<button type="button" class="mOptChip'+on+'" onclick="selectMattressSize('+it.id+','+i+')"><span class="mOptDot'+(st?' in':'')+'"></span>'+esc(s)+'</button>';
  }).join('');
  const fabChips=fabs.map((f,i)=>{
    const st=mattressVariantInStock(findMattressVariant(rec,ch.size,f));
    const on=(f===ch.ftype)?' on':'';
    return '<button type="button" class="mOptChip'+on+'" onclick="selectMattressFabric('+it.id+','+i+')"><span class="mOptDot'+(st?' in':'')+'"></span>'+esc(f)+'</button>';
  }).join('');
  const statusHtml = !stockLoaded ? '<span class="mOptStatus">Остатки не загружены</span>' : (inStock ? ('<span class="mOptStatus in">\u2713 В наличии — '+curQty+' шт.</span>') : '<span class="mOptStatus out">Под заказ</span>');
  const vk=cur?mattressVkMessage(it,cur):'';
  box.innerHTML=
    '<div class="mOptBlock">'
    + '<div class="mOptLabel">Размер, см</div><div class="mOptSizeGrid">'+sizeChips+'</div>'
    + '<div class="mOptLabel">Ткань</div><div class="mOptChips">'+fabChips+'</div>'
    + '<div class="mOptSummary">'+statusHtml+'</div>'
    + '</div>';
  box.style.display='';
  const pri=document.getElementById('mPri');
  if(pri && cur) pri.textContent=rub(cur.price);
  try{
    const _mb=document.getElementById('mStock');
    if(_mb){
      if(!stockLoaded){ _mb.style.display='none'; }
      else { _mb.className = inStock?'m-stock ok':'m-stock none'; _mb.textContent = inStock?('\u2713 В наличии — '+curQty+' шт.'):'Под заказ'; _mb.style.display='inline-flex'; }
    }
  }catch(_){}
  try{ renderMattressAttrs(it, cur, rec); }catch(_){}
}
function renderBedOptions(it){
  const box = document.getElementById('mBedOptions');
  const tools = document.getElementById('mBedOptionTools');
  if(!box) return;
  const rec = getBedOptions(it);
  if(!rec || !rec.showOptions || isFixedPlankBed(rec, it)){
    box.style.display='none'; box.innerHTML='';
    if(tools){ tools.style.display='none'; tools.innerHTML=''; }
    return;
  }
  renderBedOptionTools(it);
  box.style.display='flex';
  box.innerHTML = `
    <div class="bedOpt-h">
      <div>
        <div class="bedOpt-title">Итог комплектации</div>
      </div>
      <div class="bedOpt-hint">Цена зависит от выбранных опций.</div>
    </div>
    <div class="bedOpt-detail" id="bedOptDetail"></div>`;
  updateBedOptionSelection(it);
}
function getBedOptionMessageInfo(it){
  const rec = getBedOptions(it);
  if(!rec) return null;
  const variant = getBedSelectedVariant(it) || (rec.choices && rec.choices.base);
  if(!variant) return null;
  const label = bedOptionCustomerLabel(rec, variant);
  return {
    price: Number(variant.price || rec.basePrice || it.p || 0),
    lines: [
      '• Размер спального места: ' + (rec.sleepLabel || (rec.size ? (rec.size + '×200') : '—')),
      '• Комплектация: ' + label
    ].filter(Boolean)
  };
}
function refreshBedMiniOptionViews(){
  try{ if(window.__CUR_ITEM__) renderKitComposition(window.__CUR_ITEM__); }catch(_){ }
  try{ if(BUILDER && BUILDER.ownerId) renderBuilderGrid(); }catch(_){ }
  try{ renderCalcPanel(); }catch(_){ }
}
function renderMiniBedOptionChoice(rec, key, id, it){
  const v = rec && rec.choices ? rec.choices[key] : null;
  if(!v) return '';
  const avail = bedOptionAvailabilityHtml(getBedVariantAvailabilityShort(it, v));
  return `
    <label class="bedOpt-choice" data-choice="${esc(key)}">
      <input type="radio" name="bedMiniBaseOpt" value="${esc(key)}" onchange="miniBedSetBaseChoice('${esc(id)}','${esc(key)}')">
      <span>
        <div class="bedOpt-name">${esc(v.label || v.rawLabel || key)}</div>
        <div class="bedOpt-price">${bedOptionExtraText(rec, v.price)}</div>
        <div data-bed-mini-base-avail="${esc(key)}">${avail}</div>
        ${v.hint ? `<div class="bedOpt-note">${esc(v.hint)}</div>` : ''}
      </span>
    </label>`;
}
function closeMiniBedOptionPopup(){
  const host = document.getElementById('bedMiniPopupHost');
  if(host){ host.classList.remove('show'); host.innerHTML=''; }
  window.__BED_MINI_ITEM_ID__ = '';
}
function updateMiniBedOptionPopup(){
  const id = String(window.__BED_MINI_ITEM_ID__ || '');
  const it = findItemById(id);
  const host = document.getElementById('bedMiniPopupHost');
  const rec = getBedOptions(it);
  if(!host || !it || !rec) return;
  const st = getBedChoiceState(it);
  const selected = getBedSelectedVariant(it) || rec.choices.base;
  host.querySelectorAll('.bedOpt-choice').forEach(el=>el.classList.toggle('on', el.dataset.choice === st.baseKey));
  host.querySelectorAll('input[name="bedMiniBaseOpt"]').forEach(inp=>{ inp.checked = inp.value === st.baseKey; });
  host.querySelectorAll('[data-bed-mini-base-avail]').forEach(el=>{
    const key = el.getAttribute('data-bed-mini-base-avail');
    const v = rec && rec.choices ? rec.choices[key] : null;
    el.innerHTML = v ? bedOptionAvailabilityHtml(getBedVariantAvailabilityShort(it, v)) : '';
  });
  host.querySelectorAll('input[data-bed-mini-addon]').forEach(inp=>{ inp.checked = inp.dataset.bedMiniAddon === 'pm' ? !!st.pm : !!st.box; });
  const canAdd = canBedBaseHaveAddons(rec, st.baseKey);
  const addons = host.querySelector('#bedMiniOptAddons');
  if(addons) addons.style.display = canAdd ? 'flex' : 'none';
  const addonComps = findBedAddonComponents(rec, st.baseKey);
  const pmPriceEl = host.querySelector('#bedMiniAddonPmPrice');
  const boxPriceEl = host.querySelector('#bedMiniAddonBoxPrice');
  if(pmPriceEl) pmPriceEl.textContent = addonComps && addonComps.pm ? ('+' + rub(Number(addonComps.pm.price || 0))) : '';
  if(boxPriceEl) boxPriceEl.textContent = addonComps && addonComps.box ? ('+' + rub(Number(addonComps.box.price || 0))) : '';
  const pmAvailEl = host.querySelector('#bedMiniAddonPmAvail');
  const boxAvailEl = host.querySelector('#bedMiniAddonBoxAvail');
  if(pmAvailEl) pmAvailEl.innerHTML = addonComps && addonComps.pm ? bedOptionAvailabilityHtml(getBedComponentAvailabilityShort(it, addonComps.pm)) : '';
  if(boxAvailEl) boxAvailEl.innerHTML = addonComps && addonComps.box ? bedOptionAvailabilityHtml(getBedComponentAvailabilityShort(it, addonComps.box)) : '';
  const boxWrap = host.querySelector('[data-bed-mini-addon-wrap="box"]');
  const boxInp = host.querySelector('input[data-bed-mini-addon="box"]');
  if(boxInp){ boxInp.disabled = !st.pm; if(!st.pm) boxInp.checked = false; }
  if(boxWrap){ boxWrap.classList.toggle('off', !st.pm); boxWrap.title = st.pm ? '' : 'Сначала выберите подъёмный механизм'; }
  const total = host.querySelector('#bedMiniPopupTotal');
  if(total && selected) total.innerHTML = `Итог: <b>${rub(selected.price)}</b>`;
}
function openMiniBedOptionPopup(ev, id){
  if(ev){ ev.preventDefault(); ev.stopPropagation(); }
  const it = findItemById(id);
  const rec = getBedOptions(it);
  const host = document.getElementById('bedMiniPopupHost');
  if(!it || !rec || !host) return;
  const baseKeys = getBedAllowedBaseKeys(rec);
  const baseHtml = baseKeys.map(k=>renderMiniBedOptionChoice(rec, k, id, it)).join('');
  window.__BED_MINI_ITEM_ID__ = String(id || '');
  host.innerHTML = `
    <div class="bedOpt-pop-backdrop" onclick="closeMiniBedOptionPopup()"></div>
    <div class="bedOpt-pop">
      <div class="bedOpt-pop-h">
        <div>
          <div class="bedOpt-pop-title">Опции кровати</div>
          <div class="bedOpt-pop-hint">Выберите основание и дополнительные функции. Итоговая цена пересчитается.</div>
        </div>
        <button type="button" class="bedOpt-close" onclick="closeMiniBedOptionPopup()" aria-label="Закрыть">×</button>
      </div>
      <div class="bedOpt-sub">Основание</div>
      <div class="bedOpt-grid">${baseHtml}</div>
      <div class="bedOpt-addons" id="bedMiniOptAddons" style="display:none">
        <div class="bedOpt-sub">Дополнительные опции</div>
        <div class="bedOpt-checks">
          <label class="bedOpt-check" data-bed-mini-addon-wrap="pm"><input type="checkbox" data-bed-mini-addon="pm" onchange="miniBedSetAddon('${esc(id)}','pm',this.checked)"> <span>Подъёмный механизм <b id="bedMiniAddonPmPrice"></b><span id="bedMiniAddonPmAvail"></span></span></label>
          <label class="bedOpt-check" data-bed-mini-addon-wrap="box"><input type="checkbox" data-bed-mini-addon="box" onchange="miniBedSetAddon('${esc(id)}','box',this.checked)"> <span>Короб / дно для белья <b id="bedMiniAddonBoxPrice"></b><span id="bedMiniAddonBoxAvail"></span></span></label>
        </div>
        <div class="bedOpt-warn">Короб/дно можно добавить только при выбранном подъёмном механизме. Подъёмник можно выбрать и без дна.</div>
      </div>
      <div class="bedOpt-pop-actions"><div class="bedOpt-pop-total" id="bedMiniPopupTotal">Итог: —</div><button type="button" class="bedOpt-done" onclick="closeMiniBedOptionPopup()">Готово</button></div>
    </div>`;
  host.classList.add('show');
  updateMiniBedOptionPopup();
}
function miniBedSetBaseChoice(id, baseKey){
  const it = findItemById(id);
  const rec = getBedOptions(it);
  if(!rec) return;
  const allowed = getBedAllowedBaseKeys(rec);
  const st = getBedChoiceState(it);
  st.baseKey = allowed.includes(baseKey) ? baseKey : (allowed[0] || 'base');
  if(!canBedBaseHaveAddons(rec, st.baseKey)){
    st.pm = false;
    st.box = false;
  }
  saveBedChoiceState(id, st);
  updateMiniBedOptionPopup();
  refreshBedMiniOptionViews();
}
function miniBedSetAddon(id, addon, checked){
  const it = findItemById(id);
  const rec = getBedOptions(it);
  if(!rec || !rec.allowAddons) return;
  const st = getBedChoiceState(it);
  if(!canBedBaseHaveAddons(rec, st.baseKey)) return;
  if(addon === 'pm'){
    st.pm = !!checked;
    if(!st.pm) st.box = false;
  }else if(addon === 'box'){
    st.box = !!checked && !!st.pm;
  }
  saveBedChoiceState(id, st);
  updateMiniBedOptionPopup();
  refreshBedMiniOptionViews();
}

function openM(id, opts){
  const it=findItemById(id);if(!it)return;
  window.__BACK_TO_CART__=false; // флаг возврата в корзину ставится ПОСЛЕ этого вызова в favCartOpenItem
  opts = opts || {};
  if(document.getElementById('mOv').classList.contains('open')) saveBuilderSession();
  window.__CUR_ITEM__ = it;
  // V41: SEO — динамический Product JSON-LD + canonical URL для открытого товара.
  // Это даёт поисковикам структурированные данные о товаре в момент открытия модалки.
  try{ injectProductJsonLd(it); updateCanonicalForItem(it); }catch(_){}
  // Статистика: фиксируем открытие карточки
  try{ if(window.statsTrack) statsTrack('view_item', { id: it.id, t: it.t, c: it.c }); }catch(_){}
  hideCalcPanel();
  // Показываем/скрываем "Назад" в зависимости от стека
  const backBtn = document.getElementById('mBack');
  if(backBtn){ backBtn.style.display = NAV_STACK.length ? '' : 'none'; }
  // Если это кухня/гарнитур/прихожая — подтягиваем тяжёлые данные модулей в фоне.
  // Сразу открываем модалку с остальным контентом, а блоки "Состав комплекта"
  // и "Собрать из модулей" дорисовываем, как только данные пришли.
  const needsKitchen = itemNeedsKitchenData(it);

  const _ext=(it.img && /\.webp$/i.test(it.img))?'webp':'jpg';
  const base=it.img?it.img.replace(/\/\d+\.(?:jpe?g|png|webp)$/i,'/'):null;
  mPh=it.img?[it.img]:[];
  // Количество фото берём из pn (pre-computed), иначе пробуем до 14
  const maxN = it.pn || 14;
  if(base) for(let n=2;n<=maxN;n++) mPh.push(base+String(n).padStart(2,'0')+'.'+_ext);
  mPhI=0;
  document.getElementById('mCat').textContent=it.c||'';
  document.getElementById('mTit').textContent=it.t;
  // Бейдж наличия сразу под названием
  const tit=document.getElementById('mTit');
  let stockEl = document.getElementById('mStock');
  if(!stockEl){
    stockEl = document.createElement('div'); stockEl.id='mStock';
    tit.parentNode.insertBefore(stockEl, tit.nextSibling);
  }
  const stockState = getDisplayAvailability(it);
  if(stockState.loaded){
    stockEl.className = stockState.className === 'instock' ? 'm-stock ok' : 'm-stock none';
    stockEl.textContent = stockState.label;
    stockEl.style.display = 'inline-flex';
  } else { stockEl.style.display='none'; }
  document.getElementById('mPri').textContent=getItemInitialPriceText(it);
  const attrs = getUsefulAttrPairs(it, 14);
  document.getElementById('mAtt').innerHTML=attrs.map(([l,v])=>`<div class="mA"><div class="mA-l">${esc(l)}</div><div class="mA-v">${esc(String(v))}</div></div>`).join('');
  renderBedOptions(it);
  renderWardrobeAttic(it);
  renderWardrobeCoupeKit(it);
  renderTumbaSeatOption(it);
   try{ renderMattressOptions(it, opts); }catch(_){}

  // Кнопка Авито: ведёт на объявление товара
  const mAv=document.getElementById('mAv');
  const avUrl = it.avito || ('https://www.avito.ru/rossiya?q='+encodeURIComponent(it.id||''));
  mAv.href = avUrl;

  // Кнопка ВК. Логика выбора текста сообщения:
  //   1) Если открыт калькулятор и в нём есть товары — отправляем СПИСОК из калькулятора
  //      (комплект из конструктора кухни/стенки/прихожей и т.д.)
  //   2) Иначе — обычное сообщение по текущему товару
  //
  // Текст копируется СИНХРОННО в момент клика (важно для iOS).
  const cfg = window.SHOP_CONFIG || {};
  const mVk = document.getElementById('mVk');
  if(cfg.vkClubUrl || cfg.vkChatUrl){
    mVk.href = makeVkChatUrl(cfg.vkClubUrl);
    mVk.style.display = '';
    mVk.onclick = function(e){
      e.preventDefault();
      const vkUrl = makeVkChatUrl(cfg.vkClubUrl);
      let vkMsg, eventName, eventPayload;
      if(typeof isCalcActive === 'function' && isCalcActive()){
        // Калькулятор активен → шлём список выбранных модулей
        vkMsg = getCalcVkMessage();
        eventName = 'click_vk_calc';
        eventPayload = { items: Object.keys(BUILDER_CART||{}).length };
      } else {
        // Калькулятор пуст → обычное сообщение по карточке товара
        const cur = window.__CUR_ITEM__ || it;
        const curAv = cur.avito || ('https://www.avito.ru/rossiya?q=' + encodeURIComponent(cur.id||''));
        vkMsg = getProductVkMessage(cur, curAv);
        eventName = 'click_vk_product';
        eventPayload = { id: cur.id, t: cur.t };
      }
      try{ if(window.statsTrack) statsTrack(eventName, eventPayload); }catch(_){}
      const copied = copyTextSync(vkMsg);
      showVkPrepareDialog({ text: vkMsg, vkUrl: vkUrl, copied: copied });
    };
  } else {
    mVk.style.display = 'none';
  }

  // Кнопка "Скопировать ссылку на товар" — копирует прямую ссылку на наш сайт
  // (?item=ID), чтобы клиент мог поделиться товаром в любом мессенджере или
  // вернуться к нему позже.
  // ВАЖНО: для USER-FACING ссылки используем КИРИЛЛИЦУ "мебель-фаворит.рф"
  // вместо punycode "мебель-фаворит.рф" — пользователь увидит
  // и отправит другим красивую ссылку. Все мессенджеры (ВК, Telegram, WhatsApp)
  // её правильно распознают как кликабельную, и в адресной строке тоже
  // отобразят "мебель-фаворит.рф".
  const userFacingDomain = 'https://мебель-фаворит.рф/';
  const ourLink = it.id ? (userFacingDomain + '?item=' + encodeURIComponent(it.id)) : '';
  const mAvi = document.getElementById('mAvi');
  if(ourLink){
    mAvi.innerHTML = '<a href="#" id="mCopyLink">🔗 Скопировать ссылку на товар</a>';
    const linkEl = document.getElementById('mCopyLink');
    if(linkEl){
      linkEl.onclick = function(e){
        e.preventDefault();
        const ok = copyTextSync(ourLink);
        if(ok){
          const orig = linkEl.innerHTML;
          linkEl.innerHTML = '✅ Ссылка скопирована';
          setTimeout(()=>{ linkEl.innerHTML = orig; }, 2000);
        } else {
          showToast('Не удалось скопировать. Скопируйте ссылку вручную: ' + ourLink, 6000);
        }
      };
    }
  } else {
    mAvi.innerHTML = '';
  }

  // ===== Мультиобъявления, Состав комплекта и Модули серии =====
  renderMulti(it);
  if(needsKitchen){
    // Показываем плейсхолдеры, пока данные модулей грузятся
    const compBox = document.getElementById('mKitComp');
    const poolBox = document.getElementById('mKitPool');
    if(compBox) compBox.style.display='none';
    if(poolBox) poolBox.style.display='none';
    ensureKitchenData().then(()=>{
      // За время загрузки пользователь мог уже открыть другую карточку.
      // Рисуем состав/пул только если всё ещё открыт именно этот товар.
      if(window.__CUR_ITEM__ === it){
        renderKitComposition(it);
        renderKitPool(it);
      }
    }).catch(err=>{
      console.warn('[kitchen] не удалось загрузить данные модулей', err);
    });
  } else {
    // Для обычных товаров данные модулей не нужны — вызовы безопасны
    // (внутренний код проверяет наличие window.__KITCHEN_COMP__ и просто скрывает блок).
    renderKitComposition(it);
    renderKitPool(it);
  }

  setPhoto(0);buildThs();
  document.getElementById('mOv').classList.add('open');
  document.body.style.overflow='hidden';
  // Адрес: ?item=ID — карточкой можно поделиться, «Назад» вернёт в каталог
  if(!window.__ROUTING__){ favWriteUrl({item:it.id}, true); }
  if(typeof updateSeoProduct === 'function') updateSeoProduct(it);
  const restoreTop = Number(opts && opts.restoreScrollTop);
  const sc = getModalScrollEl();
  if(sc){
    if(Number.isFinite(restoreTop)){
      requestAnimationFrame(()=>{
        sc.scrollTop = restoreTop;
        setTimeout(()=>{ sc.scrollTop = restoreTop; }, 30);
      });
    }else{
      requestAnimationFrame(()=>{
        sc.scrollTop = 0;
        setTimeout(()=>{ sc.scrollTop = 0; }, 30);
      });
    }
  }
}

// Находим товар в CATALOG по avito_id / id
// Индекс id→item строится один раз и кэшируется. Это даёт O(1) на 1915 товарах
// вместо линейного перебора при каждом клике на карточку.
let __CATALOG_BY_ID__ = null;
function getCatalogIndex(){
  if(__CATALOG_BY_ID__) return __CATALOG_BY_ID__;
  const m = new Map();
  if(Array.isArray(window.CATALOG)){
    for(const it of CATALOG){ m.set(String(it.id), it); }
  }
  __CATALOG_BY_ID__ = m;
  return m;
}
function findItemById(id){
  if(!id) return null;
  return getCatalogIndex().get(String(id)) || null;
}

// =============================================================
// V41: SEO — динамические Product JSON-LD и canonical URL
// =============================================================
// При открытии модалки товара вставляем структурированные данные о товаре
// (https://schema.org/Product) — это помогает поисковикам показывать богатые
// сниппеты (фото, цена, наличие) в выдаче. При закрытии модалки удаляем.
const SITE_ORIGIN = (function(){
  try{ return location.origin && !location.origin.startsWith('file:') ? location.origin : 'https://мебель-фаворит.рф'; }
  catch(_){ return 'https://мебель-фаворит.рф'; }
})();
function getItemCanonicalUrl(it){
  if(!it || !it.id) return SITE_ORIGIN + '/';
  return SITE_ORIGIN + '/?item=' + encodeURIComponent(it.id);
}
function injectProductJsonLd(it){
  if(!it) return;
  removeProductJsonLd();
  const inStock = !!(it._inStock);
  const stockStatus = inStock ? 'InStock' : (typeof STOCK !== 'undefined' && STOCK && STOCK.loaded ? 'PreOrder' : 'InStock');
  const ld = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": it.t || 'Товар',
    "image": it.img || (SITE_ORIGIN + '/og-preview.jpg'),
    "description": it.t + (it.c ? ' (' + it.c + ')' : '') + (it.f ? ' — ' + it.f : ''),
    "brand": { "@type": "Brand", "name": it.f || 'Мебель Фаворит' },
    "category": it.c || '',
    "offers": {
      "@type": "Offer",
      "url": getItemCanonicalUrl(it),
      "priceCurrency": "RUB",
      "price": String(Number(it.p || 0)),
      "availability": "https://schema.org/" + stockStatus,
      "itemCondition": "https://schema.org/NewCondition",
      "seller": { "@type": "Organization", "name": "Мебель Фаворит" }
    }
  };
  if(it.art) ld.sku = String(it.art);
  const tag = document.createElement('script');
  tag.type = 'application/ld+json';
  tag.id = 'dynamicProductJsonLd';
  tag.textContent = JSON.stringify(ld);
  document.head.appendChild(tag);
}
function removeProductJsonLd(){
  const tag = document.getElementById('dynamicProductJsonLd');
  if(tag) tag.remove();
}
function updateCanonicalForItem(it){
  if(!it) return;
  const url = getItemCanonicalUrl(it);
  let link = document.querySelector('link[rel="canonical"]');
  if(!link){
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  if(!link.dataset.baseHref) link.dataset.baseHref = link.getAttribute('href') || (SITE_ORIGIN + '/');
  link.setAttribute('href', url);
}
function restoreBaseCanonical(){
  const link = document.querySelector('link[rel="canonical"]');
  if(link && link.dataset.baseHref) link.setAttribute('href', link.dataset.baseHref);
}
function getCompositeRows(it){
  if(!it) return [];
  const map = window.__KITCHEN_COMP__ || {};
  return map[String(it.id)] || [];
}

// Умная группировка состава комплекта: варианты с одинаковым order показываем одной карточкой
// Например: Кровать Вита 1200 / 1400 / 1600 -> одна карточка с выбором размера.
let KIT_COMP_CHOICE = {};
function kitCompChoiceKey(ownerId, groupKey){ return String(ownerId || '') + '|' + String(groupKey || ''); }
function getKitRowItem(row){ return row ? findItemById(row.module_avito_id || row.module_item_id) : null; }
function kitTitle(row, item){ return (item && item.t) || (row && (row.module_title || row.module_code || row.module_art)) || '—'; }
function kitNum(v){ const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^0-9.]/g,'')); return Number.isFinite(n) ? n : 0; }
function kitVariantSizeValue(row){
  const item = getKitRowItem(row);
  const a = (item && item.a) || {};
  const title = kitTitle(row, item);
  const sleep = kitNum(a['Ширина спального места']);
  if(sleep) return sleep;
  const w = kitNum(a['Ширина']);
  if(w) return w;
  const nums = String(title).match(/(?:^|\D)(\d{2,4})(?=\D|$)/g) || [];
  const cleaned = nums.map(x=>kitNum(x)).filter(Boolean);
  return cleaned.length ? cleaned[cleaned.length-1] : 0;
}
function kitVariantSortDesc(a,b){
  const ma = kitMirrorSortRank(a, [a,b]), mb = kitMirrorSortRank(b, [a,b]);
  if(ma !== mb) return ma - mb;
  const ea = kitFillingSortRank(a), eb = kitFillingSortRank(b);
  if(ea !== eb) return ea - eb;
  const sa = kitVariantSizeValue(a), sb = kitVariantSizeValue(b);
  if(sb !== sa) return sb - sa;
  const pa = kitRowPrice(a), pb = kitRowPrice(b);
  if(pb !== pa) return pb - pa;
  return (Number(b && b.required)||0) - (Number(a && a.required)||0);
}
function kitVariantLabel(row){
  const item = getKitRowItem(row);
  const a = (item && item.a) || {};
  const sleepW = kitNum(a['Ширина спального места']);
  const sleepL = kitNum(a['Длина спального места']);
  if(sleepW && sleepL) return String(sleepW) + '×' + String(sleepL);
  if(sleepW) return String(sleepW);
  const w = kitNum(a['Ширина']);
  if(w) return String(w);
  const title = kitTitle(row, item);
  const m = String(title).match(/(?:^|\D)(\d{2,4})(?=\D|$)/g);
  if(m && m.length) return String(kitNum(m[m.length-1]));
  if(/лев/i.test(title)) return 'Левый';
  if(/прав/i.test(title)) return 'Правый';
  return 'Вариант';
}
function kitRowStockQty(row){
  const item = getKitRowItem(row);
  if(!item) return 0;
  return Math.max(0, Number(item._stockQty) || 0);
}
function isKitRowEnough(row){
  const need = Math.max(1, Number(row && row.qty) || 1);
  return kitRowStockQty(row) >= need;
}
function chooseKitCompRow(rows, ownerId, groupKey){
  rows = (rows || []).filter(Boolean);
  if(!rows.length) return null;
  const saved = KIT_COMP_CHOICE[kitCompChoiceKey(ownerId, groupKey)];
  if(saved){
    const manual = rows.find(r => String((r.module_avito_id || r.module_item_id || '')) === String(saved));
    if(manual) return manual;
  }
  // V40_127: defaultPick — приоритетный выбор по умолчанию (например 90 для детских, 160 для взрослых)
  const defaultMarked = rows.find(r => r.defaultPick === true);
  if(defaultMarked) return defaultMarked;
  const sortedDesc = rows.slice().sort((a,b)=>{
    const ma = kitMirrorSortRank(a, rows), mb = kitMirrorSortRank(b, rows);
    if(ma !== mb) return ma - mb;
    const ea = kitFillingSortRank(a), eb = kitFillingSortRank(b);
    if(ea !== eb) return ea - eb;
    return kitVariantSortDesc(a,b);
  });
  const hasMirrorChoice = kitUniqueValues(rows, row => kitMirrorLabel(row, rows)).length > 1;
  if(hasMirrorChoice) return sortedDesc[0] || rows[0];
  if(typeof STOCK !== 'undefined' && STOCK && STOCK.loaded){
    const inStock = sortedDesc.filter(isKitRowEnough);
    if(inStock.length) return inStock[0];
  }
  return rows.find(r => !!r.required) || sortedDesc[0] || rows[0];
}
function buildKitCompGroups(comp, ownerId){
  const buckets = new Map();
  (comp || []).forEach((row, idx)=>{
    if(!row) return;
    const ord = (row.order !== undefined && row.order !== null && row.order !== '') ? String(row.order) : String(idx + 1);
    const key = ord;
    if(!buckets.has(key)) buckets.set(key, { key, order: Number(row.order) || idx + 1, rows: [] });
    buckets.get(key).rows.push(row);
  });
  return Array.from(buckets.values()).sort((a,b)=>a.order-b.order).map(g=>{
    g.active = chooseKitCompRow(g.rows, ownerId, g.key) || g.rows[0];
    return g;
  });
}
function getSmartKitCompositionRows(comp, ownerId){
  return buildKitCompGroups(comp, ownerId).map(g=>g.active).filter(Boolean);
}
function kitVariantText(row){
  const item = getKitRowItem(row);
  const a = (item && item.a) || {};
  return [kitTitle(row, item), a['Состав комплекта'], a['Тип столов'], a['Тип шкафов'], a['Тип модуля'], a['Исполнение'], a['Особенности'], a['Цвет от производителя']]
    .filter(Boolean).join(' ').toLowerCase().replace(/ё/g,'е');
}
function kitSideLabel(row){
  const txt = kitVariantText(row);
  // Кириллица плохо работает с \b в JS-регулярках, поэтому проверяем по простым корням.
  if(/лев|слева|левосторон/.test(txt)) return 'Левый';
  if(/прав|справа|правосторон/.test(txt)) return 'Правый';
  return '';
}
function kitMirrorLabel(row, rows){
  const txt = kitVariantText(row);
  const group = (rows || []).filter(Boolean);
  if(/без\s+зеркал/.test(txt) || /без\s+зеркал[аоыуеи]/.test(txt)) return 'Без зеркала';
  if(/с\s+зеркал/.test(txt) || /зеркальн/.test(txt)) return 'С зеркалом';
  if(group.length){
    const hasWithout = group.some(r => /без\s+зеркал/.test(kitVariantText(r)) || /без\s+зеркал[аоыуеи]/.test(kitVariantText(r)));
    const hasMirrorWord = group.some(r => /зеркал/.test(kitVariantText(r)) || /зеркальн/.test(kitVariantText(r)));
    if(hasWithout && group.length > 1){
      return 'С зеркалом';
    }
    if(hasMirrorWord) return 'С зеркалом';

    const item = getKitRowItem(row);
    const a = (item && item.a) || {};
    const model = String(a['Название модели'] || kitTitle(row, item) || '').toLowerCase().replace(/ё/g,'е');
    const wardrobeMirrorModels = /квадро|трио/.test(model);
    const groupModels = group.map(r=>{
      const gi = getKitRowItem(r);
      const ga = (gi && gi.a) || {};
      return String(ga['Название модели'] || kitTitle(r, gi) || '').toLowerCase().replace(/ё/g,'е');
    });
    const sameMirrorModel = wardrobeMirrorModels && groupModels.every(m => m === model || (model.includes('квадро') && m.includes('квадро')) || (model.includes('трио') && m.includes('трио')));
    if(sameMirrorModel && group.length === 2){
      const prices = group.map(r => kitRowPrice(r)).filter(Boolean);
      if(prices.length === 2 && prices[0] !== prices[1]){
        const maxPrice = Math.max(...prices);
        return kitRowPrice(row) === maxPrice ? 'С зеркалом' : 'Без зеркала';
      }
    }
  }
  if(/зеркал/.test(txt)) return 'С зеркалом';
  return '';
}
function kitRowPrice(row){
  const item = getKitRowItem(row);
  const p = (item && item.p) || (row && (row.matched_price || row.price)) || 0;
  const n = Number(p);
  return Number.isFinite(n) ? n : 0;
}
function kitMirrorSortRank(row, rows){
  const label = String(kitMirrorLabel(row, rows || []) || '').toLowerCase().replace(/ё/g,'е');
  if(label.includes('с зеркал') && !label.includes('без')) return 1;
  if(label.includes('без зеркал')) return 2;
  return 3;
}
function kitFillingLabel(row){
  const txt = kitVariantText(row);
  if(/с\s+полк/.test(txt) || /полками/.test(txt)) return 'С полками';
  if(/платян/.test(txt) || /со\s+штанг/.test(txt) || /штанг/.test(txt)) return 'Платяной';
  return '';
}
function kitFillingSortRank(row){
  const label = String(kitFillingLabel(row) || '').toLowerCase().replace(/ё/g,'е');
  if(label.includes('с полк')) return 1;
  if(label.includes('платян')) return 2;
  return 3;
}
function kitSleepLabel(row){
  const item = getKitRowItem(row);
  const a = (item && item.a) || {};
  const sleepW = kitNum(a['Ширина спального места']);
  const sleepL = kitNum(a['Длина спального места']);
  if(sleepW && sleepL) return String(sleepW) + '×' + String(sleepL);
  if(sleepW) return String(sleepW);
  return '';
}
function kitDimensionLabel(row){
  const item = getKitRowItem(row);
  const a = (item && item.a) || {};
  const w = kitNum(a['Ширина']);
  const h = kitNum(a['Высота']);
  const d = kitNum(a['Глубина']);
  if(w && h && d) return String(w) + '×' + String(h) + '×' + String(d);
  if(w) return String(w);
  return kitVariantLabel(row);
}
function kitUniqueValues(rows, getter){
  const seen = new Set();
  const vals = [];
  (rows || []).forEach(row=>{
    const v = String(getter(row) || '').trim();
    if(!v) return;
    const key = v.toLowerCase().replace(/ё/g,'е');
    if(seen.has(key)) return;
    seen.add(key);
    vals.push(v);
  });
  return vals;
}
function getKitVariantSelectMeta(rows){
  rows = (rows || []).filter(Boolean);
  const sleepVals = kitUniqueValues(rows, kitSleepLabel);
  if(sleepVals.length > 1){
    return {label:'Размер спального места', getLabel:kitSleepLabel, sort:(a,b)=>kitVariantSizeValue(a)-kitVariantSizeValue(b)};
  }
  const sideLabelFor = row => kitSideLabel(row);
  const sideVals = kitUniqueValues(rows, sideLabelFor);
  if(sideVals.length > 1){
    return {label:'Сторона', getLabel:sideLabelFor, sort:(a,b)=>{
      const order = v => String(v).toLowerCase().includes('лев') ? 1 : (String(v).toLowerCase().includes('прав') ? 2 : 3);
      return order(sideLabelFor(a)) - order(sideLabelFor(b));
    }};
  }
  const mirrorLabelFor = row => kitMirrorLabel(row, rows);
  const mirrorVals = kitUniqueValues(rows, mirrorLabelFor);
  const anyMirror = rows.some(row=>/зеркал/.test(kitVariantText(row)) || /зеркальн/.test(kitVariantText(row)));
  if((anyMirror || mirrorVals.length > 1) && mirrorVals.length > 1){
    return {label:'Зеркало', getLabel:mirrorLabelFor, sort:(a,b)=>{
      const order = v => String(v).toLowerCase().replace(/ё/g,'е').includes('без') ? 2 : 1;
      return order(mirrorLabelFor(a)) - order(mirrorLabelFor(b));
    }};
  }
  const fillingLabelFor = row => kitFillingLabel(row);
  const fillingVals = kitUniqueValues(rows, fillingLabelFor);
  if(fillingVals.length > 1){
    return {label:'Наполнение', getLabel:fillingLabelFor, sort:(a,b)=>{
      const order = v => String(v).toLowerCase().replace(/ё/g,'е').includes('полк') ? 1 : 2;
      return order(fillingLabelFor(a)) - order(fillingLabelFor(b));
    }};
  }
  const dimVals = kitUniqueValues(rows, kitDimensionLabel);
  if(dimVals.length > 1){
    return {label:'Размер', getLabel:kitDimensionLabel, sort:(a,b)=>kitVariantSizeValue(a)-kitVariantSizeValue(b)};
  }
  return {label:'Вариант', getLabel:(row)=>kitTitle(row, getKitRowItem(row)), sort:(a,b)=>String(kitTitle(a, getKitRowItem(a))).localeCompare(String(kitTitle(b, getKitRowItem(b))),'ru')};
}
function makeUniqueKitOptionLabels(rows, meta){
  const counts = new Map();
  rows.forEach(row=>{
    const base = String(meta.getLabel(row) || kitVariantLabel(row) || 'Вариант').trim();
    const key = base.toLowerCase().replace(/ё/g,'е');
    counts.set(key, (counts.get(key)||0)+1);
  });
  return rows.map(row=>{
    let label = String(meta.getLabel(row) || kitVariantLabel(row) || 'Вариант').trim();
    const key = label.toLowerCase().replace(/ё/g,'е');
    if((counts.get(key)||0) > 1){
      const item = getKitRowItem(row);
      const color = item && ((item.a && (item.a['Цвет от производителя'] || item.a['Цвет производителя'] || item.a['Цвет'] || item.a['Основной цвет'])) || item.col);
      const title = kitTitle(row, item);
      label += color ? (' · ' + color) : (' · ' + title);
    }
    return label;
  });
}

function kitRowId(row){
  return String(row && (row.module_avito_id || row.module_item_id || '') || '');
}
function getKitGroupRow(ownerId, groupKey, itemId){
  const comp = getCompositeRows(findItemById(ownerId)) || [];
  const targetOrder = String(groupKey || '');
  const targetId = String(itemId || '');
  return comp.find(r => String((r.order !== undefined && r.order !== null && r.order !== '') ? r.order : '') === targetOrder && kitRowId(r) === targetId)
      || comp.find(r => kitRowId(r) === targetId)
      || null;
}
function getKitRowDomPayload(row){
  const modItem = getKitRowItem(row);
  const title = (modItem && modItem.t) || (row && (row.module_title || row.module_code)) || '—';
  const price = modItem ? getBedCardDisplayPrice(modItem, row && row.matched_price) : Number((row && row.matched_price) || 0);
  const photo = (modItem && modItem.img) || (row && row.matched_photo) || '';
  const qty = Number(row && row.qty) || 1;
  const meta = [
    (row && row.module_factory) || (modItem && modItem.f),
    modItem && modItem.art ? modItem.art : ((row && row.module_art) || ''),
  ].filter(Boolean).join(' · ');
  return {
    id: kitRowId(row),
    title,
    price,
    priceTxt: price ? (Number(price).toLocaleString('ru-RU')+' ₽') : '—',
    photo,
    qty,
    meta
  };
}
function syncKitVariantCard(ownerId, groupKey, itemId){
  const row = getKitGroupRow(ownerId, groupKey, itemId);
  if(!row) return;
  const payload = getKitRowDomPayload(row);
  const cards = Array.from(document.querySelectorAll('.kitCard[data-kit-owner]'));
  const card = cards.find(el => String(el.getAttribute('data-kit-owner')||'') === String(ownerId||'') && String(el.getAttribute('data-kit-group')||'') === String(groupKey||''));
  if(!card) return;
  card.setAttribute('data-kit-item', payload.id || '');
  const titleEl = card.querySelector('.kitCard-title');
  if(titleEl) titleEl.textContent = payload.title;
  const metaEl = card.querySelector('.kitCard-meta');
  if(metaEl){
    if(payload.meta){ metaEl.textContent = payload.meta; metaEl.style.display = ''; }
    else { metaEl.textContent = ''; metaEl.style.display = 'none'; }
  }
  const priceEl = card.querySelector('.kitCard-price');
  if(priceEl) priceEl.textContent = payload.priceTxt;
  const qtyEl = card.querySelector('.kitCard-qty');
  if(qtyEl) qtyEl.textContent = '×' + payload.qty;
  const img = card.querySelector('.kitCard-ph img');
  const ph = card.querySelector('.kitCard-ph');
  if(payload.photo){
    if(img){
      try{ img.src = imgU(payload.photo, 400); }catch(_){ img.src = payload.photo; }
      img.dataset.orig = payload.photo;
      img.alt = payload.title || '';
    }else if(ph){
      ph.insertAdjacentHTML('afterbegin', `<img ${imgAttrs(payload.photo, 400)} alt="${esc(payload.title||'')}">`);
      const no = ph.querySelector('.noph'); if(no) no.remove();
    }
  }
  const sel = card.querySelector('select');
  if(sel) sel.value = String(itemId || payload.id || '');
  card.onclick = function(e){
    if(e && e.target && e.target.closest && e.target.closest('.kitVariantSelect,.kitCard-bedopt')) return;
    if(payload.id) navOpen(payload.id);
  };
}
function renderKitVariantTabs(ownerId, groupKey, rows, activeRow){
  rows = (rows || []).filter(Boolean);
  if(rows.length <= 1) return '';
  const meta = getKitVariantSelectMeta(rows);
  const sorted = rows.slice().sort(meta.sort || kitVariantSortDesc);
  const activeId = String(activeRow && (activeRow.module_avito_id || activeRow.module_item_id || ''));
  const activeItem = getKitRowItem(activeRow);
  const labels = makeUniqueKitOptionLabels(sorted, meta);
  const opts = sorted.map((row, idx)=>{
    const payload = getKitRowDomPayload(row);
    const id = payload.id;
    const selected = id === activeId ? ' selected' : '';
    const stockMark = (typeof STOCK !== 'undefined' && STOCK && STOCK.loaded) ? (isKitRowEnough(row) ? ' ✓' : '') : '';
    return '<option value="' + esc(id) + '"' + selected +
      ' data-title="' + esc(payload.title) + '"' +
      ' data-meta="' + esc(payload.meta) + '"' +
      ' data-price="' + esc(payload.priceTxt) + '"' +
      ' data-photo="' + esc(payload.photo) + '"' +
      '>' + esc(labels[idx] + stockMark) + '</option>';
  }).join('');
  const bedId = String(activeItem && activeItem.id || '');
  const bedBtn = (activeItem && shouldShowBedOptions(activeItem))
    ? `<button type="button" class="kitCard-bedopt" onclick="event.stopPropagation(); openMiniBedOptionPopup(event,'${esc(bedId)}'); return false;">Опции</button>`
    : '';
  const seatBtn = (activeItem && shouldShowSeatOption(activeItem))
    ? `<button type="button" class="kitCard-bedopt" onclick="event.stopPropagation(); openMiniSeatOptionPopup(event,'${esc(bedId)}'); return false;">Опции</button>`
    : '';
  return `<div class="kitVariantSelect" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()" onpointerdown="event.stopPropagation()" ontouchstart="event.stopPropagation()">
    <div class="kitVariantSelect-top"><div class="kitVariantSelect-label">${esc(meta.label || 'Вариант')}</div></div>
    <div class="kitVariantSelect-row">
      <select class="kitVariantSelectInput" data-kit-owner="${esc(ownerId)}" data-kit-group="${esc(groupKey)}" onclick="event.stopPropagation()" onmousedown="event.stopPropagation()" onpointerdown="event.stopPropagation()" ontouchstart="event.stopPropagation()">${opts}</select>
      ${bedBtn}${seatBtn}
    </div>
  </div>`;
}
function selectKitCompVariant(ownerId, groupKey, itemId, ev){
  if(ev){ ev.preventDefault(); ev.stopPropagation(); }
  const key = kitCompChoiceKey(ownerId, groupKey);
  KIT_COMP_CHOICE[key] = String(itemId || '');
  const cur = (window.__CUR_ITEM__ && String(window.__CUR_ITEM__.id) === String(ownerId)) ? window.__CUR_ITEM__ : findItemById(ownerId);
  if(cur){
    // Полный перерендер — внутри chooseKitCompRow подтянет сохранённый выбор и
    // карточка пересоберётся с правильным ID / артикулом / фото / ценой / атрибутами.
    renderKitComposition(cur);
    // Обновляем индикатор наличия (он зависит от выбранных вариантов)
    const stockEl = document.getElementById('mStock');
    const stockState = getDisplayAvailability(cur);
    if(stockEl && stockState){
      if(stockState.loaded){
        stockEl.className = stockState.className === 'instock' ? 'm-stock ok' : 'm-stock none';
        stockEl.textContent = stockState.label;
        stockEl.style.display = 'inline-flex';
      } else {
        stockEl.style.display = 'none';
      }
    }
  } else {
    // Owner-карточка не открыта — выполним точечную синхронизацию DOM по data-атрибутам.
    syncKitVariantCard(ownerId, groupKey, itemId);
  }
}
window.selectKitCompVariant = selectKitCompVariant;
function getCompositeAvailability(it){
  const comp = getCompositeRows(it);
  if(!comp.length) return null;
  if(!STOCK.loaded){
    return {loaded:false, available:false, qty:null, className:'nodata', label:'Остатки не загружены', badgeLabel:'', fromComposition:true};
  }
  const smartRows = getSmartKitCompositionRows(comp, it && it.id);
  // Наличие комплекта = наличие ВСЕХ модулей. Остаток модуля считаем так же,
  // как в составе комплекта (getKitCompRowStockQty): по связанному товару, либо
  // по component_arts / module_art. Готовые кухни (напр. Хозяюшка) идут по
  // component_arts без прямого item_id — иначе ложно показывали «под заказ».
  let totalRequired = 0;
  let inStockUnits = 0;
  let minKits = null;
  let anyRow = false;
  for(const row of smartRows){
    if(!row) continue;
    anyRow = true;
    const need = Math.max(1, Number(row.qty) || 1);
    totalRequired += need;
    const modItem = findItemById(row.module_avito_id || row.module_item_id);
    const stockQty = Math.max(0, Number(getKitCompRowStockQty(row, modItem)) || 0);
    inStockUnits += Math.min(need, stockQty);
    const kits = Math.floor(stockQty / need);
    minKits = minKits === null ? kits : Math.min(minKits, kits);
  }
  if(!anyRow || !totalRequired) return null;
  const available = inStockUnits === totalRequired;
  const qty = available ? Math.max(0, minKits || 0) : 0;
  return {
    loaded:true,
    available,
    qty,
    className: available ? 'instock' : 'preorder',
    label: available ? ('✓ В наличии — ' + qty + ' компл.') : 'Под заказ',
    badgeLabel: available ? 'В наличии' : '',
    fromComposition:true
  };
}
function getDisplayAvailability(it){
  const compState = getCompositeAvailability(it);
  if(compState) return compState;
  if(isAlwaysInStockItem(it)){
    const qty = Math.max(1, Number(it && it._stockQty) || 1);
    return {
      loaded:true,
      available:true,
      qty,
      className:'instock',
      label:'✓ В наличии' + (qty ? (' — ' + qty + ' шт.') : ''),
      badgeLabel:'В наличии',
      fromComposition:false,
      forced:true
    };
  }
  if(!STOCK.loaded){
    return {loaded:false, available:false, qty:null, className:'nodata', label:'Остатки не загружены', badgeLabel:'', fromComposition:false};
  }
  const qty = Math.max(0, Number(it && it._stockQty) || 0);
  const available = !!(it && it._inStock);
  return {
    loaded:true,
    available,
    qty,
    className: available ? 'instock' : 'preorder',
    label: available ? ('✓ В наличии' + (qty ? (' — ' + qty + ' шт.') : '')) : 'Под заказ',
    badgeLabel: available ? 'В наличии' : '',
    fromComposition:false
  };
}

// ===== МУЛЬТИОБЪЯВЛЕНИЯ =====
// Собирает группу товаров-вариантов текущего товара.
// Правило группировки: совпадает поле .mu (multi, например "Велес-альте")
// ПЛЮС совпадает один из атрибутов-дискриминаторов, чтобы антресоли не попали к шкафам.
const MULTI_DISCRIM_KEYS = [
  'Тип шкафов','Подвид товара','Тип кроватей','Тип диванов','Тип столов',
  'Тип тумб','Тип комодов','Тип модуля'
];
function variantStableOrder(it){
  const n = Number(it && it.ord);
  if(Number.isFinite(n) && n > 0) return n;
  return Number.MAX_SAFE_INTEGER;
}
function variantStableCompare(a,b){
  const oa = variantStableOrder(a), ob = variantStableOrder(b);
  if(oa !== ob) return oa - ob;
  const wa = Number(a && a.w) || 0, wb = Number(b && b.w) || 0;
  if(wa !== wb) return wa - wb;
  const ha = Number(a && a.h) || 0, hb = Number(b && b.h) || 0;
  if(ha !== hb) return ha - hb;
  const da = Number(a && a.d) || 0, db = Number(b && b.d) || 0;
  if(da !== db) return da - db;
  const ta = String(a && a.t || ''), tb = String(b && b.t || '');
  const td = ta.localeCompare(tb,'ru');
  if(td) return td;
  return String(a && a.id || '').localeCompare(String(b && b.id || ''),'ru');
}
function getMultiFamily(it){
  if(!it) return '';
  // Для мультиобъявлений важно не смешивать похожие названия из разных разделов.
  // Пример: «Тумбы под телевизор» и обычные «Тумбы/обувницы» обе содержат слово «тумба»,
  // но варианты должны собираться строго внутри своего листа/категории.
  const sheet = String(it.sheet || it.c || '').trim();
  const cat = String(it.c || it.sheet || '').trim();
  return sheet || cat || '';
}
function isWardrobeForMulti(it){
  const a = (it && it.a) || {};
  const blob = [
    it && it.t,
    it && it.c,
    it && it.sheet,
    a['Тип шкафов'],
    a['Тип дверей'],
    a['Подвид товара'],
    a['Вид товара']
  ].filter(Boolean).join(' ').toLowerCase().replace(/ё/g,'е');
  return blob.includes('шкаф');
}
function getDiscrim(it){
  if(!it || !it.a) return getMultiFamily(it);
  let value = '';
  for(const k of MULTI_DISCRIM_KEYS){
    if(it.a[k]){ value = String(it.a[k]).trim(); break; }
  }
  // Семья + дискриминатор. Это защищает от смешивания ТВ-тумб с тумбами/обувницами,
  // комодов с прикроватными тумбами и других похожих модулей одной серии.
  // Для шкафов добавляем тип дверей: купе не должны попадать в один список с распашными.
  const base = getMultiFamily(it) + '|' + (value || String(it.c || '').trim());
  if(isWardrobeForMulti(it)){
    const doorType = String(it.a['Тип дверей'] || '').trim();
    return base + '|двери:' + (doorType || '');
  }
  return base;
}

function findMultiVariants(it){
  if(!it || !it.mu) return [];
  const mu = String(it.mu).toLowerCase();
  const disc = getDiscrim(it);
  const variants = CATALOG.filter(x =>
    x.id !== it.id &&
    String(x.mu || '').toLowerCase() === mu &&
    getDiscrim(x) === disc
  );
  variants.sort(variantStableCompare);
  return variants;
}

function renderMulti(it){
  const box   = document.getElementById('mMulti');
  const secW  = document.getElementById('mMultiSizes');
  const hW    = secW ? secW.querySelector('.mMulti-h') : null;
  const wSel  = document.getElementById('mMultiWidthSel');
  const extraSel = document.getElementById('mMultiExtraSel');
  const moreBtn = document.getElementById('mMultiMoreBtn');
  const secC  = document.getElementById('mMultiColors');
  const listC = document.getElementById('mMultiColorsList');
  const colorTabs = document.getElementById('mMultiColorTabs');
  const hC    = document.getElementById('mMultiColorsH');
  if(!box || !secW || !wSel || !extraSel || !secC || !listC || !hC || !colorTabs) return;

  const variants = findMultiVariants(it);
  const all = [it, ...variants].sort(variantStableCompare);
  const isKitchen = String((it && it.sheet) || '') === 'Кухни' || String((((it||{}).a||{})['Тип товара'] || '').toLowerCase()).includes('кух');

  function attr(v, key){
    return v && v.a && v.a[key] != null ? String(v.a[key]).trim() : '';
  }
  function normTokenLocal(v){
    return String(v == null ? '' : v).toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();
  }
  function colorKey(v){
    if(!v) return '';
    return isKitchen
      ? (attr(v, 'Цвет от производителя') || v.col || attr(v, 'Основной цвет') || attr(v, 'Цвет') || '')
      : (v.col || attr(v, 'Цвет от производителя') || attr(v, 'Основной цвет') || attr(v, 'Цвет') || '');
  }
  function dimsFor(v){
    return [v && v.w, v && v.h, v && v.d].filter(x=>x!=null && x!=='').join('×');
  }
  function sleepingPlaceLabel(v){
    const explicit = attr(v, 'Размер спального места') || attr(v, 'Размер матраса');
    if(explicit){
      const cleaned = String(explicit).replace(/[xх*]/gi, '×').replace(/\s+/g,'').trim();
      if(/\d+×\d+/i.test(cleaned)) return cleaned;
      const widthOnly = cleaned.match(/(\d{2,3})/);
      const len = attr(v, 'Длина спального места') || attr(v, 'Длина матраса');
      if(widthOnly && len) return `${widthOnly[1]}×${String(len).trim()}`;
      return cleaned;
    }
    const sw = attr(v, 'Ширина спального места');
    const sl = attr(v, 'Длина спального места');
    if(sw && sl) return `${String(sw).trim()}×${String(sl).trim()}`;
    return '';
  }
  function sizeFullLabel(bucket, refItem){
    const primary = String((bucket && bucket.label) || 'Размер');
    if(isKitchen){
      const parts = [primary, refItem && refItem.h, refItem && refItem.d].filter(x=>x!=null && x!=='').map(x=>String(x).trim()).filter(Boolean);
      return parts.length ? parts.join('×') : primary;
    }
    const sleep = sleepingPlaceLabel(refItem);
    if(sleep) return sleep;
    const full = dimsFor(refItem);
    return full || primary;
  }
  function syncMultiSizeSelectDisplay(select, expanded){
    if(!select || select.dataset.kind !== 'size') return;
    Array.from(select.options || []).forEach(opt=>{
      const shortLabel = opt.getAttribute('data-short') || opt.textContent || '';
      const fullLabel = opt.getAttribute('data-full') || shortLabel;
      opt.textContent = expanded ? fullLabel : shortLabel;
    });
  }
  function bindMultiSizeSelect(select){
    if(!select || select.dataset.kind !== 'size' || select.dataset.bound === '1') return;
    select.dataset.bound = '1';
    syncMultiSizeSelectDisplay(select, false);
    select.addEventListener('focus', ()=>syncMultiSizeSelectDisplay(select, true));
    select.addEventListener('mousedown', ()=>syncMultiSizeSelectDisplay(select, true));
    select.addEventListener('blur', ()=>syncMultiSizeSelectDisplay(select, false));
    select.addEventListener('change', ()=>setTimeout(()=>syncMultiSizeSelectDisplay(select, false), 0));
    select.addEventListener('keydown', (e)=>{
      if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)) syncMultiSizeSelectDisplay(select, true);
      if(e.key === 'Escape') setTimeout(()=>syncMultiSizeSelectDisplay(select, false), 0);
    });
  }
  function titleNominalSize(v){
    const title = String((v && v.t) || '');
    const m = title.match(/(\d{3,4})\s*см/i);
    if(m) return String(Number(m[1]));
    const w = Number(v && v.w);
    if(Number.isFinite(w) && w > 0) return String(Math.round(w));
    return '';
  }
  function kitchenGlassState(v){
    const explicit = attr(v, 'Стекло / исполнение') || attr(v, 'Наличие стекла') || attr(v, 'Исполнение');
    if(explicit) return explicit;
    const source = [attr(v, 'Материал фасада'), attr(v, 'Цвет от производителя'), v && v.t].filter(Boolean).join(' ').toLowerCase();
    return source.includes('стекл') ? 'Со стеклом' : 'Без стекла';
  }
  function kitchenExecMeta(v, bucketItems){
    const items = Array.isArray(bucketItems) && bucketItems.length ? bucketItems : [v].filter(Boolean);
    const uniq = arr => Array.from(new Set(arr.map(x=>String(x||'').trim()).filter(Boolean)));
    const formValues = uniq(items.map(x=>attr(x, 'Форма кухни')));
    const glassValues = uniq(items.map(x=>kitchenGlassState(x)));
    if(formValues.length > 1){
      return {label:'Форма кухни', value: attr(v, 'Форма кухни') || '—'};
    }
    if(glassValues.length > 1){
      return {label:'Наличие стекла', value:kitchenGlassState(v)};
    }
    return {label:'', value:'', kind:'none'};
  }
  function isWardrobeVariant(v){
    const blob = [
      v && v.t,
      v && v.c,
      v && v.sheet,
      attr(v, 'Тип шкафов'),
      attr(v, 'Подвид товара'),
      attr(v, 'Вид товара')
    ].filter(Boolean).join(' ').toLowerCase().replace(/ё/g,'е');
    // Для шкафов размер должен различаться полностью: ширина × высота × глубина.
    // Иначе шкаф 120×200×55 и 120×220×55 попадает в один цвет, что визуально вводит в заблуждение.
    return blob.includes('шкаф');
  }
  function fullDimensionLabel(v){
    const parts = [
      (v && v.w) || attr(v, 'Ширина'),
      (v && v.h) || attr(v, 'Высота'),
      (v && v.d) || attr(v, 'Глубина')
    ].filter(x=>x!=null && x!=='').map(x=>String(x).trim()).filter(Boolean);
    return parts.length >= 2 ? parts.join('×') : '';
  }
  function variantSizeKey(v){
    if(isKitchen){
      const nominal = titleNominalSize(v);
      if(nominal) return `k:${nominal}`;
    }
    const sleep = sleepingPlaceLabel(v);
    if(sleep) return `sp:${normTokenLocal(sleep)}`;
    const fullWardrobe = isWardrobeVariant(v) ? fullDimensionLabel(v) : '';
    if(fullWardrobe) return `d:${normTokenLocal(fullWardrobe)}`;
    const explicitSize = attr(v, 'Размер');
    if(explicitSize) return `s:${normTokenLocal(explicitSize)}`;
    const w = Number(v && v.w);
    if(Number.isFinite(w) && w > 0) return `w:${w}`;
    const full = dimsFor(v);
    if(full) return `d:${full}`;
    return 'single';
  }
  function variantSizeLabel(v){
    if(isKitchen){
      return titleNominalSize(v) || (v && v.w ? String(v.w) : 'Размер');
    }
    const sleep = sleepingPlaceLabel(v);
    if(sleep) return sleep;
    const fullWardrobe = isWardrobeVariant(v) ? fullDimensionLabel(v) : '';
    if(fullWardrobe) return fullWardrobe;
    const explicitSize = attr(v, 'Размер');
    if(explicitSize) return explicitSize;
    const w = Number(v && v.w);
    if(Number.isFinite(w) && w > 0) return String(w);
    return 'Размер';
  }
  function sortSizeKey(key){
    const m = String(key || '').match(/(\d+(?:\.\d+)?)/);
    return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
  }

  const sizeBuckets = new Map();
  all.forEach(v=>{
    const key = variantSizeKey(v);
    if(!sizeBuckets.has(key)) sizeBuckets.set(key, { key, label: variantSizeLabel(v), items: [] });
    sizeBuckets.get(key).items.push(v);
  });
  const sizes = Array.from(sizeBuckets.values()).sort((a,b)=>{
    const av = sortSizeKey(a.key), bv = sortSizeKey(b.key);
    if(av !== bv) return av - bv;
    return String(a.label || '').localeCompare(String(b.label || ''), 'ru');
  });

  let curSizeKey = variantSizeKey(it);
  let curExec = isKitchen ? kitchenExecMeta(it, [it]).value : '';
  let curColor = colorKey(it) || '';
  let curMirror = '';
  let curFilling = '';
  let curDrawers = '';

  function getCurrentBucket(){
    return sizeBuckets.get(curSizeKey) || sizes[0] || { key:'', label:'Размер', items:[it] };
  }
  function getExecOptions(bucket){
    if(!isKitchen || !bucket) return [];
    const seen = new Set();
    return bucket.items.map(v=>kitchenExecMeta(v, bucket.items).value).filter(val=>{
      const key = String(val || '').trim();
      if(!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function chooseTarget(items, preferredColor){
    if(!items || !items.length) return null;
    const current = items.find(v => String(v.id) === String(it.id));
    if(current) return current;
    const sameColor = preferredColor ? items.find(v => colorKey(v) === preferredColor) : null;
    return sameColor || items[0];
  }
  function currentFilteredItems(){
    const bucket = getCurrentBucket();
    let items = bucket.items.slice();
    if(isKitchen && curExec){
      const execFiltered = items.filter(v => kitchenExecMeta(v, bucket.items).value === curExec);
      if(execFiltered.length) items = execFiltered;
    }
    return items;
  }
  function renderExecSelect(){
    const bucket = getCurrentBucket();
    const execOptions = getExecOptions(bucket);
    const execMeta = bucket && bucket.items && bucket.items.length ? kitchenExecMeta(bucket.items[0], bucket.items) : {label:'Исполнение'};
    if(!isKitchen || execOptions.length < 2){
      extraSel.style.display = 'none';
      extraSel.innerHTML = '<option value="">Исполнение</option>';
      return;
    }
    if(!execOptions.includes(curExec)) curExec = execOptions[0];
    extraSel.setAttribute('aria-label', execMeta.label || 'Исполнение');
    extraSel.innerHTML = execOptions.map(val=>`<option value="${esc(val)}" ${String(val)===String(curExec)?'selected':''}>${esc(val)}</option>`).join('');
    extraSel.style.display = '';
  }
  function renderColors(){
    const bucket = getCurrentBucket();
    const visibleItems = currentFilteredItems();
    const options = visibleItems.slice();

    function optionExtra(v){
      const comp = attr(v, 'Состав комплекта');
      if(comp) return comp;
      return String(v && v.t || '').trim();
    }
    function colorLabel(v){
      return colorKey(v) || 'Без цвета';
    }
    function producerColorLabel(v){
      return attr(v, 'Цвет от производителя')
        || attr(v, 'Цвет производителя')
        || attr(v, 'Цвет')
        || v && v.col
        || attr(v, 'Основной цвет')
        || colorLabel(v)
        || 'Без цвета';
    }
    function variantStockHtml(v){
      const st = (typeof getCatalogAvailability === 'function') ? getCatalogAvailability(v) : getDisplayAvailability(v);
      if(!st || !st.loaded) return '';
      const txt = st.available ? 'В наличии' : 'Под заказ';
      return `<div class="mMulti-color-stock ${st.available ? 'ok' : 'none'}">${esc(txt)}</div>`;
    }
    function colorNorm(v){
      return normTokenLocal(colorLabel(v));
    }
    function isMirrorWardrobeVariant(v){
      const blob = [
        v && v.t,
        v && v.c,
        v && v.sheet,
        attr(v, 'Название модели'),
        attr(v, 'Тип шкафов'),
        attr(v, 'Тип дверей'),
        attr(v, 'Исполнение'),
        attr(v, 'Особенности'),
        v && v.f,
        v && v.mu
      ].filter(Boolean).join(' ').toLowerCase().replace(/ё/g,'е');
      // Не только Ларс: Квадро, Трио и другие шкафы с парой «с зеркалом / без зеркала»
      // должны переключаться по исполнению, а не по цвету.
      return blob.includes('шкаф');
    }
    function hasWithoutMirrorMark(v){
      const txt = [
        v && v.t,
        attr(v, 'Зеркало'),
        attr(v, 'Цвет от производителя'),
        attr(v, 'Особенности'),
        attr(v, 'Исполнение'),
        attr(v, 'Тип шкафов')
      ].filter(Boolean).join(' ').toLowerCase().replace(/ё/g,'е');
      return /без\s+зеркал/.test(txt) || /без\s+зеркал[аоыуеи]/.test(txt);
    }
    function mirrorPairKey(v){
      const raw = String(attr(v, 'Цвет от производителя') || colorLabel(v) || '')
        .toLowerCase()
        .replace(/ё/g,'е')
        .replace(/без\s+зеркал[аоыуеи]*/g,'')
        .replace(/с\s+зеркал[аоыуеи]*/g,'')
        .replace(/зеркальн\S*/g,'')
        .replace(/гладк\S*/g,'')
        .replace(/[\-–—]+/g,' ')
        .replace(/[\/|]+/g,' ')
        .replace(/\s+/g,' ')
        .trim();
      return normTokenLocal(raw || colorLabel(v));
    }
    function chooseMirrorTarget(items, currentItem){
      const pair = mirrorPairKey(currentItem);
      return (items || []).find(v => mirrorPairKey(v) === pair)
        || chooseTarget(items, colorKey(currentItem))
        || ((items || [])[0] || null);
    }
    function mirrorLabel(v, bucketItems){
      if(!isMirrorWardrobeVariant(v)) return '';
      const base = mirrorPairKey(v);
      const sameFinish = (bucketItems || options || []).filter(x => mirrorPairKey(x) === base);
      const hasWithout = sameFinish.some(hasWithoutMirrorMark);
      const hasWith = sameFinish.some(x => !hasWithoutMirrorMark(x));
      // У Ларса в одном и том же размере/отделке есть две цены:
      // более дорогой вариант — с зеркалом, вариант с пометкой «без зеркала» — без зеркала.
      // Если пары в этой отделке нет, отдельную плашку «Зеркало» не показываем.
      if(!hasWithout || !hasWith) return '';
      return hasWithoutMirrorMark(v) ? 'Без зеркала' : 'С зеркалом';
    }
    function mirrorOrder(label){
      const s = String(label || '').toLowerCase().replace(/ё/g,'е');
      if(s.includes('с зеркал') && !s.includes('без')) return 1;
      if(s.includes('без зеркал')) return 2;
      return 3;
    }
    function fillingLabel(v){
      // Для шкафов типа Дуэт/Адель важнее не цвет, а внутреннее наполнение:
      // «с полками» или «платяной». Цвет показываем уже внутри выбранного наполнения.
      const txt = [
        v && v.t,
        attr(v, 'Название модели'),
        attr(v, 'Исполнение'),
        attr(v, 'Особенности'),
        attr(v, 'Тип шкафов'),
        attr(v, 'Цвет от производителя')
      ].filter(Boolean).join(' ').toLowerCase().replace(/ё/g,'е');
      if(/с\s+полк/.test(txt) || /полками/.test(txt)) return 'С полками';
      if(/платян/.test(txt) || /со\s+штанг/.test(txt) || /штанг/.test(txt)) return 'Платяной';
      return '';
    }
    function fillingOrder(label){
      const s = String(label || '').toLowerCase().replace(/ё/g,'е');
      if(s.includes('полк')) return 1;
      if(s.includes('платян')) return 2;
      return 3;
    }
    function chooseFillingTarget(items, currentItem){
      return chooseTarget(items || [], colorKey(currentItem)) || ((items || [])[0] || null);
    }
    function drawersLabel(v){
      const explicit = attr(v, 'Количество ящиков');
      if(explicit) return explicit;
      const txt = [v && v.t, attr(v, 'Что есть у товара'), attr(v, 'Особенности')].filter(Boolean).join(' ').toLowerCase().replace(/ё/g,'е');
      if(/к800\s*3\s*\/\s*2/.test(txt) || /5\s*ящ/.test(txt)) return '5 ящиков';
      if(/комод\s+к800/.test(txt) || /4\s*ящ/.test(txt)) return '4 ящика';
      return '';
    }
    function drawersOrder(label){
      const n = String(label || '').match(/\d+/);
      return n ? Number(n[0]) : 99;
    }
    function chooseDrawersTarget(items, currentItem){
      return chooseTarget(items || [], colorKey(currentItem)) || ((items || [])[0] || null);
    }
    function renderVariantCards(items, hasAltConfigs){
      return items.map(v=>{
        const isCurrent = String(v.id) === String(it.id);
        const name = producerColorLabel(v);
        const extra = optionExtra(v);
        const sub = hasAltConfigs ? extra : '';
        const priceTxt = v.p ? (Number(v.p).toLocaleString('ru-RU')+' ₽') : 'Цена по запросу';
        const img = v.img ? `<img class="mMulti-color-img" ${imgAttrs(v.img, 300)} alt="">` : '<div class="mMulti-color-img"></div>';
        const click = isCurrent ? '' : `onclick="navOpen('${esc(v.id)}')"`;
        const stockHtml = variantStockHtml(v);
        return `<div class="mMulti-color${isCurrent?' current':''}" ${click} ${isCurrent?'style="cursor:default"':''}>
          ${img}
          <div class="mMulti-color-body">
            <div class="mMulti-color-name">${esc(name)}${isCurrent?' · текущий':''}</div>
            ${sub ? `<div class="mMulti-color-sub">${esc(sub)}</div>` : ''}
            <div class="mMulti-color-price">${priceTxt}</div>
            ${stockHtml}
          </div>
        </div>`;
      }).join('');
    }

    colorTabs.innerHTML = '';
    colorTabs.style.display = 'none';

    if(options.length < 2){
      listC.innerHTML = '';
      secC.style.display = 'none';
      return;
    }

    const mirrorBuckets = new Map();
    options.forEach(v=>{
      const label = mirrorLabel(v, options);
      if(!label) return;
      const key = normTokenLocal(label);
      if(!mirrorBuckets.has(key)) mirrorBuckets.set(key, { key, label, items: [] });
      mirrorBuckets.get(key).items.push(v);
    });
    const mirrors = Array.from(mirrorBuckets.values()).sort((a,b)=>mirrorOrder(a.label)-mirrorOrder(b.label));
    const hasMirrorTabs = mirrors.length > 1 && options.every(v => !!mirrorLabel(v, options));

    const fillingBuckets = new Map();
    options.forEach(v=>{
      const label = fillingLabel(v);
      if(!label) return;
      const key = normTokenLocal(label);
      if(!fillingBuckets.has(key)) fillingBuckets.set(key, { key, label, items: [] });
      fillingBuckets.get(key).items.push(v);
    });
    const fillings = Array.from(fillingBuckets.values()).sort((a,b)=>fillingOrder(a.label)-fillingOrder(b.label));
    const hasFillingTabs = !hasMirrorTabs && fillings.length > 1 && options.every(v => !!fillingLabel(v));

    const drawerBuckets = new Map();
    options.forEach(v=>{
      const label = drawersLabel(v);
      if(!label) return;
      const key = normTokenLocal(label);
      if(!drawerBuckets.has(key)) drawerBuckets.set(key, { key, label, items: [] });
      drawerBuckets.get(key).items.push(v);
    });
    const drawers = Array.from(drawerBuckets.values()).sort((a,b)=>drawersOrder(a.label)-drawersOrder(b.label));
    const hasDrawerTabs = !hasMirrorTabs && !hasFillingTabs && drawers.length > 1 && options.every(v => !!drawersLabel(v));

    const colorBuckets = new Map();
    options.forEach(v=>{
      const key = colorNorm(v);
      if(!colorBuckets.has(key)) colorBuckets.set(key, { key, label: colorLabel(v), items: [] });
      colorBuckets.get(key).items.push(v);
    });
    const colors = Array.from(colorBuckets.values()).sort((a,b)=>String(a.label||'').localeCompare(String(b.label||''),'ru'));
    const hasRepeatedColorVariants = colors.some(c => c.items && c.items.length > 1);
    const hasColorTabs = !hasMirrorTabs && !hasFillingTabs && !hasDrawerTabs && options.length > 2 && colors.length > 1 && hasRepeatedColorVariants;

    if(hasMirrorTabs){
      const currentMirror = mirrorLabel(it, options);
      if(!curMirror || !mirrorBuckets.has(normTokenLocal(curMirror))) curMirror = currentMirror || mirrors[0].label;
      const activeNorm = normTokenLocal(curMirror || mirrors[0].label);
      colorTabs.innerHTML = mirrors.map(m=>{
        const active = m.key === activeNorm;
        return `<button type="button" class="mMulti-tab${active?' active':''}" data-mirror="${esc(m.label)}">${esc(m.label)}</button>`;
      }).join('');
      colorTabs.querySelectorAll('[data-mirror]').forEach(btn=>{
        btn.onclick = () => {
          const nextMirror = btn.getAttribute('data-mirror') || '';
          curMirror = nextMirror;
          const nextBucket = mirrorBuckets.get(normTokenLocal(nextMirror));
          const currentStillFits = nextBucket && nextBucket.items.some(v=>String(v.id)===String(it.id));
          if(nextBucket && !currentStillFits){
            const target = chooseMirrorTarget(nextBucket.items, it) || nextBucket.items[0];
            if(target && String(target.id) !== String(it.id)){ navOpen(target.id); return; }
          }
          renderColors();
        };
      });
      colorTabs.style.display = '';
    } else if(hasFillingTabs){
      const currentFilling = fillingLabel(it);
      if(!curFilling || !fillingBuckets.has(normTokenLocal(curFilling))) curFilling = currentFilling || fillings[0].label;
      const activeNorm = normTokenLocal(curFilling || fillings[0].label);
      colorTabs.innerHTML = fillings.map(f=>{
        const active = f.key === activeNorm;
        return `<button type="button" class="mMulti-tab${active?' active':''}" data-filling="${esc(f.label)}">${esc(f.label)}</button>`;
      }).join('');
      colorTabs.querySelectorAll('[data-filling]').forEach(btn=>{
        btn.onclick = () => {
          const nextFilling = btn.getAttribute('data-filling') || '';
          curFilling = nextFilling;
          const nextBucket = fillingBuckets.get(normTokenLocal(nextFilling));
          const currentStillFits = nextBucket && nextBucket.items.some(v=>String(v.id)===String(it.id));
          if(nextBucket && !currentStillFits){
            const target = chooseFillingTarget(nextBucket.items, it) || nextBucket.items[0];
            if(target && String(target.id) !== String(it.id)){ navOpen(target.id); return; }
          }
          renderColors();
        };
      });
      colorTabs.style.display = '';
    } else if(hasDrawerTabs){
      const currentDrawers = drawersLabel(it);
      if(!curDrawers || !drawerBuckets.has(normTokenLocal(curDrawers))) curDrawers = currentDrawers || drawers[0].label;
      const activeNorm = normTokenLocal(curDrawers || drawers[0].label);
      colorTabs.innerHTML = drawers.map(d=>{
        const active = d.key === activeNorm;
        return `<button type="button" class="mMulti-tab${active?' active':''}" data-drawers="${esc(d.label)}">${esc(d.label)}</button>`;
      }).join('');
      colorTabs.querySelectorAll('[data-drawers]').forEach(btn=>{
        btn.onclick = () => {
          const nextDrawers = btn.getAttribute('data-drawers') || '';
          curDrawers = nextDrawers;
          const nextBucket = drawerBuckets.get(normTokenLocal(nextDrawers));
          const currentStillFits = nextBucket && nextBucket.items.some(v=>String(v.id)===String(it.id));
          if(nextBucket && !currentStillFits){
            const target = chooseDrawersTarget(nextBucket.items, it) || nextBucket.items[0];
            if(target && String(target.id) !== String(it.id)){ navOpen(target.id); return; }
          }
          renderColors();
        };
      });
      colorTabs.style.display = '';
    } else if(hasColorTabs){
      const currentNorm = normTokenLocal(curColor || colorLabel(it));
      if(!colorBuckets.has(currentNorm)) curColor = colors[0].label;
      const activeNorm = normTokenLocal(curColor || colors[0].label);
      colorTabs.innerHTML = colors.map(c=>{
        const active = c.key === activeNorm;
        return `<button type="button" class="mMulti-tab${active?' active':''}" data-color="${esc(c.label)}">${esc(c.label)}</button>`;
      }).join('');
      colorTabs.querySelectorAll('[data-color]').forEach(btn=>{
        btn.onclick = () => {
          const nextColor = btn.getAttribute('data-color') || '';
          curColor = nextColor;
          const nextBucket = colorBuckets.get(normTokenLocal(nextColor));
          const currentStillFits = nextBucket && nextBucket.items.some(v=>String(v.id)===String(it.id));
          if(nextBucket && !currentStillFits){
            const target = chooseTarget(nextBucket.items, nextColor) || nextBucket.items[0];
            if(target && String(target.id) !== String(it.id)){ navOpen(target.id); return; }
          }
          renderColors();
        };
      });
      colorTabs.style.display = '';
    }

    let filteredOptions = options;
    if(hasMirrorTabs){
      const activeBucket = mirrorBuckets.get(normTokenLocal(curMirror || mirrors[0].label)) || mirrors[0];
      filteredOptions = activeBucket.items.slice().sort((a,b)=>String(colorLabel(a)||'').localeCompare(String(colorLabel(b)||''),'ru'));
    } else if(hasFillingTabs){
      const activeBucket = fillingBuckets.get(normTokenLocal(curFilling || fillings[0].label)) || fillings[0];
      filteredOptions = activeBucket.items.slice().sort((a,b)=>String(colorLabel(a)||'').localeCompare(String(colorLabel(b)||''),'ru'));
    } else if(hasDrawerTabs){
      const activeBucket = drawerBuckets.get(normTokenLocal(curDrawers || drawers[0].label)) || drawers[0];
      filteredOptions = activeBucket.items.slice().sort((a,b)=>String(colorLabel(a)||'').localeCompare(String(colorLabel(b)||''),'ru'));
    } else if(hasColorTabs){
      const activeBucket = colorBuckets.get(normTokenLocal(curColor || colors[0].label)) || colors[0];
      filteredOptions = activeBucket.items.slice();
    }

    const uniqueConfigCount = new Set(filteredOptions.map(v=>normTokenLocal(optionExtra(v) || String(v && v.id || '')))).size;
    const hasAltConfigs = uniqueConfigCount > 1;
    const sizeText = bucket && bucket.label ? ` для размера ${bucket.label}` : '';
    if(hasMirrorTabs) hC.textContent = `Выберите исполнение${sizeText}`;
    else if(hasFillingTabs) hC.textContent = `Выберите наполнение${sizeText}`;
    else if(hasDrawerTabs) hC.textContent = `Выберите количество ящиков${sizeText}`;
    else if(hasColorTabs && hasAltConfigs) hC.textContent = `Выберите цвет и вариант${sizeText}`;
    else if(hasColorTabs) hC.textContent = `Выберите цвет${sizeText}`;
    else if(hasAltConfigs) hC.textContent = `Другие варианты комплекта${sizeText}`;
    else hC.textContent = `Варианты${sizeText}`;

    listC.innerHTML = renderVariantCards(filteredOptions, hasAltConfigs);
    listC.style.display = filteredOptions.length ? '' : 'none';
    secC.style.display = '';
  }

  wSel.onchange = () => {
    const nextKey = String(wSel.value || '');
    if(!nextKey || !sizeBuckets.has(nextKey)) return;
    curSizeKey = nextKey;
    renderExecSelect();
    const target = chooseTarget(currentFilteredItems(), colorKey(it));
    if(target && String(target.id) !== String(it.id)) navOpen(target.id);
    else renderColors();
  };
  extraSel.onchange = () => {
    curExec = String(extraSel.value || '');
    const target = chooseTarget(currentFilteredItems(), colorKey(it));
    if(target && String(target.id) !== String(it.id)) navOpen(target.id);
    else renderColors();
  };
  if(moreBtn){
    moreBtn.style.display = 'none';
    moreBtn.onclick = null;
  }

  if(sizes.length >= 2){
    wSel.dataset.kind = 'size';
    wSel.innerHTML = sizes.map(bucket=>{
      const primary = String(bucket.label || 'Размер');
      const refItem = (bucket.items && bucket.items[0]) || it;
      const full = sizeFullLabel(bucket, refItem);
      return `<option value="${esc(bucket.key)}" data-short="${esc(primary)}" data-full="${esc(full)}" ${bucket.key===curSizeKey?'selected':''}>${esc(primary)}</option>`;
    }).join('');
    bindMultiSizeSelect(wSel);
    syncMultiSizeSelectDisplay(wSel, false);
    secW.style.display = '';
  } else {
    wSel.dataset.kind = 'size';
    if(sizes.length){
      const primary = String(sizes[0].label || 'Размер');
      const refItem = (sizes[0].items && sizes[0].items[0]) || it;
      const full = sizeFullLabel(sizes[0], refItem);
      wSel.innerHTML = `<option value="${esc(sizes[0].key)}" data-short="${esc(primary)}" data-full="${esc(full)}" selected>${esc(primary)}</option>`;
      bindMultiSizeSelect(wSel);
      syncMultiSizeSelectDisplay(wSel, false);
    } else {
      wSel.innerHTML = '<option value="">Сп.Место</option>';
    }
    secW.style.display = isKitchen && getExecOptions(getCurrentBucket()).length >= 2 ? '' : 'none';
  }

  if(hW){
    const hasSleepingPlaces = sizes.some(bucket => String(bucket && bucket.key || '').startsWith('sp:'));
    hW.textContent = isKitchen ? 'Размер / исполнение' : (hasSleepingPlaces ? 'Сп.Место' : 'Размер / исполнение');
  }

  renderExecSelect();
  renderColors();

  const hasSizes = sizes.length >= 2;
  const hasExec = extraSel.style.display !== 'none';
  const hasColors = secC.style.display !== 'none';
  box.style.display = (hasSizes || hasExec || hasColors) ? '' : 'none';
}
function getDefaultKitchenCountertopItem(){
  return (window.CATALOG || []).find(x => normBuilderToken([x && x.t, x && x.c, x && x.sheet].filter(Boolean).join(' ')).includes('столеш')) || null;
}
function kitchenNeedsCountertop(it){
  if(!it) return false;
  const sh = String(it.sheet || it.c || '').trim();
  if(sh !== 'Кухни') return false;
  const attrs = it.a || {};
  const val = String(attrs['Столешница в комплекте'] || attrs['Наличие столешницы'] || '').toLowerCase();
  if(val && (val.includes('нет') || val.includes('без'))) return false;
  return true;
}
function makeKitchenCountertopRow(it){
  const top = getDefaultKitchenCountertopItem();
  if(!top) return null;
  return {
    kitchen_key: String(it && it.id || ''),
    kitchen_title: String(it && it.t || 'Кухня'),
    module_item_id: String(top.id || ''),
    module_avito_id: String(top.id || ''),
    module_art: '',
    module_code: '',
    module_title: top.t || 'Столешница',
    module_factory: top.f || 'Эра',
    qty: 1,
    order: 999,
    required: true,
    group: 'Столешницы',
    comment: 'Столешница добавлена автоматически в комплект кухни',
    match_type: 'id',
    matched_price: Number(top.p || 0) || null,
    matched_photo: top.img || ''
  };
}
function getKitchenCompRowsForItem(it){
  const rows = ((window.__KITCHEN_COMP__ || {})[String(it && it.id)] || []).slice();
  if(kitchenNeedsCountertop(it)){
    const hasTop = rows.some(r => normBuilderToken([r.group, r.module_title, r.module_code].filter(Boolean).join(' ')).includes('столеш'));
    if(!hasTop){
      const row = makeKitchenCountertopRow(it);
      if(row) rows.push(row);
    }
  }
  return rows;
}

function getKitCompRowStockQty(row, modItem){
  if(!STOCK || !STOCK.loaded) return 0;
  if(modItem) return Math.max(0, Number(modItem._stockQty) || 0);
  if(row && Array.isArray(row.component_arts) && row.component_arts.length){
    let minQty = Infinity;
    for(const art of row.component_arts){
      const key = normArt(art);
      if(!key) return 0;
      minQty = Math.min(minQty, getStockQtyByArt(key));
    }
    return Number.isFinite(minQty) ? Math.max(0, minQty) : 0;
  }
  const art = row && (row.module_art || row.supplier_art || row.art || '');
  return art ? getStockQtyByArt(art) : 0;
}

function renderKitComposition(it){
  const box=document.getElementById('mKitComp'), list=document.getElementById('mKitCompList'), stats=document.getElementById('mKitStats');
  if(!box||!list) return;
  const comp = getKitchenCompRowsForItem(it);
  if(!comp || !comp.length){ box.style.display='none'; return; }

  const ownerId = String(it.id);
  const groups = buildKitCompGroups(comp, ownerId);
  const activeRows = groups.map(g=>g.active).filter(Boolean);

  // Подсчёт модулей с учётом qty, суммы, наличия. Альтернативы считаются как один обязательный модуль.
  let totalModules = 0, kitSum = 0, kitSumKnown = 0, inStockCount = 0, hasStock = STOCK.loaded;
  activeRows.forEach(row=>{
    const q = Number(row.qty)||1;
    totalModules += q;
    const m = findItemById(row.module_avito_id || row.module_item_id);
    const price = m ? getBedCardDisplayPrice(m, (row.matched_price || row.price)) : Number(row.matched_price || row.price || 0);
    if(price){ kitSum += Number(price)*q; kitSumKnown += q; }
    // Доп. опция «Мягкое сиденье» к тумбе (Микон): прибавляем цену сиденья если выбрано
    if(m && shouldShowSeatOption(m)){
      const extra = getSeatOptionExtraPrice(m.id);
      if(extra > 0) kitSum += extra * q;
    }
    const stockQty = getKitCompRowStockQty(row, m);
    inStockCount += Math.min(q, stockQty);
  });

  // Статистика сверху
  const statsHtml = [
    `<div class="kitStat">Модулей: <b>${totalModules}</b></div>`,
    `<div class="kitStat accent">Сумма комплекта: <b>${kitSum.toLocaleString('ru-RU')} ₽</b></div>`,
    hasStock
      ? `<div class="kitStat ${inStockCount===totalModules?'ok':''}">В наличии: <b>${inStockCount}/${totalModules}</b></div>`
      : `<div class="kitStat">Остатки не загружены</div>`
  ].join('');
  if(stats) stats.innerHTML = statsHtml;

  list.innerHTML = groups.map(group=>{
    const row = group.active;
    const modItem = findItemById(row.module_avito_id || row.module_item_id);
    const title = (modItem && modItem.t) || row.module_title || row.module_code || '—';
    const price = modItem ? getBedCardDisplayPrice(modItem, row.matched_price) : Number(row.matched_price || 0);
    const photo = (modItem && modItem.img) || row.matched_photo || '';
    const qty = Number(row.qty) || 1;
    const clickable = !!(modItem && modItem.id);
    const click = clickable ? `onclick="if(event.target.closest('.kitVariantSelect,.kitCard-bedopt')) return; navOpen('${esc(modItem.id)}')"` : '';
    const priceTxt = price ? (Number(price).toLocaleString('ru-RU')+' ₽') : '—';
    const stockBadge = hasStock
      ? (()=>{
          const stockQty = getKitCompRowStockQty(row, modItem);
          return stockQty >= qty ? '<span class="kitCard-stock ok">В наличии</span>' : '<span class="kitCard-stock">Под заказ</span>';
        })()
      : '<span class="kitCard-stock">Нет данных</span>';
    const bedOptSummary = (modItem && shouldShowBedOptions(modItem)) ? getBedOptionShortBadge(modItem) : '';
    const seatOptSummary = (modItem && shouldShowSeatOption(modItem)) ? getSeatOptionShortBadge(modItem) : '';
    const meta = [
      row.module_factory || (modItem && modItem.f),
      modItem && modItem.art ? modItem.art : (row.module_art || ''),
    ].filter(Boolean).join(' · ');
    const compDetails = getModuleMessageDetails({
      id: modItem && modItem.id,
      title: title,
      color: row.module_color || row.color || row.matched_color || '',
      variantLabel: modItem ? getWardrobeVariantLabelForItem(modItem) : ''
    }, modItem);
    const variantTabs = renderKitVariantTabs(ownerId, group.key, group.rows, row);
    const bedOptButton = (!variantTabs && modItem && shouldShowBedOptions(modItem))
      ? `<button type="button" class="kitCard-bedopt" onclick="event.stopPropagation(); openMiniBedOptionPopup(event,'${esc(modItem.id)}'); return false;">Опции</button>`
      : '';
    const seatOptButton = (!variantTabs && modItem && shouldShowSeatOption(modItem))
      ? `<button type="button" class="kitCard-bedopt" onclick="event.stopPropagation(); openMiniSeatOptionPopup(event,'${esc(modItem.id)}'); return false;">Опции</button>`
      : '';
    // Цена карточки: если выбрано «с сиденьем» — добавляем стоимость сиденья к цене тумбы
    const seatExtra = (modItem && shouldShowSeatOption(modItem)) ? getSeatOptionExtraPrice(modItem.id) : 0;
    const priceWithSeat = (Number(price) || 0) + seatExtra;
    const priceTxtFinal = priceWithSeat ? (priceWithSeat.toLocaleString('ru-RU')+' ₽') : priceTxt;

    return `<div class="kitCard${clickable?'':' disabled'}" data-kit-owner="${esc(ownerId)}" data-kit-group="${esc(group.key)}" data-kit-item="${esc(String(row.module_avito_id || row.module_item_id || ''))}" ${click}>
      <div class="kitCard-ph">
        ${photo?`<img ${imgAttrs(photo, 400)} alt="">`:'<div class="noph">📦</div>'}
        ${row.group?`<span class="kitCard-grp">${esc(row.group)}</span>`:''}
        <span class="kitCard-qty">×${qty}</span>
        ${bedOptSummary}
        ${seatOptSummary}
      </div>
      <div class="kitCard-body">
        <div class="kitCard-title">${esc(title)}</div>
        ${renderModuleCardDetailsHtml(compDetails)}
        ${meta?`<div class="kitCard-meta">${esc(meta)}</div>`:''}
        ${variantTabs}
        ${(bedOptButton || seatOptButton)?`<div class="kitCard-tools">${bedOptButton}${seatOptButton}</div>`:''}
      </div>
      <div class="kitCard-foot">
        ${stockBadge}
        <div class="kitCard-price">${priceTxtFinal}</div>
      </div>
    </div>`;
  }).join('');

  // Делегированный обработчик смены варианта в составе комплекта.
  // Используем data-kit-owner / data-kit-group вместо inline onchange,
  // чтобы избежать проблем с экранированием кавычек внутри HTML-атрибутов.
  if(!list._kitVariantHandlerBound){
    const handler = function(ev){
      const sel = ev.target && ev.target.closest ? ev.target.closest('select.kitVariantSelectInput') : null;
      if(!sel) return;
      const owner = sel.getAttribute('data-kit-owner') || '';
      const group = sel.getAttribute('data-kit-group') || '';
      selectKitCompVariant(owner, group, sel.value, ev);
    };
    list.addEventListener('change', handler);
    list.addEventListener('input', handler);
    list._kitVariantHandlerBound = true;
  }

  box.style.display = '';
}

// Состояние конструктора «Собрать из модулей»
// Состояние калькулятора (какие модули выбраны, с количеством)
// Ключ — ID модуля (или generated ключ для модулей без item_id), значение — qty
let BUILDER_CART = {};
let BUILDER_STORE = {};
let BUILDER = { ownerId:null, pool:[], typeFilter:'__all__', w:'', h:'', d:'', color:'', inStock:false };

function cloneBuilderCart(cart){
  const out = {};
  Object.entries(cart || {}).forEach(([key, entry])=>{
    if(!entry || !entry.m) return;
    out[key] = { qty: Number(entry.qty) || 0, m: entry.m };
  });
  return out;
}
function hideCalcPanel(){
  const panel = document.getElementById('mCalcPanel');
  if(panel){
    panel.style.display = 'none';
    panel.classList.remove('expanded');
  }
}
// Раскрытие/сворачивание панели калькулятора на мобильном.
// На десктопе панель всегда раскрыта (CSS .mCalcCollapsed скрыт через @media).
function toggleCalcExpand(){
  const panel = document.getElementById('mCalcPanel');
  if(!panel) return;
  // На десктопе сворачиваем через класс dt-collapsed (по умолчанию развёрнут),
  // на мобильном — через expanded (по умолчанию свёрнут).
  if(window.matchMedia && window.matchMedia('(min-width:781px)').matches){
    panel.classList.toggle('dt-collapsed');
  } else {
    panel.classList.toggle('expanded');
  }
}
// Открыт ли калькулятор сейчас (есть ли в нём что-то).
// Используется при отправке в ВК — если калькулятор активен, в сообщение
// идёт список из калькулятора, иначе — сообщение по текущей карточке.
function isCalcActive(){
  const panel = document.getElementById('mCalcPanel');
  if(!panel || panel.style.display === 'none') return false;
  const items = (typeof BUILDER_CART === 'object' && BUILDER_CART) ? Object.values(BUILDER_CART) : [];
  return items.length > 0;
}
function saveBuilderSession(){
  const ownerId = String(BUILDER.ownerId || '');
  if(!ownerId) return;
  BUILDER_STORE[ownerId] = {
    cart: cloneBuilderCart(BUILDER_CART),
    state: {
      typeFilter: BUILDER.typeFilter || '__all__',
      w: BUILDER.w || '',
      h: BUILDER.h || '',
      d: BUILDER.d || '',
      color: BUILDER.color || '',
      inStock: !!BUILDER.inStock
    }
  };
}
function restoreBuilderSession(ownerId){
  const key = String(ownerId || '');
  const saved = BUILDER_STORE[key];
  if(saved){
    BUILDER_CART = cloneBuilderCart(saved.cart || {});
    BUILDER.typeFilter = saved.state && saved.state.typeFilter ? saved.state.typeFilter : '__all__';
    BUILDER.w = saved.state && saved.state.w ? saved.state.w : '';
    BUILDER.h = saved.state && saved.state.h ? saved.state.h : '';
    BUILDER.d = saved.state && saved.state.d ? saved.state.d : '';
    BUILDER.color = saved.state && saved.state.color ? saved.state.color : '';
    BUILDER.inStock = !!(saved.state && saved.state.inStock);
    return;
  }
  BUILDER_CART = {};
  BUILDER.typeFilter = '__all__';
  BUILDER.w = '';
  BUILDER.h = '';
  BUILDER.d = '';
  BUILDER.color = '';
  BUILDER.inStock = false;
}
function resetBuilderSession(){
  BUILDER_STORE = {};
  BUILDER_CART = {};
  BUILDER.ownerId = null;
  BUILDER.pool = [];
  BUILDER.typeFilter = '__all__';
  BUILDER.w = '';
  BUILDER.h = '';
  BUILDER.d = '';
  BUILDER.color = '';
  BUILDER.inStock = false;
}

// Уникальный ключ модуля — для сохранения в корзине
function moduleKey(m){
  return String(m.id || ('_' + (m._raw && (m._raw.title||'')) + '_' + (m._raw && (m._raw.type||''))));
}

// Классификация модуля для подсчёта суммарной ширины
// Для кухонь: top/bottom/other.
// Для гостиных: living-width — только шкафы, ТВ-тумбы, стеллажи и этажерки.
// Для спален: bedroom-width — только шкафы, стеллажи и этажерки.
// Для прихожих: hallway-width — шкафы, тумбы/обувницы, прихожие без вешалок, стеллажи/этажерки.
function moduleWidthGroup(m){
  const owner = findItemById_Soft(BUILDER.ownerId || '');
  const ownerSheet = String((owner && (owner.sheet || owner.c || '')) || '').trim();
  const ownerTitle = String((owner && owner.t) || '').toLowerCase();
  const t = String(m.type||'').toLowerCase();
  const title = String(m.title||'').toLowerCase();
  if(ownerSheet === 'Гарнитуры и комплекты'){
    const isLivingWidthRow = (
      t.includes('шкаф') ||
      t.includes('тумбы тв') ||
      t.includes('стеллаж') ||
      t.includes('этажерк') ||
      /(^|\s)шкаф(ы)?(\s|$)/.test(title) ||
      /тумба\s*тв|тв\s*тумба|под\s*телев/.test(title) ||
      /стеллаж/.test(title) ||
      /этажерк/.test(title)
    );
    return isLivingWidthRow ? 'living-width' : 'other';
  }
  if(ownerSheet === 'Спальные гарнитуры'){
    const isBedroomWidthRow = (
      t.includes('шкаф') ||
      t.includes('стеллаж') ||
      t.includes('этажерк') ||
      /(^|\s)шкаф(ы)?(\s|$)/.test(title) ||
      /стеллаж/.test(title) ||
      /этажерк/.test(title)
    );
    return isBedroomWidthRow ? 'bedroom-width' : 'other';
  }
  if(ownerSheet === 'Прихожие и обувницы' || ownerTitle.includes('прихож')){
    const isHanger = /вешалк/.test(title) || (t.includes('вешал') && !title.includes('прихож'));
    const isHallwayUnit = title.includes('прихож') && !isHanger;
    const isHallwayWidthRow = (
      t.includes('шкаф') ||
      t.includes('тумбы') ||
      t.includes('обувниц') ||
      t.includes('стеллаж') ||
      t.includes('этажерк') ||
      /(^|\s)шкаф(ы)?(\s|$)|шкаф-?пенал/.test(title) ||
      /тумб|обувниц/.test(title) ||
      /стеллаж/.test(title) ||
      /этажерк/.test(title) ||
      isHallwayUnit
    );
    return isHallwayWidthRow ? 'hallway-width' : 'other';
  }
  // Верхние: "шкафы навесные", "верхний", "шкаф навесной"
  if(t.includes('навесн') || t.includes('верхн')) return 'top';
  // Нижние: "шкафы напольные", "нижний", "тумбы под мойку", "под мойку", "пенал"
  if(t.includes('напольн') || t.includes('нижн') || t.includes('под мойк') || t.includes('пенал')) return 'bottom';
  return 'other';
}

function cartGet(m){
  const v = BUILDER_CART[moduleKey(m)];
  return v ? (v.qty||0) : 0;
}
function cartSet(m, qty){
  const oldQty = cartGet(m);
  const k = moduleKey(m);
  if(qty <= 0) delete BUILDER_CART[k];
  else BUILDER_CART[k] = { qty: qty, m: m };
  if(qty > oldQty){
    try{
      if(window.statsTrack) statsTrack('add_module', {
        ownerId: BUILDER.ownerId || '',
        module_id: m && m.id ? m.id : '',
        module_title: m && m.title ? m.title : '',
        module_type: m && m.type ? m.type : '',
        module_color: m && m.color ? m.color : '',
        qty: qty,
        added: qty - oldQty
      });
    }catch(_){}
  }
  saveBuilderSession();
  renderCalcPanel();
  // Перерисуем карточку этого модуля — меняем qty-val и класс
  const cardEl = document.querySelector(`[data-mk="${esc(k)}"]`);
  if(cardEl){
    const q = qty > 0 ? qty : 0;
    const qv = cardEl.querySelector('.qty-val'); if(qv) qv.textContent = q;
    cardEl.classList.toggle('qty-active', q > 0);
    const ch = cardEl.querySelector('.kitCard-chosen');
    if(q > 0){
      if(!ch){
        const span = document.createElement('span');
        span.className = 'kitCard-chosen';
        span.textContent = 'Выбрано';
        const ph = cardEl.querySelector('.kitCard-ph');
        if(ph) ph.appendChild(span);
      }
    } else {
      if(ch) ch.remove();
    }
  }
}
function cartInc(m){ cartSet(m, cartGet(m) + 1); }
function cartDec(m){ const cur = cartGet(m); if(cur > 0) cartSet(m, cur - 1); }
function cartClear(){
  BUILDER_CART = {};
  saveBuilderSession();
  renderCalcPanel();
  // Перерисовать сетку, чтобы убрать бейджи
  renderBuilderGrid();
}

// Главная: подсчёт суммарной ширины по правилу верх/низ
function calcSummary(){
  const items = Object.values(BUILDER_CART); // [{qty, m}, …]
  if(!items.length) return { count:0, width:0, sum:0, groups:{top:0,bottom:0,other:0,living:0,bedroom:0,hallway:0} };
  let totalCount = 0, totalSum = 0;
  let widthTop = 0, widthBottom = 0, widthLiving = 0, widthBedroom = 0, widthHallway = 0;
  items.forEach(({qty, m})=>{
    totalCount += qty;
    const linkedItem = m && m.id ? findItemById(m.id) : null;
    const currentPrice = linkedItem ? getBedCardDisplayPrice(linkedItem, m.price) : Number(m.price || 0);
    const seatX = (linkedItem && typeof getSeatOptionExtraPrice === 'function') ? getSeatOptionExtraPrice(linkedItem.id) : 0;
    if(currentPrice || seatX) totalSum += (Number(currentPrice) + seatX) * qty;
    const g = moduleWidthGroup(m);
    const w = Number(m.width) || 0;
    if(g === 'top') widthTop += w * qty;
    if(g === 'bottom') widthBottom += w * qty;
    if(g === 'living-width') widthLiving += w * qty;
    if(g === 'bedroom-width') widthBedroom += w * qty;
    if(g === 'hallway-width') widthHallway += w * qty;
    // 'other' — не учитываем в суммарной ширине
  });
  const owner = findItemById_Soft(BUILDER.ownerId || '');
  const ownerSheet = String((owner && (owner.sheet || owner.c || '')) || '').trim();
  const width = ownerSheet === 'Гарнитуры и комплекты'
    ? widthLiving
    : (ownerSheet === 'Спальные гарнитуры'
      ? widthBedroom
      : (ownerSheet === 'Прихожие и обувницы' ? widthHallway : Math.max(widthTop, widthBottom)));
  return { count: totalCount, width, sum: totalSum,
           groups:{top:widthTop, bottom:widthBottom, other:0, living:widthLiving, bedroom:widthBedroom, hallway:widthHallway} };
}

function renderCalcPanel(){
  const panel = document.getElementById('mCalcPanel');
  const priceEl = document.getElementById('mCalcPrice');
  const metaEl = document.getElementById('mCalcMeta');
  const listEl = document.getElementById('mCalcList');
  if(!panel || !priceEl || !metaEl || !listEl) return;
  const items = Object.values(BUILDER_CART);
  if(!items.length){ panel.style.display = 'none'; return; }

  const s = calcSummary();
  priceEl.textContent = `${s.sum.toLocaleString('ru-RU')} ₽`;
  metaEl.textContent = `Выбрано: ${s.count} · Ширина: ${formatCmNumber(s.width)} см`;

  // Обновляем свёрнутую полоску для мобильного вида
  const cMeta = document.getElementById('mCalcCollapsedMeta');
  const cPrice = document.getElementById('mCalcCollapsedPrice');
  if(cMeta){
    // Подбираем форму слова "товар" под число: 1 товар, 2/3/4 товара, 5+ товаров
    const n = s.count;
    const word = (n%10===1 && n%100!==11) ? 'товар'
               : (n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20)) ? 'товара'
               : 'товаров';
    cMeta.textContent = `${n} ${word}`;
  }
  if(cPrice) cPrice.textContent = `${s.sum.toLocaleString('ru-RU')} ₽`;

  // Сортируем: сначала по группе (top → bottom → other), потом по названию
  const order = { top:0, bottom:1, 'living-width':1, 'bedroom-width':1, 'hallway-width':1, other:2 };
  items.sort((a,b)=>{
    const ga = order[moduleWidthGroup(a.m)], gb = order[moduleWidthGroup(b.m)];
    if(ga !== gb) return ga - gb;
    return String(a.m.title||'').localeCompare(String(b.m.title||''),'ru');
  });

  listEl.innerHTML = items.map(({qty, m})=>{
    const linkedItem = m && m.id ? findItemById(m.id) : null;
    const unitBase = linkedItem ? getBedCardDisplayPrice(linkedItem, m.price) : Number(m.price || 0);
    const unitSeatX = (linkedItem && typeof getSeatOptionExtraPrice === 'function') ? getSeatOptionExtraPrice(linkedItem.id) : 0;
    const unitPrice = Number(unitBase) + unitSeatX;
    const priceTotal = unitPrice ? (unitPrice * qty).toLocaleString('ru-RU')+' ₽' : '—';
    const mk = moduleKey(m);
    const detail = getModuleMessageDetails(m, linkedItem);
    const detailNote = detail ? `<div class="mCalcItem-note">${esc(detail)}</div>` : '';
    const bedNote = (linkedItem && shouldShowBedOptions(linkedItem)) ? `<div class="mCalcItem-note">${esc(getBedOptionShortText(linkedItem))}</div>` : '';
    return `<div class="mCalcItem">
      <div class="mCalcItem-main">
        <div class="mCalcItem-title">${esc(m.title||'—')}</div>
        ${detailNote}
        ${bedNote}
      </div>
      <div class="mCalcItem-side">
        <div class="mCalcItem-controls">
          <button type="button" class="mCalcQtyBtn" aria-label="Уменьшить" data-calc-step="-1" data-mk="${esc(mk)}">−</button>
          <div class="mCalcItem-qty">×${qty}</div>
          <button type="button" class="mCalcQtyBtn" aria-label="Увеличить" data-calc-step="1" data-mk="${esc(mk)}">+</button>
        </div>
        <div class="mCalcItem-price">${priceTotal}</div>
      </div>
    </div>`;
  }).join('');

  listEl.querySelectorAll('[data-calc-step]').forEach(btn=>{
    btn.onclick = (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      const mk = String(btn.getAttribute('data-mk') || '');
      const step = Number(btn.getAttribute('data-calc-step') || '0');
      const entry = BUILDER_CART[mk];
      if(!entry || !step) return;
      if(step > 0) cartInc(entry.m);
      else cartDec(entry.m);
    };
  });

  panel.style.display = '';
}

function findItemById_Soft(id){ return id ? findItemById(id) : null; }

function normBuilderToken(v){
  return String(v||'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/gi,' ').replace(/\s+/g,' ').trim();
}
function getBuilderMultiTail(v){
  const raw = String(v || '').trim();
  if(!raw) return '';
  const parts = raw.split('-').map(x=>normBuilderToken(x)).filter(Boolean);
  return parts.length ? parts[parts.length-1] : '';
}
function getBuilderModelName(it){
  if(!it) return '';
  const attrs = it.a || {};
  return normBuilderToken(attrs['Название модели'] || attrs['название модели'] || '');
}
function getExpectedBuilderSeries(it){
  if(!it) return '';
  const raw = getBuilderMultiTail(it.mu) || getBuilderModelName(it) || normBuilderToken((it.a && it.a['Цвет от производителя']) || '');
  return raw.replace(/\s+/g,''); // "сидней 1" и "сидней1" считаем одной серией
}
function getPoolRowSeriesKey(row){
  // Для псевдо-модулей из связки (например «Центр Секция» Сидней 1)
  // нет живой карточки в каталоге, поэтому серию нужно брать прямо из строки пула.
  const directSeries = normBuilderToken(row && row.series).replace(/\s+/g,'');
  if(directSeries) return directSeries;
  const linked = findItemById_Soft(row && (row.avito_id || row.item_id));
  return (getBuilderMultiTail(linked && linked.mu) || getBuilderModelName(linked) || '').replace(/\s+/g,'');
}
function getPoolRowFactory(row){
  const linked = findItemById_Soft(row && (row.avito_id || row.item_id));
  return normBuilderToken((linked && linked.f) || (row && row.factory) || '');
}
function getPoolRowSearchBlob(row){
  const linked = findItemById_Soft(row && (row.avito_id || row.item_id));
  return normBuilderToken([
    row && row.title,
    row && row.type,
    row && row.category,
    row && row.sheet,
    row && row.color,
    row && row.factory,
    row && row.series,
    row && row.comp_title,
    row && row.module_type,
    row && row.supplier_art,
    linked && linked.t,
    linked && linked.c,
    linked && linked.sheet,
    linked && linked.f,
    linked && linked.mu,
    linked && linked.a && linked.a['Название модели'],
    linked && linked.a && linked.a['Цвет от производителя']
  ].filter(Boolean).join(' '));
}
function filterBuilderPoolForItem(it, pool){
  const expected = getExpectedBuilderSeries(it);
  if(!expected || !Array.isArray(pool) || !pool.length) return Array.isArray(pool) ? pool.slice() : [];
  const expectedFactory = normBuilderToken(it && it.f);
  return pool.filter(row=>{
    const rowSeries = getPoolRowSeriesKey(row);
    const hay = getPoolRowSearchBlob(row);
    const ownerSheet = String((it && (it.sheet || it.c || '')) || '').trim();
    // Столешницы могут быть от другой фабрики (например Кедр), но должны показываться во всех кухнях.
    if(ownerSheet === 'Кухни' && (hay.includes('столеш') || String(row && row.type || '').toLowerCase().includes('столеш'))) return true;
    const rowFactory = getPoolRowFactory(row);
    // Если серия совпала, но фабрика другая — модуль не показываем.
    // Это защищает от смешивания одноимённых серий, например «Бриз» у Велес и Микон.
    if(expectedFactory && rowFactory && rowFactory !== expectedFactory) return false;
    if(rowSeries){
      if(rowSeries !== expected) return false;
      return true;
    }
    // Псевдо-модуль из состава текущего комплекта должен проходить фильтр,
    // даже если у него нет живой карточки и серия не попала в стандартные поля.
    if(String(row && row.comp_owner_id || '') === String(it && it.id || '')) return true;
    return hay.includes(expected);
  });
}

// Из сырого модуля пула делает «нормализованный» модуль, обогащённый данными CATALOG если есть

function getBuilderTypeOrderForItem(it){
  const sh = String((it && (it.sheet || it.c || '')) || '').trim();
  if(sh === 'Кухни') return ['Шкафы навесные','Шкафы напольные','Тумбы под мойку','Пеналы','Шкафы для плиты','Столешницы','Комплектующие'];
  if(sh === 'Гарнитуры и комплекты') return ['Шкафы','Антресоли','Комоды','Полки','Тумбы ТВ','Стеллажи и этажерки','Надстройки'];
  if(sh === 'Спальные гарнитуры') return ['Шкафы','Антресоли','Комоды','Тумбы','Кровати','Полки','Компьютерные столы','Гримерные столы','Стеллажи и этажерки','Зеркала','Надстройки'];
  if(sh === 'Прихожие и обувницы' || sh === 'Прихожие') return ['Шкафы','Антресоли','Комоды','Тумбы и обувницы','Прихожие и вешалки','Стеллажи и этажерки','Зеркала'];
  return [];
}

function getBuilderAllowedTypesForItem(it){
  const sh = String((it && (it.sheet || it.c || '')) || '').trim();
  const order = getBuilderTypeOrderForItem(it);
  if(sh === 'Гарнитуры и комплекты' || sh === 'Спальные гарнитуры' || sh === 'Прихожие и обувницы' || sh === 'Прихожие') return order;
  return [];
}
function isModularSystemOwner(it){
  const sh = String((it && (it.sheet || it.c || '')) || '').trim();
  return sh === 'Гарнитуры и комплекты' || sh === 'Спальные гарнитуры' || sh === 'Прихожие и обувницы' || sh === 'Прихожие';
}
function normalizeSystemBuilderType(rawType, linked, mod, ownerSheet){
  const blob = normBuilderToken([
    rawType,
    mod && mod.title,
    mod && mod.sheet,
    mod && mod.category,
    linked && linked.t,
    linked && linked.sheet,
    linked && linked.c,
    linked && linked.a && linked.a['Тип модуля'],
    linked && linked.a && linked.a['Тип товара'],
    linked && linked.a && linked.a['Подвид товара']
  ].filter(Boolean).join(' '));
  const titleBlob = normBuilderToken([rawType, mod && mod.title, linked && linked.t].filter(Boolean).join(' '));
  const sheetBlob = normBuilderToken([mod && mod.sheet, mod && mod.category, linked && linked.sheet, linked && linked.c].filter(Boolean).join(' '));

  if(ownerSheet === 'Гарнитуры и комплекты'){
    // В гостиных не показываем спальные/прикроватные модули, даже если лист у поставщика общий «Комоды и тумбы».
    if(titleBlob.includes('прикроват') || sheetBlob.includes('прикроватные тумбы')) return '';
    // Также не подмешиваем модули прихожих / вешалок в гостиные даже при совпадении серии.
    if(blob.includes('прихож') || blob.includes('вешал') || sheetBlob.includes('прихожие и обувницы') || sheetBlob.includes('гардеробные системы и вешалки')) return '';
    // Эра / Пекин: в модули добавляем только центральные секции, а не полные связки 261 см.
    const peKinCenterModuleIds = new Set(['7931333056','7931197750']);
    const sidney1CenterIds = new Set(['8090993271','8090947506','8091649514']);
    const peKinCandidateId = String((linked && linked.id) || (mod && (mod.avito_id || mod.item_id)) || '').trim();
    if(blob.includes('тв-зона') || blob.includes('тв зона') || (peKinCenterModuleIds.has(peKinCandidateId) && titleBlob.includes('гостиная пекин') && sheetBlob.includes('гарнитуры и комплекты')) || (sidney1CenterIds.has(peKinCandidateId) && titleBlob.includes('центральная секция') && sheetBlob.includes('гарнитуры и комплекты'))) return 'Тумбы ТВ';
    if(blob.includes('тумба под телевизор') || blob.includes('тумбы под телевизор') || blob.includes('тумба тв') || blob.includes('тумбы тв') || blob.includes('тв тумб') || blob.includes('под тв')) return 'Тумбы ТВ';
    if(blob.includes('стеллаж') || blob.includes('этажерк')) return 'Стеллажи и этажерки';
    if(blob.includes('полк')) return 'Полки';
    if(blob.includes('антресол')) return 'Антресоли';
    if(blob.includes('надстрой')) return 'Надстройки';
    if(blob.includes('комод')) return 'Комоды';
    if(blob.includes('шкаф') || blob.includes('пенал') || blob.includes('витрин')) return 'Шкафы';
    return '';
  }

  if(ownerSheet === 'Спальные гарнитуры'){
    // В спальнях не показываем модули прихожих и надстройки; антресоли показываем отдельной плашкой.
    if(blob.includes('прихож') || blob.includes('вешал') || sheetBlob.includes('прихожие и обувницы') || sheetBlob.includes('гардеробные системы и вешалки')) return '';
    if(blob.includes('антресол')) return 'Антресоли';
    if(blob.includes('надстрой')) return blob.includes('надстройка на стол') ? 'Надстройки' : '';
    if(blob.includes('консол') || blob.includes('гример') || blob.includes('туалетн') || blob.includes('макияж') || blob.includes('трюмо')) return 'Гримерные столы';
    if(titleBlob.includes('прикроват') || sheetBlob.includes('прикроватные тумбы')) return 'Тумбы';
    if(blob.includes('кровать') || blob.includes('кроват')) return 'Кровати';
    if(blob.includes('стол письмен') || blob.includes('письменный стол') || blob.includes('компьютерн') || blob.includes('столы') || /(^|\s)стол(\s|$)/.test(blob)) return 'Компьютерные столы';
    // Товар «Шкаф-Полка настенная Ева 1500» должен быть именно в Полках, а не в Шкафах.
    // При этом обычные шкафы «с полками» остаются в Шкафах.
    if(titleBlob.includes('шкаф-полка') || titleBlob.includes('шкаф полка') || titleBlob.includes('полка настенная')) return 'Полки';
    // Шкафы с зеркалом должны оставаться в Шкафах, а не попадать в Зеркала.
    if(titleBlob.includes('шкаф') || sheetBlob.includes('шкафы и буфеты')) return 'Шкафы';
    if(blob.includes('зеркал')) return 'Зеркала';
    if(blob.includes('стеллаж') || blob.includes('этажерк')) return 'Стеллажи и этажерки';
    if(blob.includes('полк')) return 'Полки';
    if(blob.includes('комод')) return 'Комоды';
    if(blob.includes('шкаф') || blob.includes('пенал')) return 'Шкафы';
    return '';
  }

  if(ownerSheet === 'Прихожие и обувницы' || ownerSheet === 'Прихожие'){
    if(titleBlob.includes('тумба тв') || titleBlob.includes('тумбы тв') || titleBlob.includes('под телевизор') || titleBlob.includes('под тв')) return '';
    if(titleBlob.includes('прикроват')) return '';
    // В прихожих не показываем столы/кровати и прочие спальные модули,
    // даже если серия совпадает и название содержит «пенал» или «стеллаж».
    if(blob.includes('стол письмен') || blob.includes('письменный стол') || blob.includes('компьютерн') || blob.includes('гример') || blob.includes('туалетн') || blob.includes('макияж') || blob.includes('трюмо') || /(^|\s)стол(\s|$)/.test(blob)) return '';
    if(blob.includes('кровать') || blob.includes('кроват') || sheetBlob.includes('кровати') || sheetBlob.includes('прикроватные тумбы')) return '';
    // Полноценные модули прихожих/вешалок важнее слов «антресоль», «зеркало» и «шкаф» в названии.
    // Например: «Прихожая с зеркалом ...» и «Прихожая с пеналом и антресолью ...» должны быть в плашке «Прихожие и вешалки».
    if(titleBlob.includes('прихож') || titleBlob.includes('вешал') || sheetBlob.includes('гардеробные системы и вешалки') || sheetBlob.includes('прихожие и обувницы')){
      if(!titleBlob.includes('прихож') && (titleBlob.includes('обувниц') || titleBlob.includes('тумб'))) return 'Тумбы и обувницы';
      return 'Прихожие и вешалки';
    }
    // Пенал-надстройку в прихожих не показываем как шкаф.
    if(titleBlob.includes('пенал') && titleBlob.includes('надстрой')) return '';
    if(titleBlob.includes('антресол') || blob.includes('антресол')) return 'Антресоли';
    // Шкафы с зеркалом должны быть в Шкафах, а не в Зеркалах, если это именно шкаф.
    if(titleBlob.includes('шкаф') || sheetBlob.includes('шкафы и буфеты') || (titleBlob.includes('пенал') && !titleBlob.includes('стеллаж') && !titleBlob.includes('этажерк'))) return 'Шкафы';
    if(titleBlob.includes('зеркал') || sheetBlob === 'зеркала') return 'Зеркала';
    if(titleBlob.includes('стеллаж') || titleBlob.includes('этажерк') || sheetBlob.includes('стеллажи и этажерки')) return 'Стеллажи и этажерки';
    if(titleBlob.includes('комод')) return 'Комоды';
    if(titleBlob.includes('обувниц') || titleBlob.includes('тумб')) return 'Тумбы и обувницы';
    if(titleBlob.includes('антресол') || blob.includes('антресол')) return 'Антресоли';
    if(titleBlob.includes('шкаф') || titleBlob.includes('пенал') || sheetBlob.includes('шкафы и буфеты')) return 'Шкафы';
    return '';
  }

  return rawType || inferBuilderTypeFromItem(linked) || '';
}
function isBuilderModuleAllowed(ownerItem, moduleItem){
  if(!isModularSystemOwner(ownerItem)) return true;
  const allowed = getBuilderAllowedTypesForItem(ownerItem);
  return !!(moduleItem && moduleItem.type && allowed.includes(moduleItem.type));
}

function normalizeKitchenBuilderType(rawType, linked, mod){
  const rawGroup = normBuilderToken(rawType || '');
  const blob = normBuilderToken([
    rawType,
    mod && mod.title,
    mod && mod.module_title,
    mod && mod.module_code,
    linked && linked.t,
    linked && linked.sheet,
    linked && linked.c,
    linked && linked.a && linked.a['Тип модуля'],
    linked && linked.a && linked.a['Тип товара'],
    linked && linked.a && linked.a['Подвид товара']
  ].filter(Boolean).join(' '));

  // Столешницы должны всегда попадать в свой раздел, даже если в исходном пуле тип пришёл ошибочно.
  if(rawGroup.includes('столеш') || blob.includes('столеш')) return 'Столешницы';

  // В Эре тумбы под мойку часто обозначены М400/М500/М600/М800 и могут идти с группой «низ».
  // Поэтому проверяем мойку и М-код ДО общего правила «нижний = шкаф напольный».
  if(rawGroup.includes('под мойку') || blob.includes('под мой') || blob.includes('мойк') || /(^|\s)м\s*\d/.test(blob) || /(^|\s)m\s*\d/.test(blob)) return 'Тумбы под мойку';

  if(rawGroup === 'верх' || rawGroup.includes('верхн')) return 'Шкафы навесные';
  if(rawGroup === 'низ' || rawGroup.includes('нижн')) return 'Шкафы напольные';
  if(blob.includes('пенал')) return 'Пеналы';
  if(blob.includes('плит') || blob.includes('духов')) return 'Шкафы для плиты';
  if(blob.includes('навес') || blob.includes('верх') || blob === 'верх' || /(^|\s)в\d/.test(blob)) return 'Шкафы навесные';
  if(blob.includes('напол') || blob.includes('нижн') || blob === 'низ' || /(^|\s)н\d/.test(blob) || /(^|\s)стол($|\s)/.test(blob) || blob.includes('рабоч')) return 'Шкафы напольные';
  if(blob.includes('стенов') || blob.includes('панел') || blob.includes('фурнит') || blob.includes('комплект') || blob.includes('цокол') || blob.includes('карниз') || blob.includes('планк') || blob.includes('сушк')) return 'Комплектующие';
  return 'Комплектующие';
}

function getBuilderSimpleColor(linked, raw){
  const attrs = (linked && linked.a) || {};
  const rawAttrs = (raw && raw.a) || {};
  // Для фильтра "Цвет" используем простой цвет из каталога,
  // а не длинные технические названия. Для псевдо-модулей Агавы цвет приходит в raw.color.
  return String(
    (linked && linked.col) ||
    (raw && raw.color) ||
    attrs['Основной цвет'] ||
    attrs['Цвет'] ||
    rawAttrs['Основной цвет'] ||
    rawAttrs['Цвет'] ||
    rawAttrs['Цвет от производителя'] ||
    ''
  ).trim();
}

function shouldModuleDimsBeMm(rawW, rawH, rawD, linked, raw, ownerItem){
  if(dimsLookLikeMm(rawW, rawH, rawD)) return true;
  const ownerSheet = String((ownerItem && (ownerItem.sheet || ownerItem.c || '')) || '').trim();
  const rawIsKitchenComp = !!(raw && (raw._from_comp || raw.comp_owner_id || String(raw.item_id || '').indexOf('comp:') === 0));
  // Псевдо-модули кухонь из состава часто приходят как 400/600/1600 мм.
  // Если нет живой карточки из каталога, переводим их в 40/60/160 см для показа и калькулятора.
  if(ownerSheet === 'Кухни' && rawIsKitchenComp && !linked) return true;
  return false;
}
function moduleDimToCm(value, useMm){
  if(value === undefined || value === null || String(value).trim() === '') return null;
  const n = Number(value);
  if(!Number.isFinite(n)) return value;
  const out = useMm ? (n / 10) : n;
  return Math.round(out * 10) / 10;
}
function formatModuleDims(m){
  if(!m) return '';
  const parts = [m.width, m.height, m.depth]
    .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
    .map(v => formatCmNumber(v));
  return parts.length ? (parts.join('×') + ' см') : '';
}

function normModuleMsgToken(v){
  return String(v || '').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/gi,' ').replace(/\s+/g,' ').trim();
}
function cleanModuleMsgValue(v){
  let s = String(v || '').trim();
  if(!s) return '';
  s = s.replace(/\s+/g,' ');
  // В некоторых строках связки цвет кровати приходит как «Белый 160» — для сообщения оставляем понятный цвет.
  s = s.replace(/\s+(90|120|140|160|180|200)$/i, '').trim();
  return s;
}
function getModuleComparableModel(it){
  if(!it) return '';
  const a = it.a || {};
  const explicit = a['Название модели'] || a['Модель'] || '';
  if(explicit) return normModuleMsgToken(explicit);
  const title = String(it.t || '').replace(/ё/g,'е');
  // Для комодов Эко К800 / К800 3/2 в исходных карточках модель может быть не заполнена.
  // Группируем их по базовой модели К800, чтобы отличать 4 и 5 ящиков.
  if(/Комод\s+К800/i.test(title)) return normModuleMsgToken('К800');
  return '';
}
function getComparableModuleVariantItems(linkedItem){
  if(!linkedItem) return [];
  const a = linkedItem.a || {};
  const model = getModuleComparableModel(linkedItem);
  if(!model) return [];
  const w = String(linkedItem.w ?? '').trim();
  const h = String(linkedItem.h ?? '').trim();
  const d = String(linkedItem.d ?? '').trim();
  const factory = normModuleMsgToken(linkedItem.f || '');
  const sheet = normModuleMsgToken(linkedItem.sheet || linkedItem.c || '');
  return (Array.isArray(CATALOG) ? CATALOG : []).filter(x => {
    if(!x || !x.a) return false;
    const xa = x.a || {};
    if(factory && normModuleMsgToken(x.f || '') !== factory) return false;
    if(sheet && normModuleMsgToken(x.sheet || x.c || '') !== sheet) return false;
    if(getModuleComparableModel(x) !== model) return false;
    if(String(x.w ?? '').trim() !== w) return false;
    if(String(x.h ?? '').trim() !== h) return false;
    if(String(x.d ?? '').trim() !== d) return false;
    return true;
  });
}
function shouldShowModuleVariantField(linkedItem, field){
  if(!linkedItem || !field) return false;
  const current = cleanModuleMsgValue((linkedItem.a || {})[field]);
  if(!current) return false;
  const items = getComparableModuleVariantItems(linkedItem);
  if(items.length < 2) return false;
  const values = new Set();
  items.forEach(x => {
    const val = cleanModuleMsgValue((x.a || {})[field]);
    if(val) values.add(normModuleMsgToken(val));
  });
  return values.size > 1;
}
function addDedupModuleDetail(parts, seen, label, value){
  const val = cleanModuleMsgValue(value);
  if(!val) return;
  const valKey = normModuleMsgToken(val);
  // Не добавляем составные поля, если их части уже добавлены: например
  // «С зеркалом · С полками и штангой» после отдельных «С зеркалом» и «С полками и штангой».
  if(val.split('·').some(part => seen.has(normModuleMsgToken(part)))) return;
  const key = normModuleMsgToken((label ? label + ' ' : '') + val);
  if(seen.has(key) || seen.has(valKey)) return;
  seen.add(key); seen.add(valKey);
  parts.push(label ? (label + ': ' + val) : val);
}
function getModuleMessageDetails(m, linkedItem){
  const a = (linkedItem && linkedItem.a) || {};
  const parts = [];
  const seen = new Set();
  const add = (label, value) => addDedupModuleDetail(parts, seen, label, value);
  const addPlain = (value) => addDedupModuleDetail(parts, seen, '', value);

  const color = a['Цвет от производителя'] || a['Цвет производителя'] || a['Основной цвет'] || a['Цвет'] || (linkedItem && linkedItem.col) || (m && m.color) || '';
  add('цвет', color);

  if(linkedItem){
    // Дополнительные отличия пишем только когда они реально различают товары
    // одной модели и одного размера. Поэтому у обычных тумб/кроватей остаётся только цвет,
    // а у Дуэт/Адель/Трио/Квадро появляются зеркало/наполнение.
    ['Зеркало','Наполнение','Исполнение','Количество ящиков','Что есть у товара'].forEach(field => {
      if(shouldShowModuleVariantField(linkedItem, field)) addPlain(a[field]);
    });
  } else {
    // Для модулей без живой карточки можно оставить короткую подпись из связки,
    // но тоже без повторов.
    const variantLabel = String((m && m.variantLabel) || '').trim();
    if(variantLabel){
      variantLabel.split('·').map(x=>x.trim()).filter(Boolean).forEach(addPlain);
    }
  }

  // V41_34: для доп-опции с выбором варианта (куб Мэнкс) — пишем выбранный цвет в деталь/сообщение
  if(linkedItem && typeof shouldShowSeatOption==='function' && shouldShowSeatOption(linkedItem) && isSeatOptionOn(linkedItem.id)){
    const sopt = getSeatOption(linkedItem.id);
    if(sopt && getSeatVariants(sopt)){
      const vcol = getSeatVariantColor(sopt, linkedItem.id);
      if(vcol) addPlain((sopt.optBadge || 'Куб') + ': ' + vcol);
    }
  }

  return parts.join('; ');
}


function renderModuleCardDetailsHtml(details){
  const raw = String(details || '').trim();
  if(!raw) return '';
  const parts = raw.split(';').map(x=>x.trim()).filter(Boolean);
  if(!parts.length) return '';
  const colorIdx = parts.findIndex(x => /^цвет\s*:/i.test(x));
  const color = colorIdx >= 0 ? parts[colorIdx] : '';
  const others = parts.filter((_,i)=>i!==colorIdx);
  const rows = [];
  if(color){
    const v = color.replace(/^цвет\s*:\s*/i,'').trim();
    rows.push(`<div class="kitCard-detail-line color"><b>цвет:</b> ${esc(v)}</div>`);
  }
  if(others.length){
    rows.push(`<div class="kitCard-detail-line extra">${esc(others.join(' · '))}</div>`);
  }
  return rows.length ? `<div class="kitCard-details">${rows.join('')}</div>` : '';
}
function getProductVkMessageDetailLines(it){
  if(!it) return [];
  const a = it.a || {};
  const parts = [];
  const seen = new Set();
  const add = (label, value) => addDedupModuleDetail(parts, seen, label, value);
  const addPlain = (value) => addDedupModuleDetail(parts, seen, '', value);

  // В основных карточках цвет нужен всегда: гостиные, спальни, комоды, прихожие, шкафы и т.д.
  const color = a['Цвет от производителя'] || a['Цвет производителя'] || a['Основной цвет'] || a['Цвет'] || it.col || '';
  add('Цвет', color);

  // Дополнительные отличия показываем только если у этой же модели и этого же размера
  // есть несколько вариантов. Так обычные товары не перегружаются лишними словами,
  // а шкафы Дуэт/Адель/Трио/Квадро становятся понятными до переписки.
  if(shouldShowModuleVariantField(it, 'Зеркало')){
    add('Исполнение', a['Зеркало']);
  }
  if(shouldShowModuleVariantField(it, 'Наполнение')){
    add('Наполнение', a['Наполнение']);
  }
  if(shouldShowModuleVariantField(it, 'Количество ящиков')){
    add('Ящики', a['Количество ящиков']);
  }
  if(shouldShowModuleVariantField(it, 'Что есть у товара')){
    add('Особенности', a['Что есть у товара']);
  }
  if(shouldShowModuleVariantField(it, 'Исполнение')){
    add('Исполнение', a['Исполнение']);
  }

  return parts.map(x => '• ' + x);
}
function formatModuleMessageLine(qty, m){
  const linkedItem = m && m.id ? findItemById(m.id) : null;
  const title = (m && m.title) || '—';
  const details = getModuleMessageDetails(m, linkedItem);
  let unitPrice = linkedItem ? getBedCardDisplayPrice(linkedItem, m.price) : Number((m && m.price) || 0);
  // V40_133: если у тумбы выбрано «с мягким сиденьем» — добавляем суффикс и плюсуем цену
  let seatSuffix = '';
  if(linkedItem && typeof shouldShowSeatOption === 'function' && shouldShowSeatOption(linkedItem) && isSeatOptionOn(linkedItem.id)){
    const opt = getSeatOption(linkedItem.id);
    if(opt){
      seatSuffix = (opt.optInline||' (С мягким сиденьем)');
      unitPrice = (Number(unitPrice) || 0) + (Number(opt.seatPrice) || 0);
    }
  }
  const priceTotal = (Number(unitPrice)||0) * qty;
  const detailTxt = details ? ` (${details})` : '';
  if(priceTotal){
    return `• ${title}${detailTxt}${seatSuffix} ×${qty} — ${priceTotal.toLocaleString('ru-RU')} ₽`;
  }
  return `• ${title}${detailTxt}${seatSuffix} ×${qty}`;
}
function formatMaybeMmWidthCm(value){
  if(value === undefined || value === null || String(value).trim() === '') return '';
  const n = Number(value);
  if(!Number.isFinite(n)) return String(value) + ' см';
  const cm = n >= 450 ? (n / 10) : n;
  return formatCmNumber(cm) + ' см';
}


function getWardrobeVariantLabelForItem(it){
  if(!it || !it.a) return '';
  const model = String(it.a['Название модели'] || '').trim();
  const factory = String(it.f || '').trim();
  if(factory !== 'Эра' || !['Адель','Дуэт','Трио','Квадро'].includes(model)) return '';
  const parts = [];
  const mirror = String(it.a['Зеркало'] || '').trim();
  const filling = String(it.a['Наполнение'] || '').trim();
  if(mirror && ['Дуэт','Трио','Квадро'].includes(model)) parts.push(mirror);
  if(filling && ['Адель','Дуэт'].includes(model)) parts.push(filling);
  return parts.join(' · ');
}
function normalizeModule(m, ownerItem){
  const linked = findItemById_Soft(m.avito_id || m.item_id);
  const ownerSheet = String((ownerItem && (ownerItem.sheet || ownerItem.c || '')) || '').trim();
  const type = ownerSheet === 'Кухни'
    ? normalizeKitchenBuilderType(m.type || '', linked, m)
    : (normalizeSystemBuilderType(m.type || '', linked, m, ownerSheet) || (isModularSystemOwner(ownerItem) ? '' : (m.type || inferBuilderTypeFromItem(linked) || '')));
  const rawW = m.width || (linked && linked.w) || null;
  const rawH = m.height || (linked && linked.h) || null;
  const rawD = m.depth || (linked && linked.d) || null;
  const useMm = shouldModuleDimsBeMm(rawW, rawH, rawD, linked, m, ownerItem);
  const rawStockQty = getRawModuleStockQty(m);
  const linkedStockQty = linked ? Math.max(0, Number(linked._stockQty) || 0) : 0;
  const stockQty = linked ? linkedStockQty : rawStockQty;
  return {
    id: (linked && linked.id) || m.avito_id || m.item_id || '',
    title: (linked && linked.t) || m.title || '',
    price: (linked && linked.p) || m.price || null,
    photo: (linked && linked.img) || m.photo || '',
    type: type,
    width: moduleDimToCm(rawW, useMm),
    height: moduleDimToCm(rawH, useMm),
    depth: moduleDimToCm(rawD, useMm),
    factory: m.factory || (linked && linked.f) || '',
    color: getBuilderSimpleColor(linked, m),
    variantLabel: getWardrobeVariantLabelForItem(linked),
    inStock: !!((linked && linked._inStock) || rawStockQty > 0),
    stockQty: stockQty,
    linked: !!linked,
    _raw: m
  };
}

function inferBuilderTypeFromItem(linked){
  if(!linked) return '';
  const sh = String(linked.sheet || linked.c || '').trim();
  const sub = String((linked.a && (linked.a['Подвид товара'] || linked.a['Вид товара'])) || '').trim();
  const blob = normBuilderToken([linked.t, sh, sub].filter(Boolean).join(' '));
  if(sh === 'Прихожие и обувницы' || blob.includes('прихож')) return 'Прихожие и вешалки';
  if(sh === 'Шкафы и буфеты' || blob.includes('шкаф')) return 'Шкафы';
  if(sh === 'Комоды и тумбы' || blob.includes('комод')) return 'Комоды';
  if(sh === 'Тумбы под телевизор' || blob.includes('тумба под тв')) return 'Тумбы ТВ';
  if(sh === 'Стеллажи и этажерки') return 'Стеллажи и этажерки';
  if(sh === 'Полки') return 'Полки';
  if(sh === 'Зеркала') return 'Зеркала';
  if(sh === 'Столы' || blob.includes('стол')) return 'Компьютерные столы';
  if(sh === 'Кровати' || blob.includes('кровать')) return 'Кровати';
  if(sh === 'Прикроватные тумбы') return 'Прикроватные тумбы';
  return sh || sub || '';
}

function isAgavaKitchenItem(it){
  return String((it && (it.sheet || it.c || '')) || '').trim() === 'Кухни' && getExpectedBuilderSeries(it) === 'агава';
}
function getKitchenDisplayColor(it){
  const a = (it && it.a) || {};
  // Для кухонь Агава важна именно расцветка фасада из прайса, а не простой цвет Авито.
  if(isAgavaKitchenItem(it)){
    return String(a['Цвет от производителя'] || a['Цвет производителя'] || a['Цвет'] || a['Основной цвет'] || (it && it.col) || '').trim();
  }
  return String((it && it.col) || a['Основной цвет'] || a['Цвет'] || a['Цвет от производителя'] || '').trim();
}
function normalizeAgavaBuilderColor(value){
  const s = String(value || '').trim();
  const map = {
    'Акация белая-аква':'Аква', 'Акация белая/Аква':'Аква',
    'Акация белая-моренга':'Моренга', 'Акация белая/Моренга':'Моренга', 'моренга':'Моренга',
    'Акация белая-сапфир':'Сапфир', 'Акация белая/Сапфир':'Сапфир', 'сапфир':'Сапфир',
    'Акация белая-мята':'Мята', 'Акация белая/Мята':'Мята',
    'светлая':'Лиственница светлая', 'темная':'Лиственница темная'
  };
  return map[s] || s;
}
function getAgavaKitchenItems(){
  return (window.CATALOG || []).filter(x => isAgavaKitchenItem(x));
}
function makeCompPseudoId(ownerId, row, idx){
  const title = String((row && (row.module_title || row.module_code || row.module_art)) || 'Модуль');
  return 'comp:' + String(ownerId || '') + ':' + String((row && row.order) || idx || 0) + ':' + title;
}

function normAgavaModuleCode(v){
  return String(v || '')
    .toUpperCase()
    .replace(/Ё/g,'Е')
    .replace(/\s+/g,'')
    .replace(/-([0-9])Я/g,'-$1Я')
    .trim();
}
function agavaCodeMatches(needle, candidate){
  const n = normAgavaModuleCode(needle);
  const c = normAgavaModuleCode(candidate);
  if(!n || !c) return false;
  if(n === c) return true;
  const cParts = c.split('/').map(normAgavaModuleCode).filter(Boolean);
  const nParts = n.split('/').map(normAgavaModuleCode).filter(Boolean);
  return cParts.includes(n) || nParts.includes(c) || nParts.some(x => cParts.includes(x));
}
function extractAgavaModuleCodeFromCompRow(row){
  const raw = String((row && (row.module_title || row.module_code || row.title)) || '').toUpperCase().replace(/Ё/g,'Е');
  const m = raw.match(/(ВВУС|ВВС|ВВУ|ВУС|ВС|ВУ|ВВ|В|НПМ|НПЛ|НУ|Н|М|ПВ|П)\s*-?\s*(\d{3,4})(?:\s*-?\s*(\d)\s*Я)?\s*(Д)?/);
  if(!m) return '';
  let code = m[1] + m[2];
  if(m[3]) code += '-' + m[3] + 'Я';
  if(m[4]) code += 'Д';
  return normAgavaModuleCode(code);
}
function getStockQtyByArt(art){
  const key = normArt(art);
  if(!key || !STOCK.loaded || !STOCK.map) return 0;
  return Object.prototype.hasOwnProperty.call(STOCK.map, key) ? Math.max(0, Number(STOCK.map[key]) || 0) : 0;
}
function getRawModuleStockQty(raw){
  if(!STOCK.loaded || !raw) return 0;
  const arts = Array.isArray(raw.component_arts) ? raw.component_arts : [];
  if(arts.length){
    let minQty = Infinity;
    for(const art of arts){
      const key = normArt(art);
      if(!key) return 0;
      minQty = Math.min(minQty, getStockQtyByArt(key));
    }
    return Number.isFinite(minQty) ? Math.max(0, minQty) : 0;
  }
  const singleArt = raw.supplier_art || raw.art || raw.module_art || '';
  return singleArt ? getStockQtyByArt(singleArt) : 0;
}

function augmentBuilderPoolWithComposition(it, pool){
  const src = Array.isArray(pool) ? pool.slice() : [];
  const comp = getKitchenCompRowsForItem(it);
  const seen = new Set(src.map(row => String((row && (row.avito_id || row.item_id)) || '').trim()).filter(Boolean));
  const ownerColor = getKitchenDisplayColor(it);
  comp.forEach((row, idx) => {
    const rowId = String((row && (row.module_avito_id || row.module_item_id || row.avito_id || row.item_id)) || '').trim();
    if(rowId && seen.has(rowId)) return;
    const linked = findItemById_Soft(rowId);
    const title = (linked && linked.t) || row.module_title || row.module_code || row.module_art || 'Модуль';
    const pseudoId = rowId || makeCompPseudoId(it && it.id, row, idx);
    src.unshift({
      item_id: pseudoId,
      avito_id: rowId || '',
      title: title,
      price: (linked && linked.p) || row.matched_price || row.price || null,
      photo: (linked && linked.img) || row.matched_photo || row.photo || '',
      supplier_art: row.module_art || row.module_code || '',
      type: row.group || inferBuilderTypeFromItem(linked) || '',
      width: (linked && linked.w) || row.width || null,
      height: (linked && linked.h) || row.height || null,
      depth: (linked && linked.d) || row.depth || null,
      factory: (linked && linked.f) || row.module_factory || '',
      color: getBuilderSimpleColor(linked, {color: ownerColor, a:{'Цвет': ownerColor}}),
      sheet: (linked && linked.sheet) || '',
      category: (linked && linked.c) || '',
      comp_owner_id: String(it && it.id || ''),
      comp_order: row.order || idx,
      comp_title: String(row.module_title || row.module_code || title || '').toLowerCase().trim(),
      component_arts: Array.isArray(row.component_arts) ? row.component_arts : [],
      component_prices: Array.isArray(row.component_prices) ? row.component_prices : []
    });
    if(rowId) seen.add(rowId);
    else seen.add(pseudoId);
  });
  return src;
}

function augmentKitchenPoolWithFamilyModules(it, pool){
  const sh = String((it && (it.sheet || it.c || '')) || '').trim();
  if(sh !== 'Кухни') return Array.isArray(pool) ? pool.slice() : [];
  const src = Array.isArray(pool) ? pool.slice() : [];
  const expected = getExpectedBuilderSeries(it);
  if(!expected) return src;
  const seen = new Set(src.map(row => String((row && (row.avito_id || row.item_id)) || '').trim()).filter(Boolean));
  (window.CATALOG || []).forEach(rowItem => {
    if(!rowItem) return;
    const rowSheet = String((rowItem.sheet || rowItem.c || '') || '').trim();
    if(rowSheet !== 'Кухонные модули') return;
    const rowSeries = getBuilderMultiTail(rowItem.mu) || getBuilderModelName(rowItem) || '';
    if(rowSeries !== expected) return;
    const rowId = String((rowItem.id || rowItem.avito_id || rowItem.avito || '') || '').trim();
    if(!rowId || seen.has(rowId)) return;
    src.push({
      item_id: rowId,
      avito_id: rowId,
      title: rowItem.t || 'Модуль',
      price: rowItem.p || null,
      photo: rowItem.img || '',
      supplier_art: rowItem.supplier_art || '',
      type: inferBuilderTypeFromItem(rowItem) || '',
      width: rowItem.w || null,
      height: rowItem.h || null,
      depth: rowItem.d || null,
      factory: rowItem.f || '',
      color: getBuilderSimpleColor(rowItem, null),
      sheet: rowItem.sheet || '',
      category: rowItem.c || ''
    });
    seen.add(rowId);
  });
  return src;
}


function makeBuilderRowFromKitchenComp(row, fallbackType){
  const rowId = String(row.module_avito_id || row.module_item_id || '').trim();
  const rowItem = rowId ? findItemById_Soft(rowId) : null;
  const title = (rowItem && rowItem.t) || row.module_title || row.module_code || row.module_art || fallbackType || 'Модуль';
  const price = Number((rowItem && rowItem.p) || row.matched_price || row.price || 0) || null;
  return {
    item_id: rowId || ('comp:' + String(row.kitchen_key || '') + ':' + String(row.order || '') + ':' + title),
    avito_id: rowId,
    title: title,
    price: price,
    photo: (rowItem && rowItem.img) || row.matched_photo || '',
    supplier_art: row.module_art || row.module_code || '',
    type: row.group || row.module_type || fallbackType || '',
    width: (rowItem && rowItem.w) || row.width || null,
    height: (rowItem && rowItem.h) || row.height || null,
    depth: (rowItem && rowItem.d) || row.depth || null,
    factory: (rowItem && rowItem.f) || row.module_factory || '',
    color: row.color || getBuilderSimpleColor(rowItem, null),
    sheet: (rowItem && rowItem.sheet) || 'Кухонные модули',
    category: (rowItem && rowItem.c) || 'Кухонные модули',
    comp_owner_id: String(row.kitchen_key || ''),
    comp_order: row.order || 0,
    comp_title: String(row.module_title || row.module_code || title || '').toLowerCase().trim(),
    component_arts: Array.isArray(row.component_arts) ? row.component_arts : [],
    component_prices: Array.isArray(row.component_prices) ? row.component_prices : [],
    _from_comp: true
  };
}

function augmentAgavaPoolWithAllColorModules(it, pool){
  if(!isAgavaKitchenItem(it)) return Array.isArray(pool) ? pool.slice() : [];

  // Для Агавы клиент должен видеть готовые модули, а не отдельные корпус/фасад.
  // Поэтому убираем старые псевдо-строки состава комплекта из конструктора
  // и добавляем полный пул 66 модулей на каждую расцветку из __AGAVA_MODULES__.
  const src = (Array.isArray(pool) ? pool.slice() : []).filter(row => {
    // Для Агавы в конструкторе показываем только готовые кухонные модули.
    // Столешница учитывается в составе/цене комплекта, но не должна попадать в «Собрать из модулей».
    if(row && row.comp_owner_id) return false;
    const blob = normBuilderToken([row && row.type, row && row.title, row && row.module_title].filter(Boolean).join(' '));
    return !blob.includes('столеш');
  });
  const seen = new Set(src.map(row => String((row && (row.item_id || row.avito_id)) || '').trim()).filter(Boolean));
  const data = window.__AGAVA_MODULES__ && window.__AGAVA_MODULES__.colors ? window.__AGAVA_MODULES__.colors : {};
  Object.keys(data).forEach(color => {
    const rows = Array.isArray(data[color]) ? data[color] : [];
    rows.forEach((row, idx) => {
      const built = Object.assign({}, row);
      built.color = normalizeAgavaBuilderColor(color);
      built.agava_owner_id = String(it && it.id || '');
      built.comp_order = Number(row.sort || idx || 0);
      built.comp_title = String(row.title || row.agava_module_code || '').toLowerCase().trim();
      const key = String(built.item_id || built.avito_id || '').trim();
      if(key && seen.has(key)) return;
      src.push(built);
      if(key) seen.add(key);
    });
  });
  return src;
}

function augmentKitchenPoolWithCountertops(it, pool){
  const sh = String((it && (it.sheet || it.c || '')) || '').trim();
  if(sh !== 'Кухни') return Array.isArray(pool) ? pool.slice() : [];
  const src = Array.isArray(pool) ? pool.slice() : [];
  // Для Агавы столешница Антарес должна быть привязана в составе комплекта,
  // а в модульном конструкторе доступны обе реальные столешницы: Антарес и Дымчатый кварц.
  const seen = new Set(src.map(row => String((row && (row.avito_id || row.item_id)) || '').trim()).filter(Boolean));
  const ownerId = String(it && it.id || '');
  const rawRows = ((window.__KITCHEN_COMP__ || {})[ownerId] || []);
  const explicitTopRows = rawRows.filter(row => {
    const blob = normBuilderToken([row.group, row.module_title, row.module_code, row.module_type].filter(Boolean).join(' '));
    return blob.includes('столеш');
  });
  if(explicitTopRows.length){
    explicitTopRows.forEach(row => {
      const built = makeBuilderRowFromKitchenComp(row, 'Столешницы');
      const key = String(built.avito_id || built.item_id || '').trim();
      if(key && seen.has(key)) return;
      src.push(built);
      if(key) seen.add(key);
    });
  }
  if(!kitchenNeedsCountertop(it)) return src;
  // Показываем все доступные типы столешниц из каталога, даже если в связке уже есть одна столешница.
  // Так в кухнях Эра отображаются оба варианта: «Антарес» и «Дымчатый кварц».
  (window.CATALOG || []).forEach(rowItem => {
    if(!rowItem) return;
    const blob = normBuilderToken([rowItem.t, rowItem.c, rowItem.sheet].filter(Boolean).join(' '));
    if(!blob.includes('столеш')) return;
    const rowId = String(rowItem.id || '').trim();
    if(!rowId || seen.has(rowId)) return;
    src.push({
      item_id: rowId,
      avito_id: rowId,
      title: rowItem.t || 'Столешница',
      price: rowItem.p || null,
      photo: rowItem.img || '',
      supplier_art: rowItem.art || '',
      type: 'Столешницы',
      width: rowItem.w || null,
      height: rowItem.h || null,
      depth: rowItem.d || null,
      factory: rowItem.f || '',
      color: getBuilderSimpleColor(rowItem, null),
      sheet: rowItem.sheet || '',
      category: rowItem.c || ''
    });
    seen.add(rowId);
  });
  return src;
}

function augmentSystemPoolWithFamilyModules(it, pool){
  if(!isModularSystemOwner(it)) return Array.isArray(pool) ? pool.slice() : [];
  const src = Array.isArray(pool) ? pool.slice() : [];
  const expected = getExpectedBuilderSeries(it);
  if(!expected) return src;
  const ownerSheet = String((it && (it.sheet || it.c || '')) || '').trim();
  const ownerFactory = normBuilderToken(it && it.f);
  const seen = new Set(src.map(row => String((row && (row.avito_id || row.item_id)) || '').trim()).filter(Boolean));

  (window.CATALOG || []).forEach(rowItem => {
    if(!rowItem) return;
    const rowId = String((rowItem.id || rowItem.avito_id || rowItem.avito || '') || '').trim();
    if(!rowId || rowId === String(it.id || '') || seen.has(rowId)) return;

    const rowSeries = getBuilderMultiTail(rowItem.mu) || getBuilderModelName(rowItem) || '';
    if(rowSeries !== expected) return;
    const rowFactory = normBuilderToken(rowItem.f || '');
    if(ownerFactory && rowFactory && rowFactory !== ownerFactory) return;

    const rowSheet = String((rowItem.sheet || rowItem.c || '') || '').trim();
    const titleNorm = normBuilderToken(rowItem.t || '');

    // Не добавляем другие готовые комплекты как "модули", кроме центральных секций известных серий.
    // Полные связки Пекин 7931192275 и 7931510478 в конструктор не добавляем.
    const isEraPekinCenter = ownerSheet === 'Гарнитуры и комплекты' && expected === 'пекин' && rowSheet === 'Гарнитуры и комплекты' && ['7931333056','7931197750'].includes(rowId);
    // Центр-секции Сидней-1 (Микон): тоже разрешаем как модули серии.
    const isMikonSidney1Center = ownerSheet === 'Гарнитуры и комплекты' && rowSheet === 'Гарнитуры и комплекты' && ['8090993271','8090947506','8091649514'].includes(rowId);
    if((rowSheet === 'Гарнитуры и комплекты' && !isEraPekinCenter && !isMikonSidney1Center) || rowSheet === 'Спальные гарнитуры') return;
    // Для гостиных не подмешиваем прихожие и вешалки одноимённой серии.
    if(ownerSheet === 'Гарнитуры и комплекты' && (rowSheet === 'Прихожие и обувницы' || rowSheet === 'Прихожие' || titleNorm.includes('прихож') || titleNorm.includes('вешал'))) return;
    if((ownerSheet === 'Прихожие и обувницы' || ownerSheet === 'Прихожие') && titleNorm.includes('модульная прихожая')) return;

    const raw = {
      item_id: rowId,
      avito_id: rowId,
      title: rowItem.t || 'Модуль',
      price: rowItem.p || null,
      photo: rowItem.img || '',
      supplier_art: rowItem.supplier_art || rowItem.art || '',
      type: inferBuilderTypeFromItem(rowItem) || '',
      width: rowItem.w || null,
      height: rowItem.h || null,
      depth: rowItem.d || null,
      factory: rowItem.f || '',
      color: getBuilderSimpleColor(rowItem, null),
      sheet: rowSheet,
      category: rowItem.c || ''
    };

    // Добавляем только то, что после нормализации реально разрешено для текущей системы.
    const normalizedType = normalizeSystemBuilderType(raw.type || '', rowItem, raw, ownerSheet);
    if(!normalizedType || !getBuilderAllowedTypesForItem(it).includes(normalizedType)) return;

    raw.type = normalizedType;
    src.push(raw);
    seen.add(rowId);
  });
  return src;
}

function renderKitPool(it){
  const box=document.getElementById('mKitPool');
  if(!box) return;
  const rawPool = (window.__KITCHEN_POOL__ || {})[String(it.id)] || [];
  const pool = filterBuilderPoolForItem(it, augmentSystemPoolWithFamilyModules(it, augmentKitchenPoolWithCountertops(it, augmentAgavaPoolWithAllColorModules(it, augmentKitchenPoolWithFamilyModules(it, augmentBuilderPoolWithComposition(it, filterBuilderPoolForItem(it, rawPool)))))));
  if(!pool || !pool.length){
    box.style.display='none';
    BUILDER.ownerId = null;
    BUILDER.pool = [];
    hideCalcPanel();
    return;
  }

  BUILDER.ownerId = String(it.id);
  BUILDER.pool = pool.map(m => normalizeModule(m, it)).filter(m => isBuilderModuleAllowed(it, m));
  if(!BUILDER.pool.length){
    box.style.display='none';
    BUILDER.ownerId = null;
    BUILDER.pool = [];
    hideCalcPanel();
    return;
  }
  try{ if(window.statsTrack) statsTrack('open_builder', { id: it.id, t: it.t, c: it.c, modules: BUILDER.pool.length }); }catch(_){}
  restoreBuilderSession(BUILDER.ownerId);
  if(BUILDER.typeFilter !== '__all__' && !BUILDER.pool.some(m => m.type === BUILDER.typeFilter)) BUILDER.typeFilter = '__all__';

  // Рендерим табы типов — уникальные type из пула + подсчёт
  const typeCounts = {};
  BUILDER.pool.forEach(m => { const t=m.type||''; typeCounts[t]=(typeCounts[t]||0)+1; });
  const preferredOrder = getBuilderTypeOrderForItem(it);
  const orderMap = new Map(preferredOrder.map((name, idx)=>[name, idx]));
  const typesOrdered = Object.keys(typeCounts).sort((a,b)=>{
    const oa = orderMap.has(a) ? orderMap.get(a) : 999;
    const ob = orderMap.has(b) ? orderMap.get(b) : 999;
    if(oa !== ob) return oa - ob;
    if((typeCounts[b]||0) !== (typeCounts[a]||0)) return (typeCounts[b]||0) - (typeCounts[a]||0);
    return String(a).localeCompare(String(b),'ru');
  });
  const tabsBox = document.getElementById('mBuilderTypeTabs');
  const allTab = `<div class="builderTab ${BUILDER.typeFilter==='__all__'?'on':''}" data-t="__all__">Все <span style="opacity:.7">${BUILDER.pool.length}</span></div>`;
  tabsBox.innerHTML = allTab + typesOrdered.map(t =>
    `<div class="builderTab ${BUILDER.typeFilter===t?'on':''}" data-t="${esc(t)}">${esc(t)} <span style="opacity:.7">${typeCounts[t]}</span></div>`
  ).join('');
  tabsBox.querySelectorAll('.builderTab').forEach(tab => {
    tab.addEventListener('click', () => {
      const nextType = tab.dataset.t;
      const changedType = BUILDER.typeFilter !== nextType;
      BUILDER.typeFilter = nextType;
      if(changedType){ BUILDER.w=''; BUILDER.h=''; BUILDER.d=''; }
      tabsBox.querySelectorAll('.builderTab').forEach(x => x.classList.toggle('on', x===tab));
      rebuildBuilderFilterSelects();
      saveBuilderSession();
      renderBuilderGrid();
    });
  });

  // Первоначальный рендер
  rebuildBuilderFilterSelects();

  const wSel = document.getElementById('mBuilderWidth');
  const hSel = document.getElementById('mBuilderHeight');
  const dSel = document.getElementById('mBuilderDepth');
  const cSel = document.getElementById('mBuilderColor');
  const stockBox = document.getElementById('mBuilderInStock');
  if(wSel) wSel.value = BUILDER.w || '';
  if(hSel) hSel.value = BUILDER.h || '';
  if(dSel) dSel.value = BUILDER.d || '';
  if(cSel) cSel.value = BUILDER.color || '';
  if(stockBox) stockBox.checked = !!BUILDER.inStock;

  // Обработчики фильтров
  // Размеры работают в режиме одного активного приоритета:
  // выбрали ширину — высота и глубина сбрасываются;
  // выбрали высоту — ширина и глубина сбрасываются;
  // выбрали глубину — ширина и высота сбрасываются.
  // Цвет при этом не сбрасываем.
  function applyBuilderSizePriority(axis, value){
    const val = value || '';
    if(axis === 'w'){
      BUILDER.w = val;
      if(val){ BUILDER.h = ''; BUILDER.d = ''; }
    } else if(axis === 'h'){
      BUILDER.h = val;
      if(val){ BUILDER.w = ''; BUILDER.d = ''; }
    } else if(axis === 'd'){
      BUILDER.d = val;
      if(val){ BUILDER.w = ''; BUILDER.h = ''; }
    }
    rebuildBuilderFilterSelects();
    saveBuilderSession();
    renderBuilderGrid();
  }
  wSel.onchange = () => applyBuilderSizePriority('w', wSel.value);
  hSel.onchange = () => applyBuilderSizePriority('h', hSel.value);
  dSel.onchange = () => applyBuilderSizePriority('d', dSel.value);
  if(cSel) cSel.onchange = () => { BUILDER.color = cSel.value; saveBuilderSession(); renderBuilderGrid(); };
  stockBox.onchange = () => { BUILDER.inStock = stockBox.checked; saveBuilderSession(); renderBuilderGrid(); };

  // Кнопки «Взять состав комплекта» / «Очистить»
  const fillBtn  = document.getElementById('mFillKit');
  const clearBtn = document.getElementById('mClearBuilder');
  if(clearBtn) clearBtn.style.display = 'none';
  if(fillBtn)  fillBtn.onclick  = () => {
    const ownerForComp = findItemById_Soft(BUILDER.ownerId || '');
    const comp = getKitchenCompRowsForItem(ownerForComp);
    if(!comp.length){ showToast('Состав комплекта не найден'); return; }
    // Берём только активные варианты из «Состав комплекта».
    // Если в одной карточке объединены кровати 120/140/160, стол левый/правый
    // или шкаф с зеркалом/без зеркала — в калькулятор попадает только выбранный вариант.
    const selectedRows = getSmartKitCompositionRows(comp, BUILDER.ownerId);
    BUILDER_CART = {}; // обнуляем
    const poolById = new Map();
    const poolByTitle = new Map();
    BUILDER.pool.forEach(m => {
      if(m.id) poolById.set(String(m.id), m);
      const t = (m.title||'').toLowerCase().trim();
      if(t && !poolByTitle.has(t)) poolByTitle.set(t, m);
    });
    let matched = 0;
    let addedQty = 0;
    selectedRows.forEach(row => {
      const qty = Number(row.qty) || 1;
      const byId = row.module_avito_id || row.module_item_id;
      let m = byId ? poolById.get(String(byId)) : null;
      if(!m){
        const rowTitle = String(row.module_title || row.module_code || '').toLowerCase().trim();
        const rowOrder = row.order || 0;
        m = BUILDER.pool.find(x => String(x && x._raw && x._raw.comp_owner_id || '') === String(BUILDER.ownerId || '') && String(x && x._raw && x._raw.comp_title || '') === rowTitle && Number(x && x._raw && x._raw.comp_order || 0) === Number(rowOrder));
        if(!m && rowTitle) m = poolByTitle.get(rowTitle);
      }
      if(!m && isAgavaKitchenItem(ownerForComp)){
        const rowCode = extractAgavaModuleCodeFromCompRow(row);
        const rowColor = normalizeAgavaBuilderColor(row && row.color);
        const ownerColor = normalizeAgavaBuilderColor(getKitchenDisplayColor(ownerForComp));
        if(rowCode){
          const preferredColors = [];
          [rowColor, ownerColor].forEach(c => { if(c && !preferredColors.includes(c)) preferredColors.push(c); });
          for(const c of preferredColors){
            if(m) break;
            m = BUILDER.pool.find(x => x && x._raw && x._raw._from_agava_module && agavaCodeMatches(rowCode, x._raw.agava_module_code) && String(x.color || '') === String(c));
          }
          if(!m) m = BUILDER.pool.find(x => x && x._raw && x._raw._from_agava_module && agavaCodeMatches(rowCode, x._raw.agava_module_code) && String(x.color || '') === 'Лиственница светлая');
          if(!m) m = BUILDER.pool.find(x => x && x._raw && x._raw._from_agava_module && agavaCodeMatches(rowCode, x._raw.agava_module_code));
        }
      }
      if(m){
        const k = moduleKey(m);
        const prev = BUILDER_CART[k] ? BUILDER_CART[k].qty : 0;
        BUILDER_CART[k] = { qty: prev + qty, m: m };
        matched++;
        addedQty += qty;
      }
    });
    BUILDER.typeFilter='__all__';
    document.querySelectorAll('#mBuilderTypeTabs .builderTab').forEach(x=>x.classList.toggle('on', x.dataset.t==='__all__'));
    saveBuilderSession();
    renderBuilderGrid();
    renderCalcPanel();
    if(matched){
      try{ if(window.statsTrack) statsTrack('add_module', { source:'fill_kit', ownerId: BUILDER.ownerId || '', qty: addedQty, matched: matched }); }catch(_){}
    }
    showToast(matched ? ('В калькулятор добавлено модулей: ' + addedQty) : 'Не удалось сопоставить состав с пулом');
  };
  if(clearBtn) clearBtn.onclick = () => {
    BUILDER.typeFilter='__all__'; BUILDER.w=''; BUILDER.h=''; BUILDER.d=''; BUILDER.color=''; BUILDER.inStock=false;
    BUILDER.highlight = null;
    BUILDER_CART = {};
    document.querySelectorAll('#mBuilderTypeTabs .builderTab').forEach(x=>x.classList.toggle('on', x.dataset.t==='__all__'));
    wSel.value=''; hSel.value=''; dSel.value=''; if(cSel) cSel.value=''; stockBox.checked=false;
    rebuildBuilderFilterSelects();
    saveBuilderSession();
    renderBuilderGrid();
    renderCalcPanel();
  };

  // Кнопки калькулятора
  const calcClearBtn = document.getElementById('mCalcClear');
  if(calcClearBtn) calcClearBtn.onclick = () => {
    if(!Object.keys(BUILDER_CART).length){ showToast('Калькулятор уже пуст'); return; }
    cartClear();
    showToast('Все позиции очищены');
  };

  const copyBtn = document.getElementById('mCalcCopy');
  if(copyBtn) copyBtn.onclick = () => {
    const items = Object.values(BUILDER_CART);
    if(!items.length){ showToast('Корзина пуста'); return; }
    const s = calcSummary();
    const lines = [];
    lines.push('Подбор из модулей:');
    items.forEach(({qty, m})=>{
      const linkedItem = m && m.id ? findItemById(m.id) : null;
      lines.push(formatModuleMessageLine(qty, m));
      if(linkedItem && shouldShowBedOptions(linkedItem)){
        const optText = getBedOptionShortText(linkedItem);
        if(optText) lines.push('   ' + optText);
      }
    });
    lines.push('');
    lines.push(`Итого: ${s.count} модулей · Ширина: ${formatCmNumber(s.width)} см · Сумма: ${s.sum.toLocaleString('ru-RU')} ₽`);
    const txt = lines.join('\n');
    try {
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(txt).then(
          ()=>showToast('Список скопирован. Вставьте в чат ВК или Авито.'),
          ()=>showToast('Не удалось скопировать')
        );
      } else {
        const ta=document.createElement('textarea'); ta.value=txt; ta.style.position='fixed'; ta.style.opacity='0';
        document.body.appendChild(ta); ta.select(); try{document.execCommand('copy')}catch(_){} document.body.removeChild(ta);
        showToast('Список скопирован. Вставьте в чат ВК или Авито.');
      }
    } catch(_) { showToast('Не удалось скопировать'); }
  };

  renderBuilderGrid();
  box.style.display = '';
}

function rebuildBuilderFilterSelects(){
  const pool = BUILDER.pool.filter(m => BUILDER.typeFilter==='__all__' || m.type === BUILDER.typeFilter);
  const uniqSorted = arr => [...new Set(arr.filter(v => v !== null && v !== undefined && String(v).trim() !== ''))].sort((a,b)=>Number(a)-Number(b));
  const ws = uniqSorted(pool.map(m=>m.width));
  const hs = uniqSorted(pool.map(m=>m.height));
  const ds = uniqSorted(pool.map(m=>m.depth));
  const colors = [...new Set(pool.map(m => String(m.color || '').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));

  if(BUILDER.w && !ws.some(v => String(v) === String(BUILDER.w))) BUILDER.w = '';
  if(BUILDER.h && !hs.some(v => String(v) === String(BUILDER.h))) BUILDER.h = '';
  if(BUILDER.d && !ds.some(v => String(v) === String(BUILDER.d))) BUILDER.d = '';
  if(BUILDER.color && !colors.some(v => String(v) === String(BUILDER.color))) BUILDER.color = '';

  function labelFor(axis, val){
    // В фильтрах размеров показываем только значение выбранной оси.
    // Не добавляем полный габарит Ш×В×Г, иначе клиент видит одинаковые полные размеры
    // в трёх разных плашках и фильтрация визуально путается.
    return String(val);
  }

  function fillSel(sel, axis, values, current){
    if(!sel) return;
    const lbl = {width:'Ширина', height:'Высота', depth:'Глубина'}[axis];
    const opts = ['<option value="">' + lbl + '</option>'].concat(
      values.map(v => '<option value="' + esc(String(v)) + '" ' + (String(current)===String(v)?'selected':'') + '>' + esc(labelFor(axis,v)) + '</option>')
    );
    sel.innerHTML = opts.join('');
  }
  fillSel(document.getElementById('mBuilderWidth'),  'width',  ws, BUILDER.w);
  fillSel(document.getElementById('mBuilderHeight'), 'height', hs, BUILDER.h);
  fillSel(document.getElementById('mBuilderDepth'),  'depth',  ds, BUILDER.d);

  const cSel = document.getElementById('mBuilderColor');
  if(cSel){
    if(colors.length > 1){
      cSel.style.display = '';
      cSel.innerHTML = '<option value="">Цвет</option>' + colors.map(c => '<option value="' + esc(c) + '" ' + (String(BUILDER.color)===String(c)?'selected':'') + '>' + esc(c) + '</option>').join('');
    } else {
      BUILDER.color = '';
      cSel.value = '';
      cSel.style.display = 'none';
      cSel.innerHTML = '<option value="">Цвет</option>';
    }
  }
}
function renderBuilderGrid(){
  const list = document.getElementById('mKitPoolList');
  const stats = document.getElementById('mBuilderStats');
  if(!list) return;

  // Применяем фильтры
  let arr = BUILDER.pool.slice();
  if(BUILDER.typeFilter !== '__all__') arr = arr.filter(m => m.type === BUILDER.typeFilter);
  if(BUILDER.w)        arr = arr.filter(m => String(m.width)  === String(BUILDER.w));
  if(BUILDER.h)        arr = arr.filter(m => String(m.height) === String(BUILDER.h));
  if(BUILDER.d)        arr = arr.filter(m => String(m.depth)  === String(BUILDER.d));
  if(BUILDER.color)    arr = arr.filter(m => String(m.color || '').trim() === String(BUILDER.color));
  if(BUILDER.inStock)  arr = arr.filter(m => m.inStock);

  // Статистика сверху блока
  if(stats){
    const hasStock = STOCK.loaded;
    const inSt = arr.filter(m => m.inStock).length;
    stats.innerHTML = [
      `<div class="kitStat">Показано: <b>${arr.length}</b></div>`,
      hasStock ? `<div class="kitStat ${inSt>0?'ok':''}">В наличии: <b>${inSt}</b></div>` : `<div class="kitStat">Остатки не загружены</div>`
    ].join('');
  }

  if(!arr.length){
    list.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:12px">По текущим фильтрам модулей не найдено.</div>';
    renderCalcPanel();
    return;
  }

  // Рендер карточек. Ограничим 120 штук для производительности
  list.innerHTML = arr.slice(0,120).map((m, idx) => {
    const linkedItem = m.linked ? findItemById(m.id) : null;
    const _gpBase = linkedItem ? getBedCardDisplayPrice(linkedItem, m.price) : Number(m.price || 0);
    const _gpSeatX = (linkedItem && typeof getSeatOptionExtraPrice === 'function') ? getSeatOptionExtraPrice(linkedItem.id) : 0;
    const priceTxt = (_gpBase + _gpSeatX) ? ((_gpBase + _gpSeatX).toLocaleString('ru-RU')+' ₽') : (m.price ? (Number(m.price).toLocaleString('ru-RU')+' ₽') : '—');
    const dims = formatModuleDims(m);
    const variantLabel = String(m.variantLabel || '').trim();
    const cardDetails = getModuleMessageDetails(m, linkedItem);
    const mk = moduleKey(m);
    const curQty = cartGet(m);
    const stockQty = Math.max(0, Number(m.stockQty || 0) || 0);
    const stockBadge = STOCK.loaded
      ? (m.inStock ? '<span class="kitCard-stock ok">В наличии' + (stockQty ? ' · ' + stockQty + ' шт.' : '') + '</span>' : '<span class="kitCard-stock">Под заказ</span>')
      : '<span class="kitCard-stock">Нет данных</span>';
    const hi = (BUILDER.highlight && BUILDER.highlight(m)) ? ' highlight' : '';
    const activeCls = curQty > 0 ? ' qty-active' : '';
    const chosenBadge = curQty > 0 ? '<span class="kitCard-chosen">Выбрано</span>' : '';
    const clickAttr = m.linked ? `data-open="${esc(m.id)}"` : '';
    const bedOptBtn = (linkedItem && shouldShowBedOptions(linkedItem)) ? `<button type="button" class="kitCard-bedopt" data-bedopt="${esc(linkedItem.id)}">Опции</button>` : '';
    const bedOptSummary = (linkedItem && shouldShowBedOptions(linkedItem)) ? getBedOptionShortBadge(linkedItem) : '';
    const seatOptBtn = (linkedItem && shouldShowSeatOption(linkedItem)) ? `<button type="button" class="kitCard-bedopt" data-seatopt="${esc(linkedItem.id)}">Опции</button>` : '';
    const seatOptSummary = (linkedItem && shouldShowSeatOption(linkedItem)) ? getSeatOptionShortBadge(linkedItem) : '';
    return `<div class="kitCard${m.linked?'':' disabled'}${activeCls}" data-mk="${esc(mk)}" data-idx="${idx}" ${clickAttr}${hi?' style="box-shadow:0 0 0 2px rgba(45,125,255,.5) inset;border-color:var(--accent)"':''}>
      <div class="kitCard-ph">
        ${m.photo?`<img ${imgAttrs(m.photo, 400)} alt="${esc(m.type||'')}">`:'<div class="noph">📦</div>'}
        ${m.type?`<span class="kitCard-grp">${esc(m.type)}</span>`:''}
        ${chosenBadge}
        ${bedOptSummary}
        ${seatOptSummary}
      </div>
      <div class="kitCard-body">
        <div class="kitCard-title">${esc(m.title||'—')}</div>
        ${renderModuleCardDetailsHtml(cardDetails)}
        <div class="kitCard-meta">${dims?dims:''}${m.factory?(dims?' · ':'')+esc(m.factory):''}</div>
        ${(bedOptBtn||seatOptBtn) ? `<div class="kitCard-bedrow">${bedOptBtn}${seatOptBtn}</div>` : ''}
      </div>
      <div class="kitCard-foot">
        ${stockBadge}
        <div class="kitCard-price">${priceTxt}</div>
      </div>
      <div class="kitCard-qtyctrl" data-ctrl="1">
        <button type="button" class="qty-btn" data-act="dec">−</button>
        <div class="qty-val">${curQty}</div>
        <button type="button" class="qty-btn" data-act="inc">+</button>
      </div>
    </div>`;
  }).join('') + (arr.length>120?`<div style="color:var(--muted);font-size:11px;padding:10px;align-self:center">…ещё ${arr.length-120} модулей (уточните фильтры)</div>`:'');

  renderCalcPanel();
  saveBuilderSession();

  // Вешаем обработчики через делегирование
  list.onclick = function(ev){
    const bedBtn = ev.target.closest('[data-bedopt]');
    if(bedBtn){ openMiniBedOptionPopup(ev, bedBtn.dataset.bedopt); return; }
    const seatBtn = ev.target.closest('[data-seatopt]');
    if(seatBtn){ openMiniSeatOptionPopup(ev, seatBtn.dataset.seatopt); return; }
    const card = ev.target.closest('.kitCard');
    if(!card) return;
    const idx = Number(card.dataset.idx);
    if(Number.isNaN(idx)) return;
    const m = arr[idx];
    if(!m) return;
    const btn = ev.target.closest('.qty-btn');
    if(btn){
      ev.stopPropagation();
      const act = btn.dataset.act;
      if(act === 'inc') cartInc(m);
      if(act === 'dec') cartDec(m);
      return;
    }
    // Клик по самой карточке — открыть модуль (если связан)
    if(card.dataset.open){
      navOpen(card.dataset.open);
    }
  };
}
function setPhoto(i){
  if(!mPh[i])return;
  mPhI=i;
  const imgEl=document.getElementById('mImg');
  imgEl.src=imgU(mPh[i], 1200);
  imgEl.dataset.orig=mPh[i];
  document.querySelectorAll('.mth').forEach((el,j)=>el.classList.toggle('on',j===i));
  const cnt=document.getElementById('mCnt'); if(cnt) cnt.textContent=(i+1)+' / '+mPh.length;
}
function buildThs(){document.getElementById('mThs').innerHTML=mPh.map((s,i)=>`<div class="mth ${i===0?'on':''}" onclick="event.stopPropagation();setPhoto(${i})"><img ${imgAttrs(s, 150)} alt="" onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src=this.dataset.orig||this.src;}else{this.parentElement.style.display='none';}"></div>`).join('')}
function photoNext(){ if(!mPh.length) return; setPhoto((mPhI+1) % mPh.length); }
function photoPrev(){ if(!mPh.length) return; setPhoto((mPhI-1+mPh.length) % mPh.length); }

// =============================================================
// V41_2d: verifyPhotos ОТКЛЮЧЕНА.
// Раньше (когда pn у всех был =20) функция при открытии карточки
// скачивала ВСЕ фото товара через new Image(), чтобы отсеять битые 404 —
// это создавало пробку (все 14-20 фото грузились разом с github.io).
// Теперь pn пересчитан по реальным файлам репозитория: галерея генерирует
// ровно столько ссылок, сколько реальных фото, битых нет. Поэтому массовая
// проверка не нужна — фото грузятся лениво по мере листания, как до правок.
// Функция оставлена пустой для совместимости (вызовов уже нет).
// Страховка от случайной битой ссылки — onerror на главном фото (setPhoto)
// и на мини-превью (buildThs), которые скрывают/пропускают кадр без скачивания.
// =============================================================
function verifyPhotos(){ /* отключено — см. комментарий выше */ }

function closeM(){
  document.getElementById('mOv').classList.remove('open');
  document.body.style.overflow='';
  NAV_STACK = [];
  if(window.__BACK_TO_CART__){ window.__BACK_TO_CART__=false; try{ setTimeout(function(){ favCartOpen(); },0); }catch(_){ } }
  // V41: убираем динамические SEO-теги при закрытии карточки
  try{ removeProductJsonLd(); restoreBaseCanonical(); }catch(_){}
  // Убираем ?item=... из адреса. Если в истории остался шаг с карточкой —
  // заменяем на текущее состояние каталога (?cat=… или чистый).
  try{
    if(!window.__ROUTING__){
      var pp=new URLSearchParams(window.location.search);
      if(pp.has('item')){
        favWriteUrl(null, false); // убираем item, оставляем контекст каталога (cat/q/series)
      }
    }
  }catch(_){}
  // Выбор вариантов в составе комплекта живёт только пока открыта модалка.
  // Если пользователь переходит внутри модалки в другую карточку и возвращается по стрелке — выбор сохраняется.
  // Если модалку закрыли полностью — выбор сбрасывается для следующего открытия.
  KIT_COMP_CHOICE = {};
  WARDROBE_ATTIC_CHOICE = {};
  BED_OPTION_CHOICE = {};
  SEAT_OPTION_CHOICE = {};
  SEAT_OPTION_VARIANT = {};
  resetBuilderSession();
  const b=document.getElementById('mBack'); if(b) b.style.display='none';
  hideCalcPanel();
  if(typeof updateSeoForState === 'function') updateSeoForState();
}
function mOutClick(e){if(e.target===document.getElementById('mOv'))closeM()}

// Стек истории товаров для кнопки "← Назад"
let NAV_STACK = [];
function navOpen(id){
  const cur = document.getElementById('mOv').classList.contains('open');
  if(cur){
    const curId = (window.__CUR_ITEM__ && window.__CUR_ITEM__.id) || null;
    const sc = getModalScrollEl();
    const scrollTop = sc ? Number(sc.scrollTop || 0) : 0;
    if(curId && curId !== id) NAV_STACK.push({ id: curId, scrollTop });
  }
  openM(id);
}
function navBack(){
  if(!NAV_STACK.length) return;
  const entry = NAV_STACK.pop();
  const id = entry && typeof entry === 'object' ? entry.id : entry;
  const restoreScrollTop = entry && typeof entry === 'object' ? Number(entry.scrollTop || 0) : 0;
  openM(id, {skipStackPush:true, restoreScrollTop});
}

// ===== PHOTO VIEWER =====
function pvOpen(i){
  if(!mPh.length) return;
  const ov=document.getElementById('pvOv'), img=document.getElementById('pvImg'), cnt=document.getElementById('pvCnt');
  img.src = mPh[i] || mPh[0];
  if(typeof pvSetZoom==='function') pvSetZoom(false); // сбрасываем зум при открытии
  cnt.textContent = (i+1)+' / '+mPh.length;
  window.__PVI__ = i;
  ov.classList.add('open');
  // Блокируем скролл фоновой страницы пока открыт просмотрщик
  document.body.style.overflow = 'hidden';
  // Запоминаем что просмотрщик открыт — чтобы Esc/жесты сработали правильно
  window.__PV_OPEN__ = true;
}
function pvClose(){
  document.getElementById('pvOv').classList.remove('open');
  // Сбрасываем zoom — иначе при следующем открытии он останется
  if(typeof pvSetZoom==='function') pvSetZoom(false);
  // Восстанавливаем скролл, но только если модалка товара тоже не открыта
  if(!document.getElementById('mOv').classList.contains('open')){
    document.body.style.overflow = '';
  }
  window.__PV_OPEN__ = false;
}
function pvOutClick(e){
  // Клик по фону (не по фрейму) — закрыть.
  // На мобильном это редко срабатывает (вся область занята фотографией),
  // используется в основном на десктопе.
  if(e.target.id==='pvOv') pvClose();
}
function pvNext(){
  if(!mPh.length) return;
  window.__PVI__ = ((window.__PVI__||0)+1) % mPh.length;
  const img = document.getElementById('pvImg');
  pvSetZoom(false); // при переключении сбрасываем зум
  img.src = mPh[window.__PVI__];
  document.getElementById('pvCnt').textContent = (window.__PVI__+1)+' / '+mPh.length;
  // синхронизируем модалку
  setPhoto(window.__PVI__);
}
function pvPrev(){
  if(!mPh.length) return;
  window.__PVI__ = (window.__PVI__ -1 + mPh.length) % mPh.length;
  const img = document.getElementById('pvImg');
  pvSetZoom(false);
  img.src = mPh[window.__PVI__];
  document.getElementById('pvCnt').textContent = (window.__PVI__+1)+' / '+mPh.length;
  setPhoto(window.__PVI__);
}
// Двойной тап — переключает зум (быстрый ×2 без pinch-жестов)
var pvZoom={on:false, scale:2, x:0, y:0};
function pvApplyTransform(){
  var img=document.getElementById('pvImg'); if(!img) return;
  if(pvZoom.on){
    img.style.transform='translate('+pvZoom.x+'px,'+pvZoom.y+'px) scale('+pvZoom.scale+')';
  } else {
    img.style.transform='';
  }
}
function pvClampPan(){
  // не даём утащить картинку дальше её краёв
  var img=document.getElementById('pvImg'); if(!img) return;
  var r=img.getBoundingClientRect();
  var stage=img.parentElement.getBoundingClientRect();
  // максимально допустимое смещение = сколько картинка вылезает за сцену / 2
  var maxX=Math.max(0,(r.width-stage.width)/2);
  var maxY=Math.max(0,(r.height-stage.height)/2);
  if(pvZoom.x> maxX) pvZoom.x= maxX;
  if(pvZoom.x<-maxX) pvZoom.x=-maxX;
  if(pvZoom.y> maxY) pvZoom.y= maxY;
  if(pvZoom.y<-maxY) pvZoom.y=-maxY;
}
function pvSetZoom(on){
  var img=document.getElementById('pvImg'); if(!img) return;
  pvZoom.on=on; pvZoom.x=0; pvZoom.y=0;
  img.classList.toggle('zoomed', on);
  pvApplyTransform();
}
function pvToggleZoom(){ pvSetZoom(!pvZoom.on); }
// ESC закрывает просмотрщик, стрелки листают
document.addEventListener('keydown', e => {
  if(!window.__PV_OPEN__) return;
  if(e.key === 'Escape'){ pvClose(); }
  else if(e.key === 'ArrowLeft'){ pvPrev(); }
  else if(e.key === 'ArrowRight'){ pvNext(); }
});

// Подсчёт активных фильтров — показывается красным кружком на иконке
// фильтров в sticky-панели и в FAB. Помогает пользователю понимать, что
// какие-то фильтры применены, даже когда панель закрыта.
function countActiveFilters(){
  let n = 0;
  if(S.cat) n++;
  if(S.fac) n++;
  if(S.q) n++;
  if(S.priceMin || S.priceMax) n++;
  if(S.wMin || S.wMax) n++;
  if(S.hMin || S.hMax) n++;
  if(S.dMin || S.dMax) n++;
  if(S.inStock) n++;
  if(S.attrs){
    for(const k in S.attrs){
      const arr = S.attrs[k];
      if(Array.isArray(arr) && arr.length) n++;
    }
  }
  return n;
}
function updateFilterBadges(){
  const n = countActiveFilters();
  const badge = document.getElementById('mssFilterCount');
  if(badge){
    if(n > 0){ badge.style.display = 'flex'; badge.textContent = String(n); }
    else { badge.style.display = 'none'; }
  }
  // FAB-кнопку больше не используем на мобиле — её заменила sticky-панель сверху.
  // На десктопе FAB вообще не отображается (display:none через media-query).
}

function openSB(){
  document.body.classList.add('fo');
  // Скроллим список фильтров наверх, чтобы пользователь начал с поиска
  const sb = document.getElementById('sidebar');
  if(sb) sb.scrollTop = 0;
  updateApplyBtnText();
}
function closeSB(){
  document.body.classList.remove('fo');
}
// Повторный клик по кнопке "Фильтры" — закрывает панель.
// Это удобно: открыл, посмотрел, ткнул в ту же кнопку — закрыл.
function toggleSB(){
  if(document.body.classList.contains('fo')){
    closeSB();
  } else {
    openSB();
  }
}
// "Применить и закрыть" — для нижней кнопки на мобильном.
// Фильтры на сайте и так применяются на лету при изменении полей,
// но пользователю нужна явная кнопка завершения работы с фильтром.
function applyAndCloseSB(){
  closeSB();
  // Прокручиваем к каталогу после закрытия — чтобы пользователь сразу увидел результат
  setTimeout(()=>{
    const a = document.getElementById('catAnchor');
    if(a){
      const top = a.getBoundingClientRect().top + window.pageYOffset - 70;
      window.scrollTo({top, behavior:'smooth'});
    }
  }, 50);
}
// Обновление текста на кнопке "Показать N товаров"
function updateApplyBtnText(){
  const txt = document.getElementById('sbApplyBtnText');
  if(!txt) return;
  const n = (typeof filtered !== 'undefined' && Array.isArray(filtered)) ? filtered.length : 0;
  if(n === 0) txt.textContent = 'Ничего не найдено';
  else if(n === 1) txt.textContent = 'Показать 1 товар';
  else if(n < 5) txt.textContent = `Показать ${n} товара`;
  else txt.textContent = `Показать ${n} товаров`;
}
// Закрытие фильтра по свайпу вниз на мобильном
function setupSidebarSwipeClose(){
  const sb = document.getElementById('sidebar');
  if(!sb) return;
  let startY = null;
  let lastY = null;
  sb.addEventListener('touchstart', (e)=>{
    if(!document.body.classList.contains('fo')) return;
    // Свайп закрывает только если касание началось у самого верха сайдбара
    if(sb.scrollTop > 8) return;
    startY = e.touches[0].clientY;
    lastY = startY;
  }, {passive:true});
  sb.addEventListener('touchmove', (e)=>{
    if(startY === null) return;
    lastY = e.touches[0].clientY;
  }, {passive:true});
  sb.addEventListener('touchend', ()=>{
    if(startY !== null && lastY !== null){
      const dy = lastY - startY;
      if(dy > 80){ // свайп вниз более 80px → закрываем
        closeSB();
      }
    }
    startY = null; lastY = null;
  }, {passive:true});
}
function goCat(){
  if(window.__restoreRAF__){ cancelAnimationFrame(window.__restoreRAF__); window.__restoreRAF__=0; }
  window.__goCatPending__ = true; // dApply не должен возвращать позицию назад, пока листаем
  // прячем клавиатуру (на телефоне скролл иначе считается под ней)
  try{ if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); }catch(_){ }
  setTimeout(function(){
    // Целимся в ЗАГОЛОВОК категории («Кровати»/«Матрасы») — он виден над товарами
    // и всегда на месте (не зависит от числа товаров — у матрасов больше не съезжает вниз).
    var target=document.getElementById('rTitle')
            || document.querySelector('.rbar')
            || document.getElementById('catAnchor')
            || document.getElementById('pgrid');
    if(!target){ window.__goCatPending__=false; return; }
    var isMobile=window.matchMedia&&window.matchMedia('(max-width:860px)').matches;
    var offset=isMobile?78:100; // чуть больше — заголовок не прячется под липкую шапку
    var y=target.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo({top:Math.max(0,y), behavior:'smooth'});
    setTimeout(function(){ window.__goCatPending__=false; }, 400); // снимаем флаг после прокрутки
  }, 120); // ждём перерисовку грида (важно для матрасов: серия меняет список)
}

function _isDesktop(){ return !(window.matchMedia && window.matchMedia('(max-width:991px)').matches); }
// ===== ПОИСК v41_59: уровень маркетплейсов (по исследованию Озон/ВБ/nonton) =====
// Токены + порядок слов не важен + префиксы + опечатки (1, для длинных слов 2) +
// zero-state (история+популярное+категории) + фото в подсказках + крестик очистки.
function favTok(s){ return String(s||'').toLowerCase().replace(/\u0451/g,'\u0435').split(/[^a-z\u0430-\u044f0-9]+/).filter(Boolean); }
function favTokenHit(word, tok){
  if(word.indexOf(tok)===0) return true; // префикс: «угл» → «угловой»
  var t=tok.length;
  if(t>=4 && typeof favLev==='function'){
    var d=(t>=8?2:1); // короткие слова — 1 опечатка, длинные — до 2
    if(favLev(word, tok, d)<=d) return true;
  }
  return false;
}
function favQueryMatch(words, qtoks){
  for(var i=0;i<qtoks.length;i++){
    var hit=false;
    for(var j=0;j<words.length;j++){ if(favTokenHit(words[j], qtoks[i])){ hit=true; break; } }
    if(!hit) return false; // КАЖДОЕ слово запроса должно найтись (порядок не важен)
  }
  return true;
}
function favQTok(q){
  // Токены запроса: выкидываем однобуквенные предлоги («с», «и», «в»), цифры оставляем
  return favTok(q).filter(function(t){ return t.length>1 || /[0-9]/.test(t); });
}
function favItemStrongTokens(it){
  // «Сильные» поля: название, категория, цвет, фабрика. Характеристики комплектов — НЕ здесь.
  if(!it.__ts) it.__ts=favTok([it.t,it.c,it.col,it.f].join(' '));
  return it.__ts;
}
function favQueryMode(q){
  // Есть ли в каталоге товары с сильным совпадением? Кэш по строке запроса.
  var c=window.__Q_MODE__;
  if(c && c.q===q) return c.strong;
  var qt=favQTok(q); var strong=false;
  if(qt.length){
    var CAT=(window.CATALOG||[]);
    for(var i=0;i<CAT.length;i++){ if(favQueryMatch(favItemStrongTokens(CAT[i]), qt)){ strong=true; break; } }
  }
  window.__Q_MODE__={q:q, strong:strong};
  return strong;
}
function favItemTokens(it){
  if(!it.__tk) it.__tk=favTok([it.t,it.c,it.f,it.col].concat(Object.values(it.a||{})).join(' '));
  return it.__tk;
}
function favScoreItem(it, qtoks, ql){
  // Очки релевантности: где нашлось слово — так и весит.
  // Категория и начало названия — много; характеристики комплекта — почти ничего.
  var sc=0;
  var cw=it.__ck||(it.__ck=favTok(it.c||''));
  var tw=it.__tw||(it.__tw=favTok(it.t||''));
  for(var i=0;i<qtoks.length;i++){
    var tok=qtoks[i], best=0, j;
    for(j=0;j<cw.length;j++){
      if(cw[j].indexOf(tok)===0){ best=Math.max(best,60); break; }
      if(favTokenHit(cw[j],tok)) best=Math.max(best,45);
    }
    for(j=0;j<tw.length;j++){
      var w=tw[j];
      if(w===tok) best=Math.max(best, j===0?55:40);
      else if(w.indexOf(tok)===0) best=Math.max(best, j===0?45:30);
      else if(best<18 && favTokenHit(w,tok)) best=18;
    }
    sc+=(best||2); // нашлось только в характеристиках — 2 очка
  }
  var tl=String(it.t||'').toLowerCase().replace(/\u0451/g,'\u0435');
  if(ql && tl.indexOf(ql)===0) sc+=25;
  try{ if(getCatalogAvailability(it).available) sc+=3; }catch(_){ }
  return sc;
}
function favNegRefine(it, q){
  // Понимание «без»: запрос «с зеркалом» отсеивает товары, где зеркало
  // упомянуто ТОЛЬКО во фразе «без зеркала»; запрос «без зеркала» — наоборот.
  // Срабатывает только при наличии таких фраз — остальное не трогает.
  var qa=favTok(q), qt=favQTok(q);
  if(!qt.length) return true;
  var words=favItemTokens(it); // порядок слов сохранён — «без» стоит перед своим словом
  for(var i=0;i<qt.length;i++){
    var t=qt[i];
    if(t==='без' || t.length<3) continue;
    var qNeg=false;
    for(var k=1;k<qa.length;k++){ if(qa[k]===t && qa[k-1]==='без'){ qNeg=true; break; } }
    var pos=0, neg=0;
    for(var j=0;j<words.length;j++){
      if(!favTokenHit(words[j], t)) continue;
      if(j>0 && words[j-1]==='без') neg++; else pos++;
    }
    if(pos+neg===0) continue; // слово сматчилось не по тексту товара — не вмешиваемся
    if(qNeg){ if(!neg) return false; } // искали «без X» — нужна именно фраза «без X»
    else if(!pos) return false;        // искали «X» — а в товаре только «без X»
  }
  return true;
}
function favItemMatchesQ(it, q){
  var qt=favQTok(q); if(!qt.length) return true;
  // Строгий режим: если хоть у кого-то слово в названии/категории — ищем только так.
  // Предохранитель: если сильных совпадений нет нигде (запрос «160», артикул) — широкий поиск.
  var hit = favQueryMode(q) ? favQueryMatch(favItemStrongTokens(it), qt) : favQueryMatch(favItemTokens(it), qt);
  return hit && favNegRefine(it, q);
}
// История запросов
function favHistGet(){ try{ var a=JSON.parse(localStorage.getItem('mf_search_hist')||'[]'); return Array.isArray(a)?a:[]; }catch(_){ return []; } }
function favHistAdd(q){
  q=String(q||'').trim(); if(q.length<2) return;
  try{
    var a=favHistGet().filter(function(x){ return x.toLowerCase()!==q.toLowerCase(); });
    a.unshift(q); localStorage.setItem('mf_search_hist', JSON.stringify(a.slice(0,6)));
  }catch(_){ }
}
function favHistClear(){ try{ localStorage.removeItem('mf_search_hist'); }catch(_){ } }
var FAV_POPULAR_Q=['Диван','Шкаф-купе','Кровать','Кухня','Прихожая','Комод','Стол'];
function favHl(title, qtoks){
  var h=esc(title);
  qtoks.forEach(function(t){
    if(t.length<2) return;
    var re=new RegExp('('+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','i');
    if(re.test(h)) h=h.replace(re,'<b>$1</b>');
  });
  return h;
}
function favCatCounts(){
  var CAT=(window.CATALOG||[]); var m={};
  CAT.forEach(function(i){ if(i.c) m[i.c]=(m[i.c]||0)+1; });
  return m;
}
function buildSearchSug(q, boxId){
  var box=document.getElementById(boxId||'searchSug'); if(!box) return;
  q=(q||'').trim();
  var CAT=(window.CATALOG||[]);
  var h='';
  if(q.length<2){ // с одной буквы — шум; держим стартовый список
    // ===== zero-state: история + популярное + категории =====
    var hist=favHistGet();
    if(hist.length){
      h+='<div class="ssug-h" style="display:flex;justify-content:space-between;align-items:center">История <span class="ssug-clr" data-clr="1">Очистить</span></div>';
      hist.forEach(function(x){ h+='<div class="ssug-i ssug-q" data-q="'+esc(x)+'"><span class="ssug-ic">\ud83d\udd52</span><span>'+esc(x)+'</span></div>'; });
    }
    h+='<div class="ssug-h">Часто ищут</div><div class="ssug-chips">';
    FAV_POPULAR_Q.forEach(function(x){ h+='<span class="ssug-chip" data-q="'+esc(x)+'">'+esc(x)+'</span>'; });
    h+='</div>';
    var cc=favCatCounts(); var cats0=Object.keys(cc).sort(function(a,b){ return cc[b]-cc[a]; }).slice(0,6);
    if(cats0.length){
      h+='<div class="ssug-h">Категории</div>';
      cats0.forEach(function(c){ h+='<div class="ssug-i ssug-cat" data-cat="'+esc(c)+'"><span class="ssug-ic">\ud83d\udcc2</span><span>'+esc(c)+'</span><span class="ssug-n">'+cc[c]+'</span></div>'; });
    }
    box.innerHTML=h; box.style.display=''; return;
  }
  // ===== подсказки по запросу =====
  var qtoks=favQTok(q); var ql=q.toLowerCase().replace(/\u0451/g,'\u0435');
  var qMirror=/зеркал/.test(ql);
  var total=0; var catCnt={}; var top=[];
  for(var k=0;k<CAT.length;k++){
    var it=CAT[k]; if(!it.t) continue;
    if(!favItemMatchesQ(it, q)) continue;
    total++;
    if(it.c) catCnt[it.c]=(catCnt[it.c]||0)+1;
    var sc=favScoreItem(it, qtoks, ql);
    if(top.length<5 || sc>top[top.length-1].sc){
      top.push({it:it, sc:sc});
      top.sort(function(a,b){ return b.sc-a.sc; });
      if(top.length>5) top.pop();
    }
  }
  var prods=top.map(function(x){ return x.it; });
  var cats=Object.keys(catCnt).sort(function(a,b){
    var ma=favQueryMatch(favTok(a),qtoks)?0:1, mb=favQueryMatch(favTok(b),qtoks)?0:1;
    return (ma-mb) || (catCnt[b]-catCnt[a]); // сначала совпавшие по названию, потом крупные
  }).slice(0,4);
  if(!total && !cats.length){
    // честная пустая выдача (у nonton тут пусто — делаем лучше)
    var cc2=favCatCounts(); var top4=Object.keys(cc2).sort(function(a,b){ return cc2[b]-cc2[a]; }).slice(0,4);
    h='<div class="ssug-empty">Ничего не найдено по «'+esc(q)+'».<br>Проверьте опечатки — или загляните в категории:</div><div class="ssug-chips">';
    top4.forEach(function(c){ h+='<span class="ssug-chip" data-cat="'+esc(c)+'">'+esc(c)+'</span>'; });
    h+='</div>';
    box.innerHTML=h; box.style.display=''; return;
  }
  if(cats.length){ h+='<div class="ssug-h">Категории</div>'; cats.forEach(function(c){ h+='<div class="ssug-i ssug-cat" data-cat="'+esc(c)+'"><span class="ssug-ic">\ud83d\udcc2</span><span>'+favHl(c,qtoks)+'</span><span class="ssug-n">'+catCnt[c]+'</span></div>'; }); }
  if(prods.length){
    h+='<div class="ssug-h">Товары</div>';
    prods.forEach(function(it){
      var av=false; try{ av=getCatalogAvailability(it).available; }catch(_){ }
      var mt=''; if(qMirror){ var ws=favItemTokens(it),mp=0,mn=0; for(var z=0;z<ws.length;z++){ if(ws[z].indexOf('зеркал')===0){ if(z>0&&ws[z-1]==='без') mn++; else mp++; } } mt=mp?'С зеркалом':(mn?'Без зеркала':''); }
      var sub=[it.c, it.col, mt].filter(Boolean).join(' \u00b7 ');
      h+='<div class="ssug-i ssug-prod" data-id="'+esc(String(it.id))+'">'
        +(it.img?('<img class="ssug-img" src="'+esc(thumbU(it.img))+'" data-orig="'+esc(it.img)+'" alt="" loading="lazy">'):'<span class="ssug-img"></span>')
        +'<span class="ssug-mid"><span class="ssug-pt2">'+favHl(it.t,qtoks)+(av?'<i class="ssug-dot"></i>':'')+'</span>'
        +(sub?('<span class="ssug-sub">'+esc(sub)+'</span>'):'')+'</span>'
        +'<span class="ssug-pp">'+(Number(it.p)||0).toLocaleString('ru-RU')+' \u20bd</span></div>';
    });
  }
  h+='<div class="ssug-i ssug-all" data-all="1"><span class="ssug-ic">\ud83d\udd0e</span><span>Все результаты («'+esc(q)+'») — '+total+'</span></div>';
  box.innerHTML=h; box.style.display='';
}
function hideSearchSug(){ ['searchSug','searchSugM'].forEach(function(id){ var b=document.getElementById(id); if(b) b.style.display='none'; }); }
function goToCatFromSug(cat){
  hideSearchSug();
  S.q=''; ['hQ','sQ','mssQ'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  favSearchXSync(); favSyncQUrl('');
  setCat(cat);
  goCat(); // листаем к товарам и на ПК, и на телефоне
}
function openProdFromSug(id){ hideSearchSug(); if(typeof openM==='function') openM(id); }
// ====== ДИПЛИНКИ v41_76 (переписано: единая модель состояния) ======
// Модель: адрес = КОНТЕКСТ КАТАЛОГА (q | series+cat | cat) + НАЛОЖЕНИЕ (item | cart).
// Наложение идёт ВМЕСТЕ с контекстом, а не вместо — поэтому «Назад» из карточки
// убирает только item и оставляет cat: состояние и адрес всегда совпадают.
window.__ROUTING__ = false; // true = мы сами применяем адрес, навигационные функции в это время в URL не пишут

// Прочитать текущий контекст каталога из живого состояния (S)
function favCurrentCtx(){
  var ctx={};
  if(S.q){ ctx.q=S.q; }
  else {
    if(S.cat) ctx.cat=S.cat;
    if(S.attrs && S.attrs['Серия'] && S.attrs['Серия'].length===1) ctx.series=S.attrs['Серия'][0];
  }
  return ctx;
}
// Собрать и записать адрес: контекст + опциональное наложение
function favWriteUrl(overlay, push){
  try{
    var ctx=favCurrentCtx();
    var u=new URL(window.location.href);
    ['cat','item','q','series','cart'].forEach(function(k){ u.searchParams.delete(k); });
    Object.keys(ctx).forEach(function(k){ u.searchParams.set(k, String(ctx[k])); });
    if(overlay){ Object.keys(overlay).forEach(function(k){ var v=overlay[k]; if(v===true) u.searchParams.set(k,'1'); else if(v) u.searchParams.set(k,String(v)); }); }
    var url=u.pathname+(u.search||'')+(u.hash||'');
    if(push) window.history.pushState(null,'',url); else window.history.replaceState(null,'',url);
  }catch(_){ }
}
// Применить адрес к состоянию ПОЛНОСТЬЮ (загрузка и «Назад»/«Вперёд»)
function favApplyUrl(){
  if(window.__ROUTING__) return;
  window.__ROUTING__=true;
  try{
    var p=new URLSearchParams(window.location.search);
    var item=p.get('item'), cart=p.get('cart'), series=p.get('series');
    var cat=p.get('cat'), q=(p.get('q')||'').trim();

    // 1) Сначала восстанавливаем КОНТЕКСТ каталога (что под наложением)
    if(q){
      ['hQ','mssQ','sQ'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=q; });
      if(typeof smartQ==='function') smartQ(q);
    } else if(series && typeof selectMattressSeries==='function'){
      // серия сама выставит cat=Матрасы
      if(!(S.attrs && S.attrs['Серия'] && S.attrs['Серия'][0]===series)) selectMattressSeries(series);
    } else if(cat){
      if(S.q){ /* был поиск — снимем */ if(typeof smartQ==='function') smartQ(''); }
      if(S.cat!==cat){ var sel=document.getElementById('catSel'); if(sel){ var opt=Array.from(sel.options).find(function(o){return o.value===cat;}); if(opt && typeof setCat==='function') setCat(cat); } }
    } else {
      // нет контекста — сбрасываем к «всем товарам»
      if(S.q && typeof smartQ==='function') smartQ('');
      if(S.cat && typeof setCat==='function') setCat('');
    }

    // 2) Теперь НАЛОЖЕНИЕ: карточка / корзина / ничего
    var mOv=document.getElementById('mOv');
    var cardOpen=mOv && mOv.classList.contains('open');
    var dlg=document.getElementById('favInfoDlg');

    if(item){
      var it=(window.CATALOG||[]).find(function(x){return String(x.id)===String(item);});
      if(it){ if(dlg && typeof favCloseInfo==='function') favCloseInfo(); setTimeout(function(){ openM(it.id); },40); }
    } else if(cart){
      if(cardOpen && typeof closeM==='function') closeM();
      setTimeout(function(){ if(typeof favCartOpen==='function') favCartOpen(); },40);
    } else {
      // наложения нет — закрываем открытое
      if(cardOpen && typeof closeM==='function') closeM();
      if(dlg && typeof favCloseInfo==='function') favCloseInfo();
    }
  }catch(_){ }
  window.__ROUTING__=false;
}
window.addEventListener('popstate', function(){ favApplyUrl(); });

function favSyncQUrl(q){
  // ?q=диван в адресной строке: ссылкой можно поделиться, поиск переживает обновление страницы
  try{
    var u=new URL(window.location.href);
    if(q) u.searchParams.set('q', q); else u.searchParams.delete('q');
    window.history.replaceState(null,'', u.pathname+(u.search||'')+(u.hash||''));
  }catch(_){ }
}
function favSearchXSync(){
  [['hQ','hQx'],['mssQ','mssQx'],['sQ','sQx']].forEach(function(p){
    var i=document.getElementById(p[0]), x=document.getElementById(p[1]);
    if(i&&x) x.style.display=i.value?'':'none';
  });
}
function favSearchClear(inpId){
  var i=document.getElementById(inpId); if(!i) return;
  i.value='';
  if(window.smartQ) window.smartQ('');
  favSyncQUrl('');
  favSearchXSync();
  var sugBox={hQ:'searchSug', mssQ:'searchSugM'}[inpId];
  if(sugBox) buildSearchSug('', sugBox); // фокус остаётся, показываем zero-state (у бокового sQ подсказок нет)
  i.focus();
}



function applyShopConfig(){
  const cfg = window.SHOP_CONFIG || {};
  // Универсальная ссылка для написания в ВК (работает на ПК и мобильном приложении)
  const vkChatUrl = cfg.vkClubUrl || cfg.vkChatUrl ? makeVkChatUrl(cfg.vkClubUrl) : '';

  const showLink = (id, url) => {
    const el = document.getElementById(id);
    if(!el) return;
    if(url){ el.href = url; el.style.display = ''; }
    else el.style.display = 'none';
  };
  const showPhone = (id) => {
    const el = document.getElementById(id);
    if(!el) return;
    if(cfg.phone){
      // Не ставим href=tel: напрямую — теперь по клику открывается диалог
      // с раскрытым номером, оттуда уже идёт реальный звонок.
      el.href = '#';
      el.style.display='';
      el.addEventListener('click', e=>{
        e.preventDefault();
        favPhoneAction(); // телефон → сразу звонилка, ПК → попап с номером
      });
    }
    else el.style.display='none';
  };
  // Привязывает к общей ВК-кнопке копирование короткого приветствия
  // и счётчик кликов в локальной статистике.
  const bindGenericVk = (id) => {
    const el = document.getElementById(id);
    if(!el || !vkChatUrl) return;
    el.onclick = function(e){
      e.preventDefault();
      try{ if(window.statsTrack) statsTrack('click_vk_generic'); }catch(_){}
      const msg = getGenericVkMessage();
      // Синхронное копирование — работает в том же тике, что и клик (критично для iOS)
      const copied = copyTextSync(msg);
      showVkPrepareDialog({ text: msg, vkUrl: vkChatUrl, copied: copied });
    };
  };
  const bindClick = (id, eventName) => {
    const el = document.getElementById(id);
    if(!el) return;
    el.dataset.metrikaBound = '1';
    el.addEventListener('click', ()=>{
      try{ if(window.statsTrack) statsTrack(eventName, { id, href: el.href || '' }); }catch(_){}
    });
  };

  // Header + hero + CTA buttons
  showLink('hdrVk', vkChatUrl); bindGenericVk('hdrVk');
  showLink('hdrAv', cfg.avitoShopUrl); bindClick('hdrAv', 'avito_click');
  showPhone('hdrPhone');
  bindMaxButton(document.getElementById('hdrMax'));

  showLink('heroVk', vkChatUrl); bindGenericVk('heroVk');
  showLink('heroAvito', cfg.avitoShopUrl); bindClick('heroAvito', 'avito_click');
  showPhone('heroPhone');
  bindMaxButton(document.getElementById('heroMax'));

  showLink('ctaVk', vkChatUrl); bindGenericVk('ctaVk');
  showLink('ctaAvito', cfg.avitoShopUrl); bindClick('ctaAvito', 'avito_click');
  showPhone('ctaPhone');

  // Consult block
  const cb = document.getElementById('cbBlock');
  const hasAny = !!(cfg.vkClubUrl || cfg.phone || cfg.avitoShopUrl);
  if(cb) cb.style.display = hasAny ? '' : 'none';
  showLink('cbVk', vkChatUrl); bindGenericVk('cbVk');
  showLink('cbAvito', cfg.avitoShopUrl); bindClick('cbAvito', 'avito_click');
  showPhone('cbPhone');

  // Locations block (Где нас найти) — кнопка "Позвонить" над сеткой адресов
  showPhone('locPhone');

  // Mobile sticky
  const mob = document.getElementById('mobContact');
  if(mob) mob.style.display = hasAny ? '' : 'none';
  showLink('mobVk', vkChatUrl); bindGenericVk('mobVk');
  showLink('mobAvito', cfg.avitoShopUrl); bindClick('mobAvito', 'avito_click');
  showPhone('mobPhone');

  // Footer
  showLink('ftVk', vkChatUrl); bindGenericVk('ftVk');
  showLink('ftAv', cfg.avitoShopUrl); bindClick('ftAv', 'avito_click');
  showPhone('ftPhone');
  bindMaxButton(document.getElementById('ftMax'));
}


function initStats(){
  if(!Array.isArray(window.CATALOG)) return;
  const total = CATALOG.length;
  const cats  = new Set(CATALOG.map(i=>i.c).filter(Boolean)).size;
  const set = (id, v)=>{ const el=document.getElementById(id); if(el) el.textContent=v; };
  set('hBadgeCount', total);
  set('hsTotal',  total+'+');
  set('hsCats',   cats);
  set('ftCnt',    total);
  const meta = window.CATALOG_META || {};
  set('ftUpd', meta.generated_at || '—');
}

// ========== ЗАГРУЗКА ОСТАТКОВ (stock-data/stock.xlsx) ==========
// Матчит по "Арт поставщика" (поле item.art). Читается каждое утро:
// просто заменяйте stock-data/stock.xlsx на свежий файл.
const STOCK = { loaded:false, date:'', map:{}, matched:0 };
const ALWAYS_IN_STOCK_IDS = new Set(['7963849000','7931639186']);

function isAlwaysInStockItem(it){
  if(!it) return false;
  const id = String(it.id || it.avito_id || '').trim();
  return ALWAYS_IN_STOCK_IDS.has(id);
}
function applyAlwaysInStockOverrides(it){
  if(!isAlwaysInStockItem(it)) return false;
  const qty = Math.max(1, Number(it._stockQty) || 1);
  it._stockQty = qty;
  it._inStock = true;
  it._stockClass = 'instock';
  return true;
}
if(Array.isArray(window.CATALOG)){
  for(const it of window.CATALOG) applyAlwaysInStockOverrides(it);
}

function parseLooseNumber(v){
  if(v===null||v===undefined||v==='') return 0;
  if(typeof v==='number') return Number.isFinite(v)?v:0;
  const s = String(v).replace(/\s+/g,'').replace(',','.');
  const m = s.match(/-?\d+(?:\.\d+)?/); if(!m) return 0;
  const n = Number(m[0]); return Number.isFinite(n)?n:0;
}
function extractStockDate(rows){
  const re=/(\d{2}\.\d{2}\.\d{4})/;
  for(let r=0;r<Math.min(rows.length,8);r++){
    const row=rows[r]||[];
    for(const c of row){ const m=String(c||'').match(re); if(m) return m[1]; }
  } return '';
}
function normArt(v){
  // Нормализуем: убираем все пробелы (включая неразрывные), приводим к строке
  return String(v||'').replace(/[\s\u00A0]+/g,'').trim();
}
function artVariants(v){
  // Возвращаем только полный нормализованный артикул.
  // Раньше добавляли "хвост после дефиса" — это создавало коллизии,
  // когда в каталоге у двух разных товаров мог совпасть хвост с третьим
  // в xlsx. Полное совпадение надёжнее.
  const full=normArt(v);
  return full ? [full] : [];
}
function parseStockRows(rows){
  const map={}; let n=0;
  // Идём по всем строкам — пропускаем разделители (где в col[1] не число)
  for(let i=0;i<rows.length;i++){
    const row=rows[i]||[];
    const rowNum=row[1];
    const rawArt=row[2];
    if(!rowNum || !String(rowNum).match(/^\d+$/)) continue;
    const qty=parseLooseNumber(row[7]);
    const vars=artVariants(rawArt); if(!vars.length) continue;
    // Только один вариант — полный артикул. Используем =, а не +=, чтобы
    // если в файле случайно дважды одна строка — не складывали.
    vars.forEach(a=>{ map[a]=qty; });
    n++;
  } return {map,rows:n};
}
function applyStock(){
  let matched=0;
  if(!Array.isArray(window.CATALOG)) return;
  for(const it of CATALOG){
    const arts = artVariants(it.art);
    let qty = 0;
    for(const a of arts){
      if(Object.prototype.hasOwnProperty.call(STOCK.map,a)){ qty += +STOCK.map[a]||0; matched++; }
    }
    it._stockQty = qty;
    it._inStock  = qty>0;
    applyAlwaysInStockOverrides(it);
  }
  try{ if(typeof window.__MATTRESS_OPTIONS__!=='undefined'){ for(const it of CATALOG){ if(window.__MATTRESS_OPTIONS__[String(it.id)]){ const any=mattressAnyInStock(it); it._inStock=any; it._stockQty=any?mattressMaxQty(it):0; } } } }catch(_){}
  STOCK.matched = matched;
  // Подпись в сайдбаре
  const note=document.getElementById('stockNote'), txt=document.getElementById('stockNoteText');
  if(note && txt){
    if(STOCK.loaded){
      const inCount = CATALOG.filter(i=>i._inStock).length;
      txt.textContent = (STOCK.date?('обновлено '+STOCK.date+', '):'') + 'в наличии ' + inCount + ' шт.';
      note.style.display='';
    } else { note.style.display='none'; }
  }
  if(typeof apply==='function') apply();
  try{
    const cur = window.__CUR_ITEM__;
    const modalOpen = document.getElementById('mOv') && document.getElementById('mOv').classList.contains('open');
    if(cur && modalOpen){
      if(typeof updateBedOptionSelection === 'function') updateBedOptionSelection(cur);
      if(typeof updateWardrobeAtticSelection === 'function') updateWardrobeAtticSelection(cur);
      if(typeof renderWardrobeCoupeKit === 'function') renderWardrobeCoupeKit(cur);
      if(typeof renderTumbaSeatOption === 'function') renderTumbaSeatOption(cur);
    }
  }catch(_){}
}
const STOCK_AUTO_PATHS = ['stock-data/stock.xlsx', 'stock.xlsx'];
async function tryLoadStock(){
  let lastErr = null;
  for(const path of STOCK_AUTO_PATHS){
    try {
      // Сначала пробуем скачать сам файл остатков. Если его нет — не тянем SheetJS.
      // Работает на GitHub Pages / сервере. Если сайт открыт как file://, браузер
      // может запретить автодоступ к соседнему XLSX. Для проверки лучше открывать сайт через локальный сервер.
      const res = await fetch(path + '?t=' + Date.now(), {cache:'no-store'});
      if(!res.ok) continue;
      const buf = await res.arrayBuffer();
      await ensureXLSX();
      parseAndApplyStockBuffer(buf);
      const el=document.getElementById('ftStock');
      if(el) el.textContent = 'остатки обновляются автоматически';
      console.log('[stock] loaded from ' + path);
      return true;
    } catch(e){ lastErr = e; }
  }
  if(lastErr) console.warn('[stock] auto load failed', lastErr);
  return false;
}

function parseAndApplyStockBuffer(buf){
  const wb = XLSX.read(buf,{type:'array'});
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false});
  const d = extractStockDate(rows);
  const p = parseStockRows(rows);
  STOCK.loaded=true; STOCK.date=d; STOCK.map=p.map;
  applyStock();
  const el=document.getElementById('ftStock');
  if(el) el.textContent = d ? ('остатки от '+d) : 'остатки загружены';
}

const dApply=deb(()=>{page=1;apply()},260);
document.addEventListener('DOMContentLoaded',()=>{
  // V41_78: МЯГКОЕ автообновление сайта (A+B). Когда залита новая версия:
  //  - новая SW готовится в фоне, НЕ перебивая текущую страницу;
  //  - показываем ненавязчивую плашку «Обновить» (B);
  //  - тихо применяем при следующем естественном действии: переход/открытие
  //    или закрытие карточки/смена категории (A) — человек не замечает рывка;
  //  - плюс фоновая проверка обновления раз в 30 минут (для открытых вкладок).
  if('serviceWorker' in navigator && location.protocol === 'https:'){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        window.__SW_REG__ = reg;

        // Активировать готовую новую версию (по клику на плашку или при действии)
        window.favApplyUpdate = function(){
          if(window.__SW_APPLYING__) return;
          var waiting = reg.waiting;
          if(waiting){ window.__SW_APPLYING__ = true; waiting.postMessage({type:'SKIP_WAITING'}); }
        };

        // Новая версия установилась и ждёт — НЕ перебиваем резко, готовим мягко
        function onWaiting(){
          if(!reg.waiting || !navigator.serviceWorker.controller) return;
          window.__SW_UPDATE_READY__ = true;
          showUpdateBanner();          // B: ненавязчивая плашка
          armSoftUpdateOnAction();     // A: применить при следующем действии
        }

        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if(nw){
            nw.addEventListener('statechange', () => {
              if(nw.state === 'installed' && navigator.serviceWorker.controller){
                onWaiting();
              }
            });
          }
        });
        // Если новая версия уже ждала на момент загрузки
        if(reg.waiting && navigator.serviceWorker.controller){ onWaiting(); }

        // Когда новая SW взяла управление — один раз плавно перечитываем страницу
        var refreshed = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if(refreshed) return; refreshed = true;
          window.location.reload();
        });

        // C-страховка: фоновая проверка обновления раз в 30 мин (для висящих вкладок)
        setInterval(() => { try{ reg.update(); }catch(_){} }, 30*60*1000);
        // и при возвращении на вкладку
        document.addEventListener('visibilitychange', () => {
          if(document.visibilityState === 'visible'){ try{ reg.update(); }catch(_){} }
        });
      }).catch(err => console.warn('[sw] register failed', err));
    });
  }

  // A: применить готовое обновление при следующем естественном действии.
  // Вешаем «одноразовые» слушатели на навигацию по сайту — как только человек
  // что-то делает, тихо переключаемся на новую версию.
  function armSoftUpdateOnAction(){
    if(window.__SW_ARMED__) return; window.__SW_ARMED__ = true;
    var fire = function(){
      if(!window.__SW_UPDATE_READY__) return;
      // небольшая задержка, чтобы действие человека успело отработать
      setTimeout(function(){ if(window.favApplyUpdate) window.favApplyUpdate(); }, 250);
    };
    // навигационные точки: открытие/закрытие карточки, popstate, выбор категории
    window.addEventListener('popstate', fire, {once:false});
    ['openM','closeM','setCat','favCartOpen'].forEach(function(fn){
      if(typeof window[fn] === 'function'){
        var orig = window[fn];
        window[fn] = function(){ var r = orig.apply(this, arguments); fire(); return r; };
      }
    });
  }

  // B: ненавязчивая плашка «Доступна новая версия»
  function showUpdateBanner(){
    if(document.getElementById('favUpd')) return;
    var b = document.createElement('div');
    b.id = 'favUpd';
    b.innerHTML = '<span>Доступна новая версия сайта</span>'
      + '<button type="button" id="favUpdBtn">Обновить</button>';
    b.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%) translateY(120%);'
      + 'z-index:5000;display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:13px;'
      + 'background:rgba(13,18,32,.96);backdrop-filter:blur(10px);border:1px solid rgba(255,213,77,.4);'
      + 'box-shadow:0 8px 30px rgba(0,0,0,.5);color:#fff;font-family:var(--fb);font-size:13.5px;'
      + 'max-width:calc(100vw - 28px);transition:transform .35s ease';
    var btn = b.querySelector('#favUpdBtn');
    btn.style.cssText = 'padding:8px 16px;border:none;border-radius:9px;background:linear-gradient(180deg,#ffd34d,#ffc107);'
      + 'color:#1a1200;font-family:var(--fb);font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap';
    btn.onclick = function(){ if(window.favApplyUpdate) window.favApplyUpdate(); };
    document.body.appendChild(b);
    requestAnimationFrame(function(){ b.style.transform = 'translateX(-50%) translateY(0)'; });
  }

  // V40_62: Глобальный fallback для картинок. Раньше его задача была подменять
  // weserv-прокси на оригинал при сбое прокси. Прокси убран, но обработчик
  // оставлен — теперь он работает как защита от любых битых фото: если src
  // не загрузился и отличается от data-orig (что в текущей версии практически
  // не происходит), пробуем подставить data-orig. По сути это no-op для большинства
  // случаев, но не мешает и страхует от регрессий.
  document.addEventListener('error', (e)=>{
    const t = e.target;
    if(!t || t.tagName !== 'IMG') return;
    if(t.dataset.fb === '1') return; // уже пробовали fallback
    const orig = t.dataset.orig;
    if(!orig || t.src === orig) return;
    t.dataset.fb = '1';
    t.src = orig;
  }, true); // capture: error не bubblится

  applyShopConfig();
  initStats();
  initHero(); buildPopularTiles(); buildQuickFactories(); initScrollTools(); initSelects(); buildFacets(); apply();

  // Если в адресе ?admin=КОД — открываем панель статистики
  if(isAdminMode()){
    setTimeout(renderAdminPanel, 200);
  }

  // ========== URL-РОУТИНГ ==========
  // Поддерживаем ссылки вида:
  //   ?cat=Диваны           — открывает раздел диванов (используется в sitemap)
  //   ?item=4155668774      — открывает карточку конкретного товара (для шаринга)
  // Это даёт SEO для категорий и возможность скидывать ссылки на конкретные товары в чат.
  //
  // ВАЖНО: catalog.js грузится с defer и может ещё не быть готов к моменту
  // DOMContentLoaded. Ждём пока CATALOG появится — с разумным таймаутом.
  (function applyUrlParams(){
    let params;
    try{ params = new URLSearchParams(window.location.search); }
    catch(_){ return; }
    const catParam = params.get('cat');
    const itemParam = params.get('item');
    const qParam = (params.get('q')||'').trim();
    const seriesParam = params.get('series');
    const cartParam = params.get('cart');
    if(!catParam && !itemParam && !qParam && !seriesParam && !cartParam) return;

    // Ждём готовности каталога. Проверяем каждые 50мс, максимум 8 секунд.
    let attempts = 0;
    const maxAttempts = 160; // 160 * 50мс = 8 секунд
    const tryApply = ()=>{
      attempts++;
      const ready = Array.isArray(window.CATALOG) && window.CATALOG.length > 0;
      if(!ready){
        if(attempts < maxAttempts){
          setTimeout(tryApply, 50);
        }
        return;
      }
      // Каталог готов — применяем параметры
      try{
        if(catParam){
          const catSel = document.getElementById('catSel');
          // Проверяем что такая категория реально есть
          const opt = Array.from(catSel.options).find(o=>o.value === catParam);
          if(opt){
            setCat(catParam);
            // Прокручиваем к каталогу
            setTimeout(()=>{
              const a = document.getElementById('catAnchor');
              if(a) a.scrollIntoView({behavior:'smooth'});
            }, 100);
          }
        }
        if(qParam){
          ['hQ','mssQ','sQ'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=qParam; });
          if(typeof smartQ==='function') smartQ(qParam);
          else { S.q=qParam; page=1; if(typeof dApply==='function') dApply(); else apply(); }
          if(typeof favSearchXSync==='function') favSearchXSync();
          setTimeout(()=>{ const a=document.getElementById('catAnchor'); if(a) a.scrollIntoView({behavior:'smooth'}); }, 150);
        }
        if(seriesParam && typeof selectMattressSeries==='function'){
          window.__ROUTING__=true;
          try{ selectMattressSeries(seriesParam); }catch(_){}
          window.__ROUTING__=false;
        }
        if(itemParam){
          const it = window.CATALOG.find(x => String(x.id) === String(itemParam));
          if(it){
            // Небольшая задержка чтобы успели отрисоваться карточки и сетка
            window.__ROUTING__=true;
            setTimeout(()=>{ try{ openM(it.id, {msize: params.get('msize'), mfab: params.get('mfab')}); }catch(_){} window.__ROUTING__=false; }, 200);
          } else {
            console.warn('[router] товар не найден:', itemParam);
          }
        }
        if(cartParam && typeof favCartOpen==='function'){
          window.__ROUTING__=true;
          setTimeout(()=>{ try{ favCartOpen(); }catch(_){} window.__ROUTING__=false; }, 250);
        }
      }catch(err){
        console.warn('[router] ошибка применения URL-параметров:', err);
      }
    };
    tryApply();
  })();
  // ==================================

  // ============================================================
  // V40_47: УМНЫЙ ПОИСК
  // ============================================================
  // Если пользователь сидит в категории "Кухни" и ищет "Квадро", а в Кухнях
  // такого нет — мы автоматически переключаем категорию:
  //   - если совпадения нашлись только в одной другой категории (например, в
  //     "Шкафах") → переключаем туда;
  //   - если совпадения в нескольких категориях → ставим "Все категории",
  //     чтобы человек увидел всё разом;
  //   - если совпадений нет нигде → ничего не трогаем, покажется "Ничего
  //     не найдено" в исходной категории.
  // Когда пользователь стирает запрос — возвращаем его исходную категорию.
  // При первом нажатии в пустом поиске — прокручиваем к каталогу, чтобы
  // было видно, что что-то реально происходит.
  let userPickedCat = S.cat || '';
  const _origSetCat = setCat;
  setCat = function(cat){
    userPickedCat = cat || '';
    var r = _origSetCat(cat);
    // Обновляем адрес: ?cat=Кровати (но не во время применения адреса и не затирая активный поиск)
    if(!window.__ROUTING__ && !S.q){
      favWriteUrl(null, true);
    }
    return r;
  };

  function _smartScrollToCatalog(){
    if(window.matchMedia && !window.matchMedia('(max-width:991px)').matches) return;
    const a = document.getElementById('catAnchor');
    if(!a) return;
    const r = a.getBoundingClientRect();
    // Скроллим только если каталог реально не виден целиком сверху
    if(r.top > window.innerHeight * 0.3 || r.top < -50){
      a.scrollIntoView({behavior:'smooth', block:'start'});
    }
  }

  function smartQ(v){
    if(v && v.trim().length<2) v=''; // одна буква — не фильтруем каталог (шум)
    const isEmpty  = !v;

    // Синхронизируем все три поля поиска (но не трогаем то, в которое сейчас печатают)
    S.q = v;
    const hQ  = document.getElementById('hQ');
    const sQ  = document.getElementById('sQ');
    const mss = document.getElementById('mssQ');
    if(hQ  && hQ  !== document.activeElement) hQ.value  = v;
    if(sQ  && sQ  !== document.activeElement) sQ.value  = v;
    if(mss && mss !== document.activeElement) mss.value = v;

    // Если запрос стёрт — возвращаемся в исходную категорию
    if(isEmpty){
      if(S.cat !== userPickedCat){
        S.cat = userPickedCat;
        const sel = document.getElementById('catSel');
        if(sel) sel.value = userPickedCat;
        try{ buildFacets(); }catch(_){}
      }
      page = 1;
      dApply();
      return;
    }

    // Запрос непустой — проверяем, есть ли совпадения в текущей категории
    const hasInCurrent = CATALOG.some(it => matchesCurrentFilters(it));

    if(!hasInCurrent && S.cat){
      const savedCat = S.cat;
      S.cat = ''; // временно снимаем фильтр категории
      const matches = CATALOG.filter(it => matchesCurrentFilters(it));
      const cats = new Set(matches.map(it => it.c));

      if(cats.size === 1){
        S.cat = [...cats][0];
        const sel = document.getElementById('catSel');
        if(sel) sel.value = S.cat;
        try{ buildFacets(); }catch(_){}
      } else if(cats.size >= 2){
        const sel = document.getElementById('catSel');
        if(sel) sel.value = '';
        try{ buildFacets(); }catch(_){}
      } else {
        // нигде нет — оставляем исходную, покажется "Ничего не найдено"
        S.cat = savedCat;
        const sel = document.getElementById('catSel');
        if(sel) sel.value = savedCat;
      }
    }

    page = 1;
    dApply();

    // Живой ввод НЕ листает страницу и не прячет клавиатуру — иначе на второй
    // букве пользователя выбрасывает из поля. Прокрутка к товарам только по
    // явному действию: Enter, выбор категории, чип, «Все результаты».
  }

  window.smartQ = smartQ; // нужен глобально: favSearchClear, восстановление ?q=
  document.getElementById('hQ').addEventListener('input', e => smartQ(e.target.value.trim()));
  (function(){
    var sugTimer=0;
    function dSug(v, boxId){ clearTimeout(sugTimer); sugTimer=setTimeout(function(){ buildSearchSug(v, boxId); }, 160); }
    var hdrEl=document.querySelector('header');
    var mssBar=document.querySelector('.mob-sticky-search');
    function hdrExpand(on){
      if(!hdrEl) return;
      clearTimeout(window.__HDR_X_T__);
      if(on){ if(window.matchMedia&&window.matchMedia('(max-width:860px)').matches) hdrEl.classList.add('hsx'); }
      else window.__HDR_X_T__=setTimeout(function(){ hdrEl.classList.remove('hsx'); },200);
    }
    function mssExpand(on){
      if(!mssBar) return;
      clearTimeout(window.__MSS_X_T__);
      if(on) mssBar.classList.add('msx');
      else window.__MSS_X_T__=setTimeout(function(){ mssBar.classList.remove('msx'); },200);
    }
    function bindSearch(inpId, boxId){
      var inp=document.getElementById(inpId); var box=document.getElementById(boxId);
      var isHdr=(inpId==='hQ');
      if(inp){
        inp.addEventListener('input', function(e){ favSearchXSync(); dSug(e.target.value, boxId); });
        inp.addEventListener('focus', function(e){ clearTimeout(window.__SUG_HIDE_T__); if(isHdr) hdrExpand(true); if(inpId==='mssQ') mssExpand(true); favSearchXSync(); buildSearchSug(e.target.value, boxId); }); // zero-state при ЛЮБОМ фокусе
        inp.addEventListener('blur', function(){ window.__SUG_HIDE_T__=setTimeout(hideSearchSug, 200); if(isHdr) hdrExpand(false); if(inpId==='mssQ') mssExpand(false); });
        inp.addEventListener('keydown', function(e){
          if(e.key==='Enter'){ var ev=inp.value.trim(); favHistAdd(ev); favSyncQUrl(ev.length>=2?ev:''); hideSearchSug(); inp.blur(); goCat(); }
          else if(e.key==='Escape'){ hideSearchSug(); }
        });
      }
      if(box){
        box.addEventListener('click', function(e){
          var cat=e.target.closest('[data-cat]'), prod=e.target.closest('.ssug-prod'),
              all=e.target.closest('.ssug-all'), qel=e.target.closest('[data-q]'), clr=e.target.closest('[data-clr]');
          if(clr){ clearTimeout(window.__SUG_HIDE_T__); favHistClear(); buildSearchSug('', boxId); if(inp){ inp.focus(); } }
          else if(qel){ var v=qel.getAttribute('data-q'); if(inp){ inp.value=v; } smartQ(v); favSearchXSync(); favHistAdd(v); favSyncQUrl(v.length>=2?v:''); hideSearchSug(); if(inp) inp.blur(); goCat(); }
          else if(cat) goToCatFromSug(cat.getAttribute('data-cat'));
          else if(prod){ favHistAdd(inp?inp.value:''); openProdFromSug(prod.getAttribute('data-id')); }
          else if(all){ var av=inp?inp.value.trim():''; favHistAdd(av); favSyncQUrl(av); hideSearchSug(); goCat(); }
        });
      }
    }
    bindSearch('hQ','searchSug');
    bindSearch('mssQ','searchSugM');
    var x1=document.getElementById('hQx'); if(x1) x1.addEventListener('click', function(){ favSearchClear('hQ'); });
    var x2=document.getElementById('mssQx'); if(x2) x2.addEventListener('click', function(){ favSearchClear('mssQ'); });
    var x3=document.getElementById('sQx'); if(x3) x3.addEventListener('click', function(){ favSearchClear('sQ'); });
    var sq=document.getElementById('sQ');
    if(sq){
      sq.addEventListener('input', favSearchXSync);
      sq.addEventListener('keydown', function(e){
        if(e.key==='Enter'){ var v=sq.value.trim(); favHistAdd(v); favSyncQUrl(v.length>=2?v:''); sq.blur(); goCat(); }
      });
    }
  })();
  document.getElementById('sQ').addEventListener('input', e => smartQ(e.target.value.trim()));
  document.getElementById('catSel').addEventListener('change', e => { setCat(e.target.value); if(window.matchMedia && !window.matchMedia('(max-width:991px)').matches) goCat(); });
  document.getElementById('facSel').addEventListener('change',e=>{S.fac=e.target.value;page=1;apply()});
  document.getElementById('sortSel').addEventListener('change',e=>{S.sort=e.target.value;page=1;apply()});
  ['pMin','pMax','wMin','wMax','hMin','hMax','dMin','dMax'].forEach(id=>{
    document.getElementById(id).addEventListener('input',e=>{S[id]=e.target.value;page=1;dApply()});
  });
  document.addEventListener('keydown',e=>{
    // Viewer имеет приоритет: если он открыт, клавиши работают на нём
    const pvOpen = document.getElementById('pvOv').classList.contains('open');
    if(pvOpen){
      if(e.key==='Escape')     pvClose();
      else if(e.key==='ArrowRight') pvNext();
      else if(e.key==='ArrowLeft')  pvPrev();
      return;
    }
    // Иначе работаем на модалке
    const mOpen = document.getElementById('mOv').classList.contains('open');
    if(!mOpen) return;
    if(e.key==='Escape') closeM();
    else if(e.key==='ArrowRight') photoNext();
    else if(e.key==='ArrowLeft')  photoPrev();
  });

  // Галерея в модалке. На десктопе — 3 клик-зоны (← prev | center zoom | → next).
  // На мобильном клик в любую часть открывает полноэкранный просмотр —
  // там можно зумить пальцами и листать свайпом.
  const mMain = document.getElementById('mMain');
  if(mMain){
    mMain.addEventListener('click', function(ev){
      const t = ev.target;
      const isMobile = window.matchMedia('(max-width:780px)').matches;
      if(t.closest('.mGal-zoom')){ pvOpen(mPhI); return; }
      if(t.closest('.mGal-ar.left span')){ photoPrev(); return; }
      if(t.closest('.mGal-ar.right span')){ photoNext(); return; }

      // Мобильный — сразу открываем фуллскрин-просмотр на текущем фото
      if(isMobile){
        pvOpen(mPhI);
        return;
      }

      // Десктоп — старые 3 зоны
      if(mPh.length <= 1){ pvOpen(0); return; }
      const rect = mMain.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const w = rect.width;
      // Три зоны по ширине: [0..33%] prev, [33..67%] zoom, [67..100%] next
      if(x < w * 0.33)      photoPrev();
      else if(x > w * 0.67) photoNext();
      else                  pvOpen(mPhI);
    });
    // Свайп в галерее карточки на мобильном — листает фото без открытия фуллскрина
    let mx = null, my = null;
    mMain.addEventListener('touchstart', e=>{
      if(e.touches.length !== 1) { mx = my = null; return; }
      mx = e.changedTouches[0].clientX;
      my = e.changedTouches[0].clientY;
    }, {passive:true});
    mMain.addEventListener('touchend', e=>{
      if(mx === null || my === null) return;
      const dx = e.changedTouches[0].clientX - mx;
      const dy = e.changedTouches[0].clientY - my;
      // Только если горизонтальный жест значительно больше вертикального — листаем
      if(Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4){
        // gesture detected — отменяем последующий click чтобы не открыть фуллскрин
        ev_swipeJustHappened = true;
        setTimeout(()=>{ ev_swipeJustHappened = false; }, 350);
        if(dx < 0) photoNext(); else photoPrev();
      }
      mx = my = null;
    }, {passive:true});
    // Не открываем фуллскрин если только что был свайп
    let ev_swipeJustHappened = false;
    mMain.addEventListener('click', e=>{
      if(ev_swipeJustHappened){ e.stopPropagation(); e.preventDefault(); }
    }, true);
  }

  // Viewer в стиле ВК. Поведение жестов:
  // - Десктоп: клик по ‹ ›, или клик по фону (вне фото) закрывает
  // - Мобильный:
  //   * Свайп влево/вправо → листать фото
  //   * Свайп вниз (резкий) → закрыть просмотрщик
  //   * Двойной тап → переключить зум ×2
  //   * Pinch-zoom двумя пальцами (нативный) — не трогаем
  const pvStage = document.getElementById('pvStage');
  if(pvStage){
    pvStage.addEventListener('click', function(ev){
      const t = ev.target;
      const isMobile = window.matchMedia('(max-width:780px)').matches;
      if(t.closest('.pv-ar.left span')){ pvPrev(); return; }
      if(t.closest('.pv-ar.right span')){ pvNext(); return; }
      // На мобильном одиночный тап ничего не делает (всё через свайп/двойной тап)
      if(isMobile) return;
      // Десктоп: 3 клик-зоны (← | close | →)
      if(mPh.length <= 1){ pvClose(); return; }
      const rect = pvStage.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const w = rect.width;
      if(x < w * 0.33)      pvPrev();
      else if(x > w * 0.67) pvNext();
      else                  pvClose();
    });

    // Жесты на мобильном
    let sx = null, sy = null, sTime = 0;
    let lastTapTime = 0; // для определения двойного тапа
    let panStartX=0, panStartY=0, panOrigX=0, panOrigY=0, panning=false;

    pvStage.addEventListener('touchstart', e=>{
      // Два пальца — отдаём родному зуму браузера, свои жесты гасим
      if(e.touches.length !== 1){ sx = sy = null; panning=false; return; }
      var t=e.changedTouches[0];
      sx = t.clientX; sy = t.clientY; sTime = Date.now();
      if(pvZoom.on){
        // В зуме — начинаем тащить картинку (pan)
        panning=true; panStartX=t.clientX; panStartY=t.clientY;
        panOrigX=pvZoom.x; panOrigY=pvZoom.y;
        var img=document.getElementById('pvImg'); if(img) img.classList.add('panning');
      }
    }, {passive:true});

    pvStage.addEventListener('touchmove', e=>{
      // Перетаскивание увеличенной картинки пальцем
      if(panning && pvZoom.on && e.touches.length===1){
        var t=e.changedTouches[0];
        pvZoom.x = panOrigX + (t.clientX - panStartX);
        pvZoom.y = panOrigY + (t.clientY - panStartY);
        pvClampPan();
        pvApplyTransform();
      }
    }, {passive:true});

    pvStage.addEventListener('touchend', e=>{
      var img=document.getElementById('pvImg');
      if(img) img.classList.remove('panning');
      if(sx === null || sy === null){ panning=false; return; }
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      const dt = Date.now() - sTime;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      // КОРОТКИЙ ТАП (быстро, мало движения) — проверяем на двойной
      if(dt < 300 && adx < 10 && ady < 10){
        const now = Date.now();
        if(now - lastTapTime < 300){
          pvToggleZoom(); // двойной тап — зум вкл/выкл
          lastTapTime = 0;
        } else {
          lastTapTime = now;
        }
        sx = sy = null; panning=false;
        return;
      }

      // Если был pan (двигали увеличенную картинку) — НЕ листаем и не закрываем
      if(panning){ panning=false; sx = sy = null; return; }

      // СВАЙП ВНИЗ — закрыть (только вне зума)
      if(!pvZoom.on && dy > 80 && ady > adx * 1.4){
        pvClose(); sx = sy = null; return;
      }
      // СВАЙП ВЛЕВО/ВПРАВО — листать (только вне зума)
      if(!pvZoom.on && adx > 40 && adx > ady * 1.4){
        if(dx < 0) pvNext(); else pvPrev();
      }
      sx = sy = null;
    }, {passive:true});
  }

  // Подгружаем остатки из stock-data/stock.xlsx (если файл рядом)
  tryLoadStock();

  // Свайп вниз закрывает мобильный фильтр
  setupSidebarSwipeClose();

  // ============================================================
  // СВОРАЧИВАНИЕ ШАПКИ И НИЖНЕЙ ПАНЕЛИ ПРИ СКРОЛЛЕ
  // + СИНХРОНИЗАЦИЯ STICKY-ПОИСКА С ОСНОВНЫМ
  // ============================================================
  // Поведение: когда пользователь листает ВНИЗ — шапка и нижняя
  // контакт-панель плавно прячутся, чтобы освободить экран. Когда
  // листает ВВЕРХ — снова появляются. Sticky-панель "Поиск + Фильтры"
  // включается, как только пользователь долистал до каталога.
  (function setupScrollBehavior(){
    const body = document.body;
    let lastY = window.pageYOffset;
    let ticking = false;
    let searchIdleTimer = null;
    const stickyEl = document.getElementById('mobStickySearch');
    const SCROLL_THRESHOLD = 12; // минимальное движение, чтобы не дёргаться
    const SEARCH_IDLE_MS = 10000; // поиск сам возвращается через 10с простоя
    const SCROLLED_DOWN_THRESHOLD = 100; // от какой высоты начинаем «прятать»

    const onScroll = ()=>{
      const y = window.pageYOffset;
      const delta = y - lastY;
      const isMobile = window.matchMedia('(max-width:860px)').matches;

      if(isMobile){
        if(stickyEl) stickyEl.classList.add('shown');

        if(Math.abs(delta) > SCROLL_THRESHOLD){
          if(delta > 0 && y > SCROLLED_DOWN_THRESHOLD){
            // листаем ВНИЗ → прячем ТОЛЬКО нижнюю панель (поиск всегда виден)
            body.classList.add('bar-hidden');
          } else if(delta < 0){
            // листаем ВВЕРХ → возвращаем нижнюю панель
            body.classList.remove('bar-hidden');
          }
          lastY = y;
        }
        // У самого верха — всегда полный интерфейс
        if(y <= SCROLLED_DOWN_THRESHOLD){
          body.classList.remove('bar-hidden');
        }
        // Поиск теперь всегда виден — таймер возврата не нужен.
        body.classList.remove('search-hidden');
      } else {
        body.classList.remove('search-hidden');
        body.classList.remove('bar-hidden');
        if(stickyEl) stickyEl.classList.remove('shown');
      }
      ticking = false;
    };

    window.addEventListener('scroll', ()=>{
      if(!ticking){
        requestAnimationFrame(onScroll);
        ticking = true;
      }
    }, {passive:true});
    // Первичный вызов — после загрузки страницы
    setTimeout(onScroll, 200);
  })();

  // Связываем sticky-поиск с основным состоянием поиска
  const mssQ = document.getElementById('mssQ');
  if(mssQ){
    mssQ.addEventListener('input', e=>{
      // Используем умный поиск: авто-переключение категории + скролл к каталогу
      const v = e.target.value.trim();
      if(typeof smartQ === 'function'){
        smartQ(v);
      } else {
        // Фолбэк на случай, если smartQ ещё не объявлен (init order)
        S.q = v;
        const hQ = document.getElementById('hQ');
        const sQ = document.getElementById('sQ');
        if(hQ) hQ.value = v;
        if(sQ) sQ.value = v;
        page = 1;
        if(typeof dApply === 'function') dApply(); else apply();
      }
    });
  }

  // На мобильном при выборе категории — закрываем фильтр и идём к каталогу.
  // Категория — самый сильный фильтр, после её выбора пользователь обычно
  // хочет увидеть результат, а не продолжать настройку.
  const catSel = document.getElementById('catSel');
  if(catSel){
    catSel.addEventListener('change', ()=>{
      if(window.matchMedia('(max-width:860px)').matches && document.body.classList.contains('fo')){
        setTimeout(applyAndCloseSB, 250);
      }
    });
  }
});
