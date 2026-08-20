import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { TabBar } from '../components/TabBar';
import { useApp } from '../context/AppContext';
import { useBusiness } from '../context/BusinessContext';
import { greeting, visitWord, formatDateLabel } from '../lib/format';
import { membershipHomeState } from '../lib/membershipCta';
import type { Portal } from '../types';

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function HomePage() {
  const { user } = useApp();
  const business = useBusiness();
  const [portal, setPortal] = useState<Portal | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getPortal()
      .then((res) => {
        if (!cancelled) setPortal(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить кабинет');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const membershipState = useMemo(
    () =>
      membershipHomeState(portal?.membership ?? null, {
        today: todayDateString(),
        expiringDays: business.retention.expiringDays,
        lowVisits: business.retention.lowVisits,
      }),
    [business.retention.expiringDays, business.retention.lowVisits, portal?.membership],
  );

  if (error) {
    return (
      <div className="page">
        <div className="state-block">
          <strong>Ошибка</strong>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="page">
        <div className="loading">Загрузка кабинета…</div>
      </div>
    );
  }

  const name = portal.customer.firstName || user.firstName || 'Гость';
  const membership = portal.membership;
  const next = portal.nextWorkout;
  const progress = portal.progress;

  return (
    <div className="page">
      <header className="hero-block">
        <p className="eyebrow">Pulse Fitness Club</p>
        <h1 className="brand">{greeting(name)}</h1>
      </header>

      {membership ? (
        <article className="card membership-hero" data-demo-tour="client-membership">
          <p className="eyebrow">{membershipState.eyebrow}</p>
          <h2>{membership.name}</h2>
          {membershipState.remainingLine && <p className="hero-metric">{membershipState.remainingLine}</p>}
          {membershipState.expiresLine && <p className="muted">{membershipState.expiresLine}</p>}
          <div className="row-actions">
            <Link to={membershipState.primary.to} className="btn btn-primary">
              {membershipState.primary.label}
            </Link>
            {membershipState.secondary && (
              <Link to={membershipState.secondary.to} className="btn btn-secondary">
                {membershipState.secondary.label}
              </Link>
            )}
          </div>
        </article>
      ) : (
        <article className="card" data-demo-tour="client-membership">
          <h2>Нет активного абонемента</h2>
          <p className="muted">Выберите тариф, чтобы записываться на тренировки.</p>
          <div className="row-actions">
            <Link to={membershipState.primary.to} className="btn btn-primary btn-block">
              {membershipState.primary.label}
            </Link>
          </div>
        </article>
      )}

      {next ? (
        <article className="card next-workout" data-demo-tour="next-workout">
          <p className="eyebrow">Следующая тренировка</p>
          <h3>
            {next.session.date === new Date().toISOString().slice(0, 10) ? 'Сегодня' : formatDateLabel(next.session.date)}
            {' · '}
            {next.session.time}
          </h3>
          <p className="workout-name">{next.session.activityName}</p>
          <p className="muted">{next.session.trainerName}</p>
        </article>
      ) : (
        <article className="card">
          <p className="eyebrow">Следующая тренировка</p>
          <p className="muted">Пока нет записи. Выберите класс в расписании.</p>
        </article>
      )}

      <Link to="/schedule" className="btn btn-primary btn-block" data-demo-tour="book-cta">
        Записаться на тренировку
      </Link>

      <article className="card" data-demo-tour="month-progress">
        <p className="eyebrow">В {progress.monthLabel.toLowerCase()}</p>
        <p className="hero-metric">
          {progress.thisMonth} {visitWord(progress.thisMonth)}
        </p>
        <p className="muted">
          {progress.delta === 0
            ? 'Как в прошлом месяце'
            : `${progress.delta > 0 ? '+' : ''}${progress.delta} к предыдущему месяцу`}
        </p>
        <p className="streak">
          Серия · {progress.streakWeeks} {progress.streakWeeks === 1 ? 'неделя' : 'недели подряд'}
        </p>
      </article>
      <TabBar />
    </div>
  );
}
