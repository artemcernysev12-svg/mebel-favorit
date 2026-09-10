# -*- coding: utf-8 -*-
"""stock.xlsx -> stock.json: лёгкая «шпаргалка» остатков для сайта.

Зачем: браузер покупателя читал Excel напрямую — 263 КБ файла плюс ~900 КБ
библиотеки-читалки (SheetJS) на каждого посетителя. Теперь ночной workflow
после обновления stock.xlsx выписывает компактный stock.json (~25 КБ):
{"date": "дд.мм.гггг", "map": {"артикул": количество, ...}}

Логика разбора НАМЕРЕННО повторяет клиентскую (app.js parseStockRows):
  - первый лист книги;
  - строка товара: колонка B (index 1) — целое число (номер строки);
  - артикул: колонка C (index 2), убираем ВСЕ пробелы (включая NBSP);
  - количество: колонка H (index 7), первое число, запятая = точка;
  - дата остатков: первая дд.мм.гггг в первых 8 строках листа.
Если один артикул встречается дважды — берётся последнее значение (=, не +=),
как на клиенте.

Сбой этого скрипта НЕ должен ломать ночное обновление: workflow при ошибке
УДАЛЯЕТ stock.json (чтобы старая шпаргалка не перекрывала свежий Excel),
а сайт при отсутствии stock.json автоматически читает stock.xlsx по-старому.

Запуск: python scripts/stock_to_json.py [путь-к-xlsx] [путь-к-json]
"""
import json
import os
import re
import sys

import openpyxl

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "stock-data", "stock.xlsx")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(BASE, "stock-data", "stock.json")

DATE_RE = re.compile(r"(\d{2}\.\d{2}\.\d{4})")
NUM_RE = re.compile(r"-?\d+(?:\.\d+)?")


def norm_art(v):
    """Как normArt в app.js: строка без любых пробелов (включая NBSP).

    Числовую ячейку openpyxl отдаёт как float: целое значение приводим к int,
    чтобы артикул «123» не превратился в «123.0» (SheetJS отдаёт строку)."""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return re.sub(r"[\s ]+", "", str(v if v is not None else "")).strip()


def is_row_num(v):
    """Как проверка ^\\d+$ на клиенте (SheetJS raw:false отдаёт '5', openpyxl — 5/5.0)."""
    if v is None:
        return False
    if isinstance(v, bool):
        return False
    if isinstance(v, (int, float)):
        return float(v).is_integer() and v > 0
    return bool(re.fullmatch(r"\d+", str(v).strip()))


def loose_number(v):
    """Как parseLooseNumber в app.js."""
    if v is None or v == "":
        return 0
    if isinstance(v, bool):
        return 0
    if isinstance(v, (int, float)):
        return v if v == v else 0  # NaN -> 0
    s = re.sub(r"\s+", "", str(v)).replace(",", ".")
    m = NUM_RE.search(s)
    if not m:
        return 0
    try:
        return float(m.group(0))
    except ValueError:
        return 0


def cell_date(v):
    """дд.мм.гггг из строки или datetime-ячейки."""
    if v is None:
        return ""
    if hasattr(v, "strftime"):
        try:
            return v.strftime("%d.%m.%Y")
        except Exception:
            return ""
    m = DATE_RE.search(str(v))
    return m.group(1) if m else ""


def main():
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    ws = wb.worksheets[0]  # первый лист — как wb.SheetNames[0] на клиенте

    date = ""
    art_map = {}
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        row = list(row) + [None] * (8 - len(row))
        if not date and i < 8:
            for c in row:
                d = cell_date(c)
                if d:
                    date = d
                    break
        if not is_row_num(row[1]):
            continue
        art = norm_art(row[2])
        if not art:
            continue
        qty = loose_number(row[7])
        if qty == int(qty):
            qty = int(qty)
        art_map[art] = qty  # последнее значение, как на клиенте

    if not art_map:
        print("::error::stock_to_json: в %s не найдено ни одной строки товара" % XLSX)
        sys.exit(1)

    payload = {"date": date, "map": dict(sorted(art_map.items()))}
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)

    prev = None
    if os.path.exists(OUT):
        try:
            with open(OUT, encoding="utf-8") as f:
                prev = f.read()
        except OSError:
            prev = None
    if prev == body:
        print("stock.json без изменений (%d позиций, дата %s)" % (len(art_map), date or "—"))
        return

    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(body)
    print("stock.json записан: %d позиций, дата %s, %d байт"
          % (len(art_map), date or "—", len(body.encode("utf-8"))))


if __name__ == "__main__":
    main()
