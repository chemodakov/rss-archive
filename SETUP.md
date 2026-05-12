# Настройка GitHub репозитория

## Что нужно загрузить

```
package.json
scripts/collect.js
data/.gitkeep
README.md
.github/workflows/collect.yml   ← самый важный
```

---

## Шаг 1 — Загрузить обычные файлы

1. Открой репозиторий на GitHub
2. Нажми **"Add file" → "Upload files"**
3. Перетащи `package.json` и `README.md`
4. Нажми **"Commit changes"**

---

## Шаг 2 — Создать scripts/collect.js

1. Нажми **"Add file" → "Create new file"**
2. В поле имени напечатай: `scripts/collect.js`
   (при вводе `/` GitHub автоматически создаёт папку)
3. Скопируй содержимое файла `scripts/collect.js` и вставь
4. Нажми **"Commit changes"**

---

## Шаг 3 — Создать .github/workflows/collect.yml

1. Нажми **"Add file" → "Create new file"**
2. В поле имени напечатай: `.github/workflows/collect.yml`
3. Скопируй содержимое файла `.github/workflows/collect.yml` и вставь
4. Нажми **"Commit changes"**

---

## Шаг 4 — Создать папку data/

1. Нажми **"Add file" → "Create new file"**
2. В поле имени напечатай: `data/.gitkeep`
3. Содержимое оставь пустым
4. Нажми **"Commit changes"**

---

## Шаг 5 — Включить Actions

1. Вкладка **Actions**
2. Если появилась кнопка **"I understand my workflows, go ahead and enable them"** — нажать

---

## Шаг 6 — Первый запуск

1. **Actions → Collect RSS → "Run workflow"**
2. Подождать ~1 минуту
3. В логах должно быть:
   ```
   BBC World: 15 items
   Guardian World: 12 items
   ...
   ✓ Added 187 new items
   ```
4. После этого в `data/` появится файл `2026-W20.ndjson`

---

## Шаг 7 — Лимит расходов

GitHub Settings (аккаунта) → **Billing → Spending limits → Actions → $0**
