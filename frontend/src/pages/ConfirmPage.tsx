import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { formatDateLabel, formatDuration } from '../lib/format';
import type { Membership, Session } from '../types';

export function ConfirmPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sessionId = Number(id);
    if (!sessionId) return;
    Promise.all([api.getSession(sessionId), api.getMemberships()])
      .then(([s, m]) => {
        setSession(s.data);
        setMembership(m.data.find((item) => item.status === 'ACTIVE') ?? m.data[0] ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить занятие'));
  }, [id]);

  async function confirm() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await api.createBooking(session.id, membership?.id);
      navigate('/workouts?justBooked=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось записаться');
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return <div className="page">{error ? error : <div className="loading">Загрузка…</div>}</div>;
  }

  return (
    <div className="page">
      <Link to="/schedule" className="back">
        ← Расписание
      </Link>
      <article className="card" data-demo-tour="confirmation">
        <p className="eyebrow">Подтверждение записи</p>
        <h1>{session.activityName}</h1>
        <div className="summary-row">
          <span>Дата</span>
          <span>{formatDateLabel(session.date)}</span>
        </div>
        <div className="summary-row">
          <span>Время</span>
          <span>{session.time}</span>
        </div>
        <div className="summary-row">
          <span>Тренер</span>
          <span>{session.trainerName}</span>
        </div>
        <div className="summary-row">
          <span>Длительность</span>
          <span>{formatDuration(session.durationMinutes)}</span>
        </div>
        <div className="summary-row">
          <span>Филиал</span>
          <span>{session.locationName}</span>
        </div>
        <div className="summary-row">
          <span>Абонемент</span>
          <span>{membership?.name ?? 'Нет активного'}</span>
        </div>
        <p className="notice">Посещение будет списано после фактического посещения тренировки.</p>
      </article>
      {error && <div className="state-block">{error}</div>}
      {membership?.status === 'ACTIVE' ? (
        <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => void confirm()}>
          {busy ? 'Записываем…' : 'Подтвердить запись'}
        </button>
      ) : (
        <Link to="/plans" className="btn btn-primary btn-block">
          Выбрать абонемент
        </Link>
      )}
    </div>
  );
}
