import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';

const databasePath =
  process.env.DATABASE_PATH ||
  path.join(process.cwd(), 'data', 'fitness.db');

const dir = path.dirname(databasePath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db: Database.Database = new Database(databasePath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function applySchema(database: Database.Database): void {
  database.pragma('foreign_keys = ON');

  database.exec(`
    CREATE TABLE IF NOT EXISTS clubs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      timezone TEXT NOT NULL DEFAULT 'Europe/Moscow'
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      club_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',
      active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (club_id) REFERENCES clubs(id)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id INTEGER UNIQUE,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      birth_date TEXT,
      username TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS trainers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      photo TEXT NOT NULL DEFAULT '',
      specialization TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (location_id) REFERENCES locations(id)
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      duration_minutes INTEGER NOT NULL,
      capacity_default INTEGER NOT NULL DEFAULT 12,
      image TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS membership_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      membership_type TEXT NOT NULL CHECK (membership_type IN ('VISIT_BASED', 'UNLIMITED')),
      duration_days INTEGER NOT NULL,
      visit_limit INTEGER,
      price INTEGER,
      description TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS customer_memberships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      membership_plan_id INTEGER NOT NULL,
      starts_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      total_visits INTEGER,
      remaining_visits INTEGER,
      status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'FROZEN', 'EXPIRED', 'EXHAUSTED', 'CANCELLED')),
      freeze_from TEXT,
      freeze_until TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (membership_plan_id) REFERENCES membership_plans(id)
    );

    CREATE TABLE IF NOT EXISTS class_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id INTEGER NOT NULL,
      activity_id INTEGER NOT NULL,
      trainer_id INTEGER NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'SCHEDULED'
        CHECK (status IN ('SCHEDULED', 'CANCELLED', 'COMPLETED')),
      FOREIGN KEY (location_id) REFERENCES locations(id),
      FOREIGN KEY (activity_id) REFERENCES activities(id),
      FOREIGN KEY (trainer_id) REFERENCES trainers(id)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      class_session_id INTEGER NOT NULL,
      customer_membership_id INTEGER,
      status TEXT NOT NULL DEFAULT 'BOOKED'
        CHECK (status IN ('BOOKED', 'CANCELLED', 'ATTENDED', 'NO_SHOW')),
      booked_at TEXT NOT NULL DEFAULT (datetime('now')),
      cancelled_at TEXT,
      attended_at TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (class_session_id) REFERENCES class_sessions(id),
      FOREIGN KEY (customer_membership_id) REFERENCES customer_memberships(id)
    );

    CREATE TABLE IF NOT EXISTS membership_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_membership_id INTEGER NOT NULL,
      booking_id INTEGER,
      operation TEXT NOT NULL
        CHECK (operation IN ('PURCHASE', 'REDEEM', 'RESTORE', 'ADJUSTMENT', 'EXPIRATION')),
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_membership_id) REFERENCES customer_memberships(id),
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    );

    CREATE TABLE IF NOT EXISTS client_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS business_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      channel TEXT NOT NULL DEFAULT 'local',
      status TEXT NOT NULL DEFAULT 'queued',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_active_unique
      ON bookings (customer_id, class_session_id)
      WHERE status IN ('BOOKED', 'ATTENDED');

    CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_redeem_booking
      ON membership_ledger (booking_id)
      WHERE operation = 'REDEEM' AND booking_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_sessions_starts
      ON class_sessions (starts_at, status);
    CREATE INDEX IF NOT EXISTS idx_bookings_session_status
      ON bookings (class_session_id, status);
    CREATE INDEX IF NOT EXISTS idx_bookings_customer
      ON bookings (customer_id, status);
    CREATE INDEX IF NOT EXISTS idx_memberships_customer
      ON customer_memberships (customer_id, status);
    CREATE INDEX IF NOT EXISTS idx_ledger_membership
      ON membership_ledger (customer_membership_id, operation);

    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function markMigrationApplied(database: Database.Database, id: string): void {
  database.prepare('INSERT OR IGNORE INTO schema_migrations (id) VALUES (?)').run(id);
}

export function migrate(database: Database.Database = db): void {
  applySchema(database);
  markMigrationApplied(database, '001_fitness_baseline');
}

export function createMemoryDatabase(): Database.Database {
  const memory = new Database(':memory:');
  migrate(memory);
  return memory;
}

migrate(db);
