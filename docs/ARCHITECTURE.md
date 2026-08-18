# Architecture

Pulse Fitness Mini App is a standalone CRM-ready client portal. Application code depends on provider interfaces, not SQLite, Telegram, or a vendor CRM.

```text
Telegram Mini App / Browser Demo
        ↓
REST API
        ↓
Application / Domain Layer
        ↓
Provider / Repository Interfaces
        ↓
┌──────────────────────────┐
Local Providers         CRM Providers
SQLite                  External CRM stub
└──────────────────────────┘

+ EventProvider (local | mock | webhook)
+ NotificationProvider (local | mock | webhook)
```

`DATA_MODE`, `EVENT_ADAPTER` and `NOTIFICATION_ADAPTER` are resolved in `backend/src/container.ts`. Services never branch on `if (crmMode)`.

## Layers

| Layer | Responsibility |
| --- | --- |
| Routes | HTTP, auth, validation, serialization |
| Application services | Booking, membership ledger, retention, progress |
| Ports | `CustomerProvider`, `MembershipProvider`, `BookingProvider`, `ScheduleProvider`, `TrainerProvider`, `ActivityProvider`, `EventProvider`, `NotificationProvider` |
| Adapters | SQLite local, CRM stub, webhook/mock events |

Dependency direction: routes → services → ports ← adapters.

## Why a separate repository

Barber is single-service booking. Massage/SPA is appointment + course packages. Restaurant is tables and tickets. Fitness needs:

- class sessions with capacity;
- visit-based and unlimited memberships;
- ledger that redeems on attendance, not on booking;
- retention signals as a first-class admin screen.

Patterns are reused. Git history is new.

## Admin protection

Write endpoints on `/api/admin` are fail-closed: if `ADMIN_TOKEN` is empty, writes are rejected.

Read-only `/api/demo-admin` exists for sales demonstration when `ALLOW_DEMO_MODE` and `FEATURE_DEMO_ADMIN_PREVIEW` are on. Demo admin may mark attendance and queue retention notifications so the sales tour can show ledger movement without opening production writes.
