# rss-archive

Накапливает заголовки мировых новостей из 22 RSS-источников, запускаясь каждые 2 часа через GitHub Actions.  
Данные хранятся в формате NDJSON — один файл на ISO-неделю.

---

## Зачем

RSS-ленты дают срез «прямо сейчас» — обычно последние 5–30 часов. Этот архив решает проблему: запуская сборщик каждые 2 часа, за неделю получаем 84 снимка из 22 источников — полное покрытие новостного цикла.

Готовые данные можно использовать для анализа, тренировки моделей, журналистских расследований или любых других задач.

---

## Структура

```
rss-archive/
  data/
    2026-W20.ndjson     ← текущая неделя, пополняется каждые 2 ч
    2026-W21.ndjson     ← следующая неделя появится автоматически
    ...
  scripts/
    collect.js          ← основной сборщик (Node.js, ESM, без зависимостей)
  .github/
    workflows/
      collect.yml       ← GitHub Actions cron: каждые 2 часа
  package.json
```

---

## Формат данных (NDJSON)

Каждая строка — отдельный JSON-объект:

```json
{"id":"a3f9c12b4e7d","title":"Ukraine ceasefire talks stall in Vienna","description":"Negotiators from both sides...","link":"https://bbc.com/news/...","source":"BBC World","region":"western","pubDate":"2026-05-11T14:23:00.000Z","collectedAt":"2026-05-11T16:00:12.345Z"}
```

| Поле | Описание |
|------|----------|
| `id` | SHA1 от первых 80 символов заголовка, усечённый до 12 hex-символов |
| `title` | Заголовок новости (без HTML) |
| `description` | Первые 300 символов описания (без HTML) |
| `link` | URL оригинальной статьи |
| `source` | Название источника (напр. `"BBC World"`) |
| `region` | `western` / `asia` / `mideast` / `africa` / `latam` / `global` / `china` |
| `pubDate` | Дата публикации по данным RSS (ISO 8601) |
| `collectedAt` | Время, когда мы загрузили эту запись |

Дедупликация — по полю `id`. Одна и та же история с разных источников сохраняется один раз (от первого встреченного источника).

---

## Источники (22 штуки)

| Регион | Источники |
|--------|-----------|
| Western/EU | BBC World, Guardian World, Deutsche Welle, France 24, RFI English, Euronews |
| Asia/Pacific | NHK World, The Hindu, ABC Australia, SCMP, CNA, Times of India |
| Middle East | Al Jazeera, Egypt Independent |
| Africa | Premium Times NG |
| Latin America | teleSUR, Mercopress, Buenos Aires Herald, Rio Times |
| Global South | IPS News, The Conversation |
| China | Global Times |

---

## Локальный запуск

```bash
node scripts/collect.js
```

Файл появится в `data/YYYY-WWW.ndjson`.

---

## GitHub Actions

Workflow `.github/workflows/collect.yml` запускается по расписанию:

- **Каждые 2 часа** (`0 */2 * * *`)
- Запускает `scripts/collect.js`
- Коммитит новые данные в `data/`

**Расход минут:** ~360 мин/месяц при бесплатном тарифе (лимит 2000 мин/месяц).
