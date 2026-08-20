# Domain

Club: **Pulse Fitness Club**. Medical data is not stored.

## Entities

- **Club** / **Location** — бренд и филиалы.
- **Customer** — клиент, связанный с Telegram user id.
- **Trainer** — тренер филиала.
- **Activity** — тип класса (Functional, Yoga, Pilates, Stretching, Boxing, Cycle, Strength, HIIT).
- **MembershipPlan** — шаблон: `VISIT_BASED` или `UNLIMITED`.
- **CustomerMembership** — купленный абонемент. Клиент оформляет его через `POST /api/me/membership/purchase`; продление — вторая покупка нового membership.
- **ClassSession** — конкретное занятие в расписании.
- **Booking** — запись клиента на занятие.
- **MembershipLedger** — журнал движения посещений.
- **ClientNote** — заметка администратора.

## Statuses

Membership: `ACTIVE`, `FROZEN`, `EXPIRED`, `EXHAUSTED`, `CANCELLED`.

Class session: `SCHEDULED`, `CANCELLED`, `COMPLETED`.

Booking: `BOOKED`, `CANCELLED`, `ATTENDED`, `NO_SHOW`.

Ledger: `PURCHASE`, `REDEEM`, `RESTORE`, `ADJUSTMENT`, `EXPIRATION`.

## Booking rules

Cannot book:

- cancelled or completed session;
- a class in the past;
- a full class (`capacity - active bookings`);
- the same class twice (`BOOKED` / `ATTENDED`);
- without a usable active membership.

Checks run on the backend inside a SQLite transaction (`BEGIN IMMEDIATE` via `better-sqlite3` transaction). Active bookings have a partial unique index on `(customer_id, class_session_id)`.

## Membership ledger

Creating a booking **does not** redeem a visit. It only reserves bookable remaining.

`ATTENDED` inserts `REDEEM` with `delta = -1`, keyed by `booking_id`. The unique index makes this idempotent.

`CANCELLED` and `NO_SHOW` do not redeem.

If an administrator reverts `ATTENDED`, a `RESTORE` (`delta = +1`) is inserted.

Expired, exhausted and frozen memberships cannot be used for new bookings.

## Retention signals

- membership expiring within 7 days;
- visit-based remaining ≤ 2;
- inactive active client (≥ 12 days since last visit);
- last 3 bookings cancelled;
- ≥ 2 no-shows in 30 days.

Actions `Предложить продление` / `Напомнить` create a `NotificationProvider` record and a `retention.triggered` event. Real Telegram delivery is out of demo scope.
