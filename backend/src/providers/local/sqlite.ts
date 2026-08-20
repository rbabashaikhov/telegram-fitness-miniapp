import type Database from 'better-sqlite3';
import type {
  Activity,
  Booking,
  BookingDetails,
  BookingStatus,
  ClassSession,
  ClassSessionDetails,
  ClassSessionStatus,
  ClientNote,
  Club,
  Customer,
  CustomerMembership,
  LedgerOperation,
  Location,
  MembershipLedgerEntry,
  MembershipPlan,
  NotificationKind,
  NotificationRecord,
  OutboundEventName,
  TelegramUser,
  Trainer,
} from '../../types.js';
import type { Providers } from '../types.js';

function bool(value: number | boolean): boolean {
  return Boolean(value);
}

type SqliteFlag<T> = Omit<T, 'active'> & { active: number };

function withActive<T extends { active: boolean }>(row: SqliteFlag<T>): T {
  return { ...row, active: bool(row.active) } as T;
}

const SESSION_SELECT = `
  SELECT
    s.*,
    a.name AS activity_name,
    a.image AS activity_image,
    a.duration_minutes AS duration_minutes,
    t.name AS trainer_name,
    t.photo AS trainer_photo,
    t.specialization AS trainer_specialization,
    l.name AS location_name,
    l.address AS location_address,
    (
      SELECT COUNT(*) FROM bookings b
      WHERE b.class_session_id = s.id AND b.status IN ('BOOKED', 'ATTENDED')
    ) AS booked_count
  FROM class_sessions s
  JOIN activities a ON a.id = s.activity_id
  JOIN trainers t ON t.id = s.trainer_id
  JOIN locations l ON l.id = s.location_id
`;

function mapSession(row: ClassSessionDetails & { booked_count: number }): ClassSessionDetails {
  const booked = Number(row.booked_count || 0);
  return {
    ...row,
    booked_count: booked,
    spots_left: Math.max(0, row.capacity - booked),
  };
}

const BOOKING_SELECT = `
  SELECT
    b.*,
    c.first_name AS customer_first_name,
    c.last_name AS customer_last_name,
    p.name AS membership_name,
    s.id AS session_id,
    s.location_id AS session_location_id,
    s.activity_id AS session_activity_id,
    s.trainer_id AS session_trainer_id,
    s.starts_at AS session_starts_at,
    s.ends_at AS session_ends_at,
    s.capacity AS session_capacity,
    s.status AS session_status,
    a.name AS activity_name,
    a.image AS activity_image,
    a.duration_minutes AS duration_minutes,
    t.name AS trainer_name,
    t.photo AS trainer_photo,
    t.specialization AS trainer_specialization,
    l.name AS location_name,
    l.address AS location_address,
    (
      SELECT COUNT(*) FROM bookings bx
      WHERE bx.class_session_id = s.id AND bx.status IN ('BOOKED', 'ATTENDED')
    ) AS booked_count
  FROM bookings b
  JOIN customers c ON c.id = b.customer_id
  JOIN class_sessions s ON s.id = b.class_session_id
  JOIN activities a ON a.id = s.activity_id
  JOIN trainers t ON t.id = s.trainer_id
  JOIN locations l ON l.id = s.location_id
  LEFT JOIN customer_memberships m ON m.id = b.customer_membership_id
  LEFT JOIN membership_plans p ON p.id = m.membership_plan_id
`;

type BookingRow = Booking & {
  customer_first_name: string;
  customer_last_name: string;
  membership_name: string | null;
  session_id: number;
  session_location_id: number;
  session_activity_id: number;
  session_trainer_id: number;
  session_starts_at: string;
  session_ends_at: string;
  session_capacity: number;
  session_status: ClassSessionStatus;
  activity_name: string;
  activity_image: string;
  duration_minutes: number;
  trainer_name: string;
  trainer_photo: string;
  trainer_specialization: string;
  location_name: string;
  location_address: string;
  booked_count: number;
};

function mapBooking(row: BookingRow): BookingDetails {
  const booked = Number(row.booked_count || 0);
  return {
    id: row.id,
    customer_id: row.customer_id,
    class_session_id: row.class_session_id,
    customer_membership_id: row.customer_membership_id,
    status: row.status,
    booked_at: row.booked_at,
    cancelled_at: row.cancelled_at,
    attended_at: row.attended_at,
    customer_first_name: row.customer_first_name,
    customer_last_name: row.customer_last_name,
    membership_name: row.membership_name,
    session: {
      id: row.session_id,
      location_id: row.session_location_id,
      activity_id: row.session_activity_id,
      trainer_id: row.session_trainer_id,
      starts_at: row.session_starts_at,
      ends_at: row.session_ends_at,
      capacity: row.session_capacity,
      status: row.session_status,
      activity_name: row.activity_name,
      activity_image: row.activity_image,
      duration_minutes: row.duration_minutes,
      trainer_name: row.trainer_name,
      trainer_photo: row.trainer_photo,
      trainer_specialization: row.trainer_specialization,
      location_name: row.location_name,
      location_address: row.location_address,
      booked_count: booked,
      spots_left: Math.max(0, row.session_capacity - booked),
    },
  };
}

export function createLocalProviders(database: Database.Database): Omit<Providers, 'payments'> {
  const getSessionById = database.prepare(`${SESSION_SELECT} WHERE s.id = ?`);
  const getBookingById = database.prepare(`${BOOKING_SELECT} WHERE b.id = ?`);

  return {
    club: {
      getClub() {
        return database.prepare('SELECT * FROM clubs LIMIT 1').get() as Club;
      },
      listLocations(activeOnly = false) {
        const sql = activeOnly
          ? 'SELECT * FROM locations WHERE active = 1 ORDER BY id'
          : 'SELECT * FROM locations ORDER BY id';
        return (database.prepare(sql).all() as SqliteFlag<Location>[]).map(withActive);
      },
      getLocation(id) {
        const row = database.prepare('SELECT * FROM locations WHERE id = ?').get(id) as SqliteFlag<Location> | undefined;
        return row ? withActive(row) : undefined;
      },
    },

    customers: {
      upsert(user: TelegramUser, extras = {}) {
        const existing = database
          .prepare('SELECT * FROM customers WHERE telegram_user_id = ?')
          .get(user.id) as Customer | undefined;
        if (existing) {
          database
            .prepare(
              `UPDATE customers
               SET first_name = COALESCE(NULLIF(?, ''), first_name),
                   last_name = COALESCE(NULLIF(?, ''), last_name),
                   username = COALESCE(?, username),
                   phone = COALESCE(NULLIF(?, ''), phone),
                   email = COALESCE(NULLIF(?, ''), email),
                   updated_at = datetime('now')
               WHERE id = ?`,
            )
            .run(
              user.first_name || '',
              user.last_name || '',
              user.username || null,
              extras.phone || '',
              extras.email || '',
              existing.id,
            );
          return {
            customer: database.prepare('SELECT * FROM customers WHERE id = ?').get(existing.id) as Customer,
            created: false,
          };
        }
        const result = database
          .prepare(
            `INSERT INTO customers (telegram_user_id, first_name, last_name, username, phone, email, status)
             VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
          )
          .run(
            user.id,
            user.first_name || '',
            user.last_name || '',
            user.username || null,
            extras.phone || '',
            extras.email || '',
          );
        return {
          customer: database.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid) as Customer,
          created: true,
        };
      },
      getByTelegramUserId(telegramUserId) {
        return database
          .prepare('SELECT * FROM customers WHERE telegram_user_id = ?')
          .get(telegramUserId) as Customer | undefined;
      },
      getById(id) {
        return database.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer | undefined;
      },
      listAll() {
        return database.prepare('SELECT * FROM customers ORDER BY last_name, first_name').all() as Customer[];
      },
      update(id, patch) {
        const current = this.getById(id);
        if (!current) throw new Error('Customer not found');
        database
          .prepare(
            `UPDATE customers
             SET first_name = ?, last_name = ?, phone = ?, email = ?, status = ?, updated_at = datetime('now')
             WHERE id = ?`,
          )
          .run(
            patch.first_name ?? current.first_name,
            patch.last_name ?? current.last_name,
            patch.phone ?? current.phone,
            patch.email ?? current.email,
            patch.status ?? current.status,
            id,
          );
        return this.getById(id)!;
      },
      listNotes(customerId) {
        return database
          .prepare('SELECT * FROM client_notes WHERE customer_id = ? ORDER BY created_at DESC')
          .all(customerId) as ClientNote[];
      },
      addNote(customerId, text) {
        const result = database
          .prepare('INSERT INTO client_notes (customer_id, text) VALUES (?, ?)')
          .run(customerId, text);
        return database.prepare('SELECT * FROM client_notes WHERE id = ?').get(result.lastInsertRowid) as ClientNote;
      },
    },

    trainers: {
      list(activeOnly = false) {
        const sql = activeOnly
          ? 'SELECT * FROM trainers WHERE active = 1 ORDER BY name'
          : 'SELECT * FROM trainers ORDER BY name';
        return (database.prepare(sql).all() as SqliteFlag<Trainer>[]).map(withActive);
      },
      getById(id) {
        const row = database.prepare('SELECT * FROM trainers WHERE id = ?').get(id) as SqliteFlag<Trainer> | undefined;
        return row ? withActive(row) : undefined;
      },
      create(params) {
        const result = database
          .prepare(
            `INSERT INTO trainers (location_id, name, photo, specialization, description, active)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            params.location_id,
            params.name,
            params.photo,
            params.specialization,
            params.description,
            params.active ? 1 : 0,
          );
        return this.getById(Number(result.lastInsertRowid))!;
      },
      update(id, patch) {
        const current = this.getById(id);
        if (!current) throw new Error('Trainer not found');
        database
          .prepare(
            `UPDATE trainers
             SET location_id = ?, name = ?, photo = ?, specialization = ?, description = ?, active = ?
             WHERE id = ?`,
          )
          .run(
            patch.location_id ?? current.location_id,
            patch.name ?? current.name,
            patch.photo ?? current.photo,
            patch.specialization ?? current.specialization,
            patch.description ?? current.description,
            (patch.active ?? current.active) ? 1 : 0,
            id,
          );
        return this.getById(id)!;
      },
    },

    activities: {
      list(activeOnly = false) {
        const sql = activeOnly
          ? 'SELECT * FROM activities WHERE active = 1 ORDER BY name'
          : 'SELECT * FROM activities ORDER BY name';
        return (database.prepare(sql).all() as SqliteFlag<Activity>[]).map(withActive);
      },
      getById(id) {
        const row = database.prepare('SELECT * FROM activities WHERE id = ?').get(id) as SqliteFlag<Activity> | undefined;
        return row ? withActive(row) : undefined;
      },
      create(params) {
        const result = database
          .prepare(
            `INSERT INTO activities (name, description, duration_minutes, capacity_default, image, active)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            params.name,
            params.description,
            params.duration_minutes,
            params.capacity_default,
            params.image,
            params.active ? 1 : 0,
          );
        return this.getById(Number(result.lastInsertRowid))!;
      },
      update(id, patch) {
        const current = this.getById(id);
        if (!current) throw new Error('Activity not found');
        database
          .prepare(
            `UPDATE activities
             SET name = ?, description = ?, duration_minutes = ?, capacity_default = ?, image = ?, active = ?
             WHERE id = ?`,
          )
          .run(
            patch.name ?? current.name,
            patch.description ?? current.description,
            patch.duration_minutes ?? current.duration_minutes,
            patch.capacity_default ?? current.capacity_default,
            patch.image ?? current.image,
            (patch.active ?? current.active) ? 1 : 0,
            id,
          );
        return this.getById(id)!;
      },
    },

    memberships: {
      listPlans(activeOnly = false) {
        const sql = activeOnly
          ? 'SELECT * FROM membership_plans WHERE active = 1 ORDER BY id'
          : 'SELECT * FROM membership_plans ORDER BY id';
        return (database.prepare(sql).all() as SqliteFlag<MembershipPlan>[]).map(withActive);
      },
      getPlan(id) {
        const row = database.prepare('SELECT * FROM membership_plans WHERE id = ?').get(id) as
          | SqliteFlag<MembershipPlan>
          | undefined;
        return row ? withActive(row) : undefined;
      },
      createPlan(params) {
        const result = database
          .prepare(
            `INSERT INTO membership_plans
              (name, membership_type, duration_days, visit_limit, price, description, active)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            params.name,
            params.membership_type,
            params.duration_days,
            params.visit_limit,
            params.price,
            params.description,
            params.active ? 1 : 0,
          );
        return this.getPlan(Number(result.lastInsertRowid))!;
      },
      updatePlan(id, patch) {
        const current = this.getPlan(id);
        if (!current) throw new Error('Plan not found');
        database
          .prepare(
            `UPDATE membership_plans
             SET name = ?, membership_type = ?, duration_days = ?, visit_limit = ?, price = ?, description = ?, active = ?
             WHERE id = ?`,
          )
          .run(
            patch.name ?? current.name,
            patch.membership_type ?? current.membership_type,
            patch.duration_days ?? current.duration_days,
            patch.visit_limit === undefined ? current.visit_limit : patch.visit_limit,
            patch.price === undefined ? current.price : patch.price,
            patch.description ?? current.description,
            (patch.active ?? current.active) ? 1 : 0,
            id,
          );
        return this.getPlan(id)!;
      },
      listCustomerMemberships(customerId) {
        if (customerId) {
          return database
            .prepare('SELECT * FROM customer_memberships WHERE customer_id = ? ORDER BY created_at DESC')
            .all(customerId) as CustomerMembership[];
        }
        return database
          .prepare('SELECT * FROM customer_memberships ORDER BY created_at DESC')
          .all() as CustomerMembership[];
      },
      getCustomerMembership(id) {
        return database.prepare('SELECT * FROM customer_memberships WHERE id = ?').get(id) as
          | CustomerMembership
          | undefined;
      },
      createCustomerMembership(params) {
        const result = database
          .prepare(
            `INSERT INTO customer_memberships
              (customer_id, membership_plan_id, starts_at, expires_at, total_visits, remaining_visits, status, freeze_from, freeze_until)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            params.customer_id,
            params.membership_plan_id,
            params.starts_at,
            params.expires_at,
            params.total_visits,
            params.remaining_visits,
            params.status,
            params.freeze_from,
            params.freeze_until,
          );
        return this.getCustomerMembership(Number(result.lastInsertRowid))!;
      },
      updateCustomerMembership(id, patch) {
        const current = this.getCustomerMembership(id);
        if (!current) throw new Error('Membership not found');
        database
          .prepare(
            `UPDATE customer_memberships
             SET starts_at = ?, expires_at = ?, remaining_visits = ?, status = ?, freeze_from = ?, freeze_until = ?
             WHERE id = ?`,
          )
          .run(
            patch.starts_at ?? current.starts_at,
            patch.expires_at ?? current.expires_at,
            patch.remaining_visits === undefined ? current.remaining_visits : patch.remaining_visits,
            patch.status ?? current.status,
            patch.freeze_from === undefined ? current.freeze_from : patch.freeze_from,
            patch.freeze_until === undefined ? current.freeze_until : patch.freeze_until,
            id,
          );
        return this.getCustomerMembership(id)!;
      },
      listLedger(membershipId) {
        return database
          .prepare('SELECT * FROM membership_ledger WHERE customer_membership_id = ? ORDER BY id')
          .all(membershipId) as MembershipLedgerEntry[];
      },
      findRedeemForBooking(bookingId) {
        return database
          .prepare("SELECT * FROM membership_ledger WHERE booking_id = ? AND operation = 'REDEEM'")
          .get(bookingId) as MembershipLedgerEntry | undefined;
      },
      insertLedger(params) {
        const result = database
          .prepare(
            `INSERT INTO membership_ledger (customer_membership_id, booking_id, operation, delta, reason)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .run(
            params.customerMembershipId,
            params.bookingId ?? null,
            params.operation,
            params.delta,
            params.reason ?? '',
          );
        return database
          .prepare('SELECT * FROM membership_ledger WHERE id = ?')
          .get(result.lastInsertRowid) as MembershipLedgerEntry;
      },
    },

    schedule: {
      listSessions(filters = {}) {
        const clauses: string[] = [];
        const values: unknown[] = [];
        if (filters.from) {
          clauses.push('s.starts_at >= ?');
          values.push(filters.from);
        }
        if (filters.to) {
          clauses.push('s.starts_at < ?');
          values.push(filters.to);
        }
        if (filters.activityId) {
          clauses.push('s.activity_id = ?');
          values.push(filters.activityId);
        }
        if (filters.trainerId) {
          clauses.push('s.trainer_id = ?');
          values.push(filters.trainerId);
        }
        if (filters.locationId) {
          clauses.push('s.location_id = ?');
          values.push(filters.locationId);
        }
        if (filters.status) {
          clauses.push('s.status = ?');
          values.push(filters.status);
        }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const rows = database
          .prepare(`${SESSION_SELECT} ${where} ORDER BY s.starts_at`)
          .all(...values) as Array<ClassSessionDetails & { booked_count: number }>;
        return rows.map(mapSession);
      },
      getSession(id) {
        const row = getSessionById.get(id) as (ClassSessionDetails & { booked_count: number }) | undefined;
        return row ? mapSession(row) : undefined;
      },
      createSession(params: Omit<ClassSession, 'id'>) {
        const result = database
          .prepare(
            `INSERT INTO class_sessions (location_id, activity_id, trainer_id, starts_at, ends_at, capacity, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            params.location_id,
            params.activity_id,
            params.trainer_id,
            params.starts_at,
            params.ends_at,
            params.capacity,
            params.status,
          );
        return this.getSession(Number(result.lastInsertRowid))!;
      },
      updateSession(id, patch) {
        const current = this.getSession(id);
        if (!current) throw new Error('Session not found');
        database
          .prepare(
            `UPDATE class_sessions
             SET location_id = ?, activity_id = ?, trainer_id = ?, starts_at = ?, ends_at = ?, capacity = ?, status = ?
             WHERE id = ?`,
          )
          .run(
            patch.location_id ?? current.location_id,
            patch.activity_id ?? current.activity_id,
            patch.trainer_id ?? current.trainer_id,
            patch.starts_at ?? current.starts_at,
            patch.ends_at ?? current.ends_at,
            patch.capacity ?? current.capacity,
            patch.status ?? current.status,
            id,
          );
        return this.getSession(id)!;
      },
      countActiveBookings(sessionId) {
        const row = database
          .prepare(
            "SELECT COUNT(*) AS count FROM bookings WHERE class_session_id = ? AND status IN ('BOOKED', 'ATTENDED')",
          )
          .get(sessionId) as { count: number };
        return Number(row.count);
      },
    },

    bookings: {
      getById(id) {
        const row = getBookingById.get(id) as BookingRow | undefined;
        return row ? mapBooking(row) : undefined;
      },
      listByCustomer(customerId) {
        const rows = database
          .prepare(`${BOOKING_SELECT} WHERE b.customer_id = ? ORDER BY s.starts_at DESC`)
          .all(customerId) as BookingRow[];
        return rows.map(mapBooking);
      },
      list(filters = {}) {
        const clauses: string[] = [];
        const values: unknown[] = [];
        if (filters.status) {
          clauses.push('b.status = ?');
          values.push(filters.status);
        }
        if (filters.customerId) {
          clauses.push('b.customer_id = ?');
          values.push(filters.customerId);
        }
        if (filters.sessionId) {
          clauses.push('b.class_session_id = ?');
          values.push(filters.sessionId);
        }
        if (filters.from) {
          clauses.push('s.starts_at >= ?');
          values.push(filters.from);
        }
        if (filters.to) {
          clauses.push('s.starts_at < ?');
          values.push(filters.to);
        }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const rows = database
          .prepare(`${BOOKING_SELECT} ${where} ORDER BY s.starts_at DESC`)
          .all(...values) as BookingRow[];
        return rows.map(mapBooking);
      },
      findActiveForSession(customerId, sessionId) {
        return database
          .prepare(
            `SELECT * FROM bookings
             WHERE customer_id = ? AND class_session_id = ? AND status IN ('BOOKED', 'ATTENDED')`,
          )
          .get(customerId, sessionId) as Booking | undefined;
      },
      insert(params) {
        const result = database
          .prepare(
            `INSERT INTO bookings (customer_id, class_session_id, customer_membership_id, status)
             VALUES (?, ?, ?, 'BOOKED')`,
          )
          .run(params.customerId, params.classSessionId, params.customerMembershipId);
        return this.getById(Number(result.lastInsertRowid))!;
      },
      updateStatus(id, status, extra = {}) {
        const current = this.getById(id);
        if (!current) throw new Error('Booking not found');
        database
          .prepare(
            `UPDATE bookings
             SET status = ?, cancelled_at = ?, attended_at = ?
             WHERE id = ?`,
          )
          .run(
            status,
            extra.cancelledAt !== undefined ? extra.cancelledAt : current.cancelled_at,
            extra.attendedAt !== undefined ? extra.attendedAt : current.attended_at,
            id,
          );
        return this.getById(id)!;
      },
    },

    events: {
      publish(name: OutboundEventName, payload: Record<string, unknown>) {
        const result = database
          .prepare('INSERT INTO business_events (name, payload) VALUES (?, ?)')
          .run(name, JSON.stringify(payload));
        const row = database.prepare('SELECT * FROM business_events WHERE id = ?').get(result.lastInsertRowid) as {
          id: number;
          name: OutboundEventName;
          payload: string;
          created_at: string;
        };
        return { ...row, payload: JSON.parse(row.payload) as Record<string, unknown> };
      },
      list(limit = 50) {
        const rows = database
          .prepare('SELECT * FROM business_events ORDER BY id DESC LIMIT ?')
          .all(limit) as Array<{ id: number; name: OutboundEventName; payload: string; created_at: string }>;
        return rows.map((row) => ({
          ...row,
          payload: JSON.parse(row.payload) as Record<string, unknown>,
        }));
      },
    },

    notifications: {
      enqueue(params: {
        customerId: number;
        kind: NotificationKind;
        title: string;
        body: string;
      }) {
        const result = database
          .prepare(
            `INSERT INTO notifications (customer_id, kind, title, body, channel, status)
             VALUES (?, ?, ?, ?, 'local', 'queued')`,
          )
          .run(params.customerId, params.kind, params.title, params.body);
        return database
          .prepare('SELECT * FROM notifications WHERE id = ?')
          .get(result.lastInsertRowid) as NotificationRecord;
      },
      list(customerId) {
        if (customerId) {
          return database
            .prepare('SELECT * FROM notifications WHERE customer_id = ? ORDER BY id DESC')
            .all(customerId) as NotificationRecord[];
        }
        return database.prepare('SELECT * FROM notifications ORDER BY id DESC').all() as NotificationRecord[];
      },
    },

    transaction<T>(fn: () => T): T {
      return database.transaction(fn)();
    },
  };
}
