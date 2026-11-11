# Развёртывание на Ubuntu/Debian VPS

Инструкция рассчитана на один сервер с 1–2 ГБ RAM. Docker, PostgreSQL и Redis не требуются.

## 1. Подготовить сервер

Установите Node.js LTS, npm, Git и Caddy штатными способами для вашей версии Ubuntu/Debian. Создайте отдельного системного пользователя и каталог приложения:

```bash
sudo adduser --system --group --home /opt/royal-brick-ai-auditor royalbrick
sudo mkdir -p /opt/royal-brick-ai-auditor
sudo chown -R royalbrick:royalbrick /opt/royal-brick-ai-auditor
```

## 2. Установить приложение

```bash
sudo -u royalbrick git clone <URL_РЕПОЗИТОРИЯ> /opt/royal-brick-ai-auditor
cd /opt/royal-brick-ai-auditor
sudo -u royalbrick npm ci
sudo -u royalbrick cp .env.example .env
sudo -u royalbrick nano .env
sudo -u royalbrick npm run build
sudo -u royalbrick mkdir -p server/data server/storage/audio server/storage/.tmp
```

В `.env` обязательно задайте уникальные значения:

```dotenv
NODE_ENV=production
PORT=4000
CLIENT_ORIGIN=https://auditor.example.com
DEMO_PASSWORD=<длинный-демонстрационный-пароль>
SESSION_SECRET=<длинная-случайная-строка>
TRUST_PROXY=true
DATA_DIR=/opt/royal-brick-ai-auditor/server/data
STORAGE_DIR=/opt/royal-brick-ai-auditor/server/storage
AI_PROVIDER=none
```

Не помещайте `.env` в репозиторий и не передавайте его в чат или GitHub.

## 3. Запустить через systemd

Скопируйте unit из `deploy/royal-brick-ai-auditor.service`:

```bash
sudo cp deploy/royal-brick-ai-auditor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now royal-brick-ai-auditor
sudo systemctl status royal-brick-ai-auditor
```

Проверка backend до настройки домена:

```bash
curl http://127.0.0.1:4000/health
```

Ожидаемый ответ: `{"ok":true}`.

## 4. Настроить HTTPS через Caddy

Направьте DNS A-запись домена на IP VPS. Затем скопируйте пример:

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy сам получает и обновляет сертификат для домена при корректно настроенных DNS и открытых портах 80/443.

Если нужен бесплатный поддомен, можно использовать доступный на момент развёртывания DNS-сервис с бесплатным поддоменом, например DuckDNS или No-IP, и направить его на VPS. Проверьте актуальные условия выбранного сервиса самостоятельно.

## 5. Импорт аудио

Аудиозаписи не нужно копировать в GitHub. Используйте [IMPORT_AUDIO.md](IMPORT_AUDIO.md), затем проверьте встречу в истории приложения.

## 6. Резервное копирование

Сохраняйте SQLite и приватное хранилище аудио на внешний защищённый носитель:

```bash
sudo tar -czf /var/backups/royal-brick-$(date +%F).tar.gz \
  /opt/royal-brick-ai-auditor/server/data \
  /opt/royal-brick-ai-auditor/server/storage
```

Проверьте восстановление на отдельной директории до удаления старой копии. Не публикуйте архивы с аудио.

## 7. Обновление

```bash
cd /opt/royal-brick-ai-auditor
sudo -u royalbrick git pull --ff-only
sudo -u royalbrick npm ci
sudo -u royalbrick npm run build
sudo systemctl restart royal-brick-ai-auditor
sudo systemctl status royal-brick-ai-auditor
```
