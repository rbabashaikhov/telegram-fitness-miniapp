import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, getAdminToken, setAdminToken } from '../api/client';
import { formatDateLabel, formatMembershipStatus } from '../lib/format';
import type { AdminCustomer, AdminDashboard, Booking, LedgerEntry, Membership, RetentionSignal } from '../types';

type Tab = 'dashboard' | 'customers' | 'retention' | 'bookings' | 'schedule' | 'plans';

export function AdminPage({ demo = false }: { demo?: boolean }) {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'dashboard';
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [retention, setRetention] = useState<RetentionSignal[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [needsToken, setNeedsToken] = useState(false);
  const [tokenInput, setTokenInput] = useState(getAdminToken());
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      if (demo) {
        const [d, c, r, b] = await Promise.all([
          api.getDemoDashboard(),
          api.getDemoCustomers(),
          api.getDemoRetention(),
          api.getDemoBookings(),
        ]);
        setDashboard(d.data);
        setCustomers(c.data);
        setRetention(r.data);
        setBookings(b.data);
      } else {
        const [d, c, r, b] = await Promise.all([
          api.getAdminDashboard(),
          api.getAdminCustomers(),
          api.getAdminRetention(),
          api.getAdminBookings(),
        ]);
        setDashboard(d.data);
        setCustomers(c.data);
        setRetention(r.data);
        setBookings(b.data);
      }
      setNeedsToken(false);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) setNeedsToken(true);
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    }
  }, [demo]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openCustomer(id: number) {
    const res = demo ? await api.getDemoCustomer(id) : await api.getAdminCustomer(id);
    setSelected(res.data);
    const memberships = (res.data.memberships as Membership[] | undefined) ?? [];
    const active = memberships.find((item) => item.status === 'ACTIVE') ?? memberships[0];
    if (active) {
      const ledgerRes = demo ? await api.getDemoLedger(active.id) : await api.getAdminLedger(active.id);
      setLedger(ledgerRes.data);
    } else {
      setLedger([]);
    }
    setParams({ tab: 'customers', customer: String(id) });
  }

  async function markAttended(id: number) {
    if (demo) await api.updateDemoBooking(id, 'ATTENDED');
    else await api.updateAdminBooking(id, 'ATTENDED');
    setNotice('Посещение отмечено. Списание прошло через ledger.');
    await load();
  }

  async function retain(customerId: number, action: 'renewal' | 'reminder') {
    if (demo) {
      await fetch(`/api/demo-admin/retention/${customerId}/${action}`, { method: 'POST' });
      setNotice('Уведомление сохранено как notification record. Реальная Telegram-отправка на demo stage не нужна.');
      return;
    }
    await api.triggerRetention(customerId, action);
    setNotice(action === 'renewal' ? 'Предложение продления создано' : 'Напоминание создано');
  }

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div>
          <p className="eyebrow">{demo ? 'Демо · только чтение' : 'Кабинет администратора'}</p>
          <h1>Pulse Fitness Club</h1>
        </div>
        <Link to="/" className="btn btn-secondary">
          Открыть клиентское приложение
        </Link>
      </header>

      {needsToken && !demo && (
        <form
          className="card"
          onSubmit={(event) => {
            event.preventDefault();
            setAdminToken(tokenInput);
            void load();
          }}
        >
          <p>Введите ADMIN_TOKEN, чтобы открыть консоль.</p>
          <input value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} placeholder="ADMIN_TOKEN" />
          <button className="btn btn-primary" type="submit">
            Войти
          </button>
        </form>
      )}

      {error && <div className="state-block">{error}</div>}
      {notice && <p className="notice">{notice}</p>}

      <div className="admin-tabs">
        {(['dashboard', 'customers', 'retention', 'bookings'] as Tab[]).map((item) => (
          <button
            key={item}
            type="button"
            className={tab === item ? 'admin-tab is-active' : 'admin-tab'}
            onClick={() => setParams({ tab: item })}
          >
            {item === 'dashboard' && 'Сводка'}
            {item === 'customers' && 'Клиенты'}
            {item === 'retention' && 'Удержание'}
            {item === 'bookings' && 'Записи'}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && dashboard && (
        <div className="kpi-grid" data-demo-tour="admin-dashboard">
          <article className="card kpi">
            <span>Активные клиенты</span>
            <strong>{dashboard.activeCustomers}</strong>
          </article>
          <article className="card kpi">
            <span>Активные абонементы</span>
            <strong>{dashboard.activeMemberships}</strong>
          </article>
          <article className="card kpi">
            <span>Записи сегодня</span>
            <strong>{dashboard.bookingsToday}</strong>
          </article>
          <article className="card kpi">
            <span>Посещения за месяц</span>
            <strong>{dashboard.attendanceThisMonth}</strong>
          </article>
          <article className="card kpi">
            <span>Классы сегодня</span>
            <strong>{dashboard.classesToday}</strong>
          </article>
          <article className="card kpi">
            <span>Заполняемость</span>
            <strong>{dashboard.occupancyToday}%</strong>
          </article>
          <article className="card kpi">
            <span>Скоро истекают</span>
            <strong>{dashboard.membershipsExpiringSoon}</strong>
          </article>
          <article className="card kpi">
            <span>Клиенты в зоне риска</span>
            <strong>{dashboard.clientsAtRisk}</strong>
          </article>
        </div>
      )}

      {tab === 'customers' && (
        <div className="admin-split">
          <div className="admin-table-wrap" data-demo-tour="admin-customers">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>Телефон</th>
                  <th>Абонемент</th>
                  <th>До</th>
                  <th>Остаток</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} onClick={() => void openCustomer(customer.id)}>
                    <td>
                      {customer.firstName} {customer.lastName}
                    </td>
                    <td>{customer.phone}</td>
                    <td>{customer.membershipName}</td>
                    <td>{customer.expiresAt ? formatDateLabel(customer.expiresAt) : '—'}</td>
                    <td>{customer.remainingVisits ?? '∞'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && (
            <article className="card" data-demo-tour="customer-profile">
              <h2>
                {(selected.firstName as string) || (selected.first_name as string)}{' '}
                {(selected.lastName as string) || (selected.last_name as string)}
              </h2>
              <p className="muted">{(selected.phone as string) || ''}</p>
              {((selected.memberships as Membership[]) || []).map((item) => (
                <p key={item.id}>
                  {item.name} · {formatMembershipStatus(item.status)} · осталось {item.remainingVisits ?? '∞'}
                </p>
              ))}
              <h3>Ledger</h3>
              <ul className="item-list">
                {ledger.map((entry) => (
                  <li key={entry.id}>
                    <span>{entry.operation}</span>
                    <span>
                      {entry.delta > 0 ? '+' : ''}
                      {entry.delta}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          )}
        </div>
      )}

      {tab === 'retention' && (
        <div className="stack" data-demo-tour="retention-list">
          <p className="lead">Клиенты, которых клуб рискует потерять, и те, кому пора продлевать абонемент.</p>
          {retention.map((signal, index) => (
            <article key={`${signal.kind}-${signal.customerId}-${index}`} className="card retention-card">
              <p className={`severity ${signal.severity}`}>{signal.title}</p>
              <h3>{signal.customerName}</h3>
              <p>{signal.detail}</p>
              <div className="row-actions">
                <button type="button" className="btn btn-secondary" onClick={() => void openCustomer(signal.customerId)}>
                  Открыть клиента
                </button>
                <button type="button" className="btn btn-primary" onClick={() => void retain(signal.customerId, 'renewal')}>
                  Предложить продление
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => void retain(signal.customerId, 'reminder')}>
                  Напомнить
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === 'bookings' && (
        <div className="stack" data-demo-tour="admin-bookings">
          {bookings
            .filter((item) => item.status === 'BOOKED')
            .slice(0, 20)
            .map((item) => (
              <article key={item.id} className="card">
                <p className="eyebrow">
                  {item.session.date} · {item.session.time}
                </p>
                <h3>
                  {item.customerName} · {item.session.activityName}
                </h3>
                <p className="muted">{item.membershipName}</p>
                <button type="button" className="btn btn-primary" onClick={() => void markAttended(item.id)}>
                  Отметить ATTENDED
                </button>
              </article>
            ))}
        </div>
      )}
    </div>
  );
}

export function DemoAdminPage() {
  return <AdminPage demo />;
}
