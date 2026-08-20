# Integrations

The application is not a dead-end SQLite demo. Storage and outbound side-effects are ports.

## Data ports

Local adapter: SQLite (`better-sqlite3`, WAL).

CRM mode (`DATA_MODE=crm`): `backend/src/providers/crm/stub.ts` returns **501 `CRM_NOT_CONFIGURED`**. Implement the same interfaces against a partner API; do not add `if (dataMode === 'crm')` in services.

A real fitness CRM / club system should provide:

- customers (identity, contacts, status);
- membership plans and issued memberships;
- visit ledger or an equivalent remaining-visits source of truth;
- class schedule (location, activity, trainer, capacity, time);
- bookings and attendance;
- trainers and activity catalog;
- optional notes.

## Events

`EventProvider` modes: `local`, `mock`, `webhook`.

Examples:

- `customer.created`
- `membership.issued`
- `booking.created` / `booking.cancelled` / `booking.attended`
- `customer.inactive`
- `retention.triggered`

Webhook adapter POSTs `{ id, name, payload, createdAt }` to `EVENT_WEBHOOK_URL`. This is the hook for n8n, a Telegram bot, email or analytics.

## Notifications

`NotificationProvider` modes: `local`, `mock`, `webhook`.

Demo actions persist a notification record. Production can swap the adapter for Telegram Bot API or a message bus without changing retention services.

## Payments

`PAYMENT_ADAPTER=mock` (default, demo) returns a mock intent and the service calls existing `issueMembership()`.

`PAYMENT_ADAPTER=external` throws **501 `PAYMENT_NOT_CONFIGURED`**. There is no acquiring in this demo.

## Auth

Telegram Mini App: `x-telegram-init-data` validated with the bot token.

Browser demo: `ALLOW_DEMO_MODE=true` maps to demo customer Александр Волков (`telegram_user_id = 999000001`). Demo mode does not disable production validation when a bot token is present and demo is off.
