# Royal Brick AI Auditor

MVP для записи, хранения, расшифровки и объективного анализа переговоров менеджеров Royal Brick.

## Стек

- React, TypeScript, Vite, React Router, Lucide React.
- Node.js, Express, TypeScript.
- SQLite через `better-sqlite3`.
- MediaRecorder API для записи в браузере.
- Локальное приватное хранение аудио на сервере.

## Локальный запуск

```bash
npm ci
cp .env.example .env
npm run dev
```

Откройте `http://localhost:5173`. Пароль берётся из `DEMO_PASSWORD` в `.env`.

Production-сборка:

```bash
npm run typecheck
npm run build
NODE_ENV=production npm start
```

## Режим без ИИ

По умолчанию `AI_PROVIDER=none`. В этом режиме сохраняются встречи и аудио, доступно ручное редактирование расшифровки, но автоматическая транскрибация и анализ не имитируются.

Подробности подключения провайдера описаны в [AI_INTEGRATION.md](AI_INTEGRATION.md). Импорт аудиозаписей описан в [IMPORT_AUDIO.md](IMPORT_AUDIO.md).

## Данные и безопасность

- SQLite хранится в `DATA_DIR`.
- Аудиофайлы хранятся в `STORAGE_DIR/audio`, вне публичной директории.
- `.env`, SQLite и аудиофайлы исключены из Git.
- API защищено HttpOnly + signed cookie-сессией.
- Для login действует ограничение неудачных попыток.
- Для браузерной записи нужен HTTPS или `localhost`.

Инструкция развёртывания на Ubuntu/Debian находится в [DEPLOY.md](DEPLOY.md).
