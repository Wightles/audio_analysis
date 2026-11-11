# Импорт аудиозаписей Royal Brick

Аудиофайлы работодателя не добавляются в Git. Поместите каждый файл во временную папку `server/import/` или укажите к нему путь напрямую.

Поддерживаемые форматы: MP3, WAV, WebM и M4A. Максимальный размер по умолчанию — 250 МБ; его можно изменить через `MAX_AUDIO_SIZE_MB`.

Пример импорта:

```bash
node server/scripts/import-audio.mjs \
  --file server/import/meeting-01.mp3 \
  --manager "Имя менеджера" \
  --title "Встреча с клиентом 01" \
  --date 2026-11-12T10:00:00+07:00
```

Если для записи уже подтверждена версия согласия, её можно сохранить вместе с импортом:

```bash
node server/scripts/import-audio.mjs \
  --file server/import/meeting-01.mp3 \
  --manager "Имя менеджера" \
  --title "Встреча с клиентом 01" \
  --date 2026-11-12T10:00:00+07:00 \
  --consent-version 1.0
```

Скрипт копирует файл в приватное хранилище `server/storage/audio/`, создаёт запись в SQLite и проверяет SHA-256. Повторный импорт того же файла не создаёт дубликат. После запуска обновите историю встреч в приложении.

Если используются другие каталоги данных, задайте их через `.env`:

```bash
DATA_DIR=server/data STORAGE_DIR=server/storage node server/scripts/import-audio.mjs ...
```
