# Pulse Fitness Club — Telegram Mini App

Telegram Mini App для фитнес-клуба: **абонементы, запись на групповые тренировки, посещаемость и удержание клиентов**.

Это не каталог и не просто booking. Клиент открывает персональный кабинет. Клуб видит, кому пора продлевать карту и кого рискует потерять.

## Capabilities

- персональный dashboard клиента;
- расписание классов с местами;
- запись с проверкой абонемента на backend;
- membership ledger: списание только после `ATTENDED`;
- прогресс месяца / серия недель — без медицинской аналитики;
- admin console: клиенты, абонементы, расписание, записи;
- экран **Attention / Retention**;
- CRM-ready ports + event/notification adapters;
- browser demo + Telegram initData.

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

- клиент: http://localhost:5173
- API: http://localhost:3000/api/health
- demo admin: http://localhost:5173/demo/admin
- write admin: http://localhost:5173/admin (нужен `ADMIN_TOKEN`)

## Env vars

См. `.env.example`. Важно:

| Variable | Meaning |
| --- | --- |
| `ALLOW_DEMO_MODE` | Browser demo без Telegram initData |
| `TELEGRAM_BOT_TOKEN` | Валидация initData в production |
| `DATA_MODE` | `local` или `crm` (stub 501) |
| `EVENT_ADAPTER` | `local` / `mock` / `webhook` |
| `NOTIFICATION_ADAPTER` | `local` / `mock` / `webhook` |
| `ADMIN_TOKEN` | Write admin. Пустой токен **не** открывает записи |
| `DATABASE_PATH` | SQLite file. Docker: `/data/fitness.db` |

## Docker

Один контейнер: Express отдаёт `/api/*` и frontend static.

```bash
docker compose up --build
```

SQLite на volume `/data/fitness.db`. После restart данные сохраняются.

Production deploy на VPS из этого репозитория не выполнялся, пока нет отдельной команды.

## Architecture

```text
Frontend (React + Vite + Telegram WebApp)
        ↓ REST
Express API
        ↓
Application services
        ↓
Domain ports
        ↓
Providers: SQLite | CRM stub | events | notifications
```

Выбор implementations только в `backend/src/container.ts`. Services не ветвятся по `DATA_MODE`.

Подробнее: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DOMAIN.md](docs/DOMAIN.md), [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).
