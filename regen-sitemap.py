#!/usr/bin/env python3
"""
Перегенерирует sitemap.xml на основе catalog.js + сегодняшней даты.

Запускай каждый раз, когда обновляешь catalog.js:
    python3 regen-sitemap.py

Что делает:
- Берёт все товары из catalog.js
- Берёт уникальные категории
- Ставит сегодняшнюю дату в <lastmod>
- Сохраняет приоритеты как в исходном sitemap:
    1.0  — главная
    0.9  — страницы категорий (?cat=...)
    0.8  — карточки товаров (?item=...)
"""
import json
import re
from urllib.parse import quote
from datetime import date

CATALOG_FILE = "catalog.js"
SITEMAP_FILE = "sitemap.xml"
BASE = "https://мебель-фаворит.рф/"

def main():
    # 1. Загружаем каталог из JS-файла
    with open(CATALOG_FILE, "r", encoding="utf-8") as f:
        src = f.read()
    m = re.search(r"window\.CATALOG\s*=\s*(\[.*\])", src, re.DOTALL)
    if not m:
        raise RuntimeError(f"Не нашёл window.CATALOG = [...] в {CATALOG_FILE}")
    data = json.loads(m.group(1))

    # 2. Уникальные категории в порядке появления
    seen = set()
    cats = []
    for it in data:
        c = it.get("c")
        if c and c not in seen:
            seen.add(c)
            cats.append(c)

    today = date.today().isoformat()

    # 3. Собираем XML
    def url_block(loc, lastmod, changefreq, priority):
        return (
            f"  <url>\n"
            f"    <loc>{loc}</loc>\n"
            f"    <lastmod>{lastmod}</lastmod>\n"
            f"    <changefreq>{changefreq}</changefreq>\n"
            f"    <priority>{priority}</priority>\n"
            f"  </url>"
        )

    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    parts.append(url_block(BASE, today, "weekly", "1.0"))
    for cat in cats:
        parts.append(url_block(f"{BASE}?cat={quote(cat, safe='')}", today, "weekly", "0.9"))
    for it in data:
        iid = it.get("id")
        if iid:
            parts.append(url_block(f"{BASE}?item={iid}", today, "weekly", "0.8"))
    parts.append("</urlset>")

    with open(SITEMAP_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(parts) + "\n")

    print(f"Готово: {SITEMAP_FILE}")
    print(f"  URL-ов всего: {1 + len(cats) + len(data)}")
    print(f"  Категорий:    {len(cats)}")
    print(f"  Товаров:      {len(data)}")
    print(f"  Дата lastmod: {today}")

if __name__ == "__main__":
    main()
