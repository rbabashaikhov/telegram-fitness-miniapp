import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { TabBar } from '../components/TabBar';
import { formatBookingStatus, formatDateLabel } from '../lib/format';
import type { Booking } from '../types';

export function WorkoutsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();

  function load() {
    api
      .getMyBookings()
      .then((res) => setBookings(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить записи'));
  }

  useEffect(() => {
    load();
  }, []);

  const now = new Date().toISOString();
  const upcoming = bookings.filter((item) => item.status === 'BOOKED' && item.session.startsAt >= now);
  const completed = bookings.filter((item) => item.status === 'ATTENDED');
  const cancelled = bookings.filter((item) => item.status === 'CANCELLED' || item.status === 'NO_SHOW');

  async function cancel(id: number) {
    await api.cancelBooking(id);
    load();
  }

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Кабинет</p>
        <h1>Мои тренировки</h1>
      </header>
      {params.get('justBooked') && <p className="notice">Запись создана. Посещение ещё не списано.</p>}
      {error && <div className="state-block">{error}</div>}

      <section data-demo-tour="upcoming-workouts">
        <h2>Предстоящие</h2>
        {upcoming.length === 0 && <p className="muted">Нет предстоящих записей.</p>}
        {upcoming.map((item) => (
          <article key={item.id} className="card">
            <p className="eyebrow">
              {formatDateLabel(item.session.date)} · {item.session.time}
            </p>
            <h3>{item.session.activityName}</h3>
            <p className="muted">{item.session.trainerName}</p>
            <button type="button" className="btn btn-secondary" onClick={() => void cancel(item.id)}>
              Отменить запись
            </button>
          </article>
        ))}
      </section>

      <section>
        <h2>Завершённые</h2>
        {completed.length === 0 && <p className="muted">Пока нет посещений.</p>}
        {completed.map((item) => (
          <article key={item.id} className="card compact">
            <strong>{item.session.activityName}</strong>
            <span className="muted">
              {formatDateLabel(item.session.date)} · {formatBookingStatus(item.status)}
            </span>
          </article>
        ))}
      </section>

      <section>
        <h2>Отменённые</h2>
        {cancelled.map((item) => (
          <article key={item.id} className="card compact">
            <strong>{item.session.activityName}</strong>
            <span className="muted">
              {formatDateLabel(item.session.date)} · {formatBookingStatus(item.status)}
            </span>
          </article>
        ))}
      </section>
      <TabBar />
    </div>
  );
}
