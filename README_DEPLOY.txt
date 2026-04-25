КАК ВЫЛОЖИТЬ НА GITHUB PAGES (V27pro)
=====================================

1. СТРУКТУРА ФАЙЛОВ
   Залейте в корень репозитория:
   - index.html
   - catalog.js
   - sw.js
   - robots.txt
   - sitemap.xml
   - og-preview.jpg
   - папка catalog-data/ (kitchen-comp.js, kitchen-pools.js)
   - папка stock-data/ (stock.xlsx)
   - папка docs/ — НЕ обязательна, это архив старых changelog. Можно не заливать.

2. ВКЛЮЧИТЬ GITHUB PAGES
   Settings → Pages → Source = "Deploy from a branch" → main / root.
   После активации сайт будет доступен по адресу
   https://ВАШ-USERNAME.github.io/ИМЯ-РЕПОЗИТОРИЯ/

3. ОБЯЗАТЕЛЬНО ПОДМЕНИТЬ URL В ТРЁХ МЕСТАХ
   Сейчас в файлах стоит заглушка https://artemcernysev12-svg.github.io/.
   Замените её на реальный адрес сайта в этих местах:

   index.html (top of file):
   - <link rel="canonical" href="...">
   - <meta property="og:url" content="...">
   - <meta property="og:image" content="...og-preview.jpg">
   - <meta name="twitter:image" content="...og-preview.jpg">
   - JSON-LD: "url": "..."

   sitemap.xml:
   - <loc>...</loc>

   robots.txt:
   - Sitemap: ...

   Можно одной заменой во всех файлах сразу: замените строку
   "https://artemcernysev12-svg.github.io/" на свой URL.

4. ПРОВЕРКА ПОСЛЕ ВЫКЛАДКИ
   - Открыть сайт, прокрутить до каталога, открыть карточку — фото должны
     загружаться быстрее, чем в V26pro.
   - Открыть в DevTools (F12) вкладку Network: должны быть запросы к
     images.weserv.nl/?url=... — это значит, прокси работает.
   - Скинуть ссылку себе в ВК или Telegram — должна показаться красивая
     картинка-превью с названием магазина.

5. ОБНОВЛЕНИЕ КАТАЛОГА В БУДУЩЕМ
   Теперь не надо перезаливать весь сайт. Достаточно обновить:
   - catalog.js — при изменении ассортимента, цен, описаний
   - stock-data/stock.xlsx — при обновлении остатков
   Для гарантии обновления у пользователей с кэшем — поднять версию
   "?v=V27pro" → "?v=V28pro" в index.html (это инвалидирует кэш браузера).

6. ЕСЛИ ЧТО-ТО ПОШЛО НЕ ТАК
   - Каталог не загружается → проверить, что catalog.js залит в корень
     (тот же уровень, что index.html), DevTools → Console покажет 404.
   - Картинки не грузятся → откройте F12 → Network. Если запросы к
     images.weserv.nl провалились (например, сервис временно недоступен),
     должны автоматически подставиться оригиналы с github.io.
   - Кухонные модули не открываются → проверить, что папка catalog-data/
     с двумя js-файлами тоже залита.

7. ЕСЛИ ЗАХОТИТЕ СВОЁ ДОМЕННОЕ ИМЯ
   GitHub Pages поддерживает custom domain (Settings → Pages → Custom
   domain). После настройки CNAME-записи у регистратора доменов и галки
   Enforce HTTPS — обновите URL во всех меcтах из пункта 3 на новый домен.
