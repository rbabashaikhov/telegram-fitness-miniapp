import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { TabBar } from '../components/TabBar';
import { formatDateLabel, formatDuration, formatMembershipStatus } from '../lib/format';
import type { Activity, Membership, Trainer } from '../types';

export function ClubPage() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    void Promise.all([api.getMemberships(), api.getTrainers(), api.getActivities()]).then(([m, t, a]) => {
      setMemberships(m.data);
      setTrainers(t.data);
      setActivities(a.data);
    });
  }, []);

  const current = memberships.find((item) => item.status === 'ACTIVE') ?? memberships[0];

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Pulse Fitness Club</p>
        <h1>Клуб</h1>
      </header>

      {current && (
        <article className="card" data-demo-tour="membership-progress">
          <p className="eyebrow">{formatMembershipStatus(current.status)}</p>
          <h2>{current.name}</h2>
          <p className="muted">
            {formatDateLabel(current.startsAt)} — {formatDateLabel(current.expiresAt)}
          </p>
          {current.membershipType === 'VISIT_BASED' && current.totalVisits && (
            <>
              <div className="package-progress">
                <span style={{ width: `${Math.min(100, Math.round((current.usedVisits / current.totalVisits) * 100))}%` }} />
              </div>
              <div className="stat-row">
                <div>
                  <strong>
                    {current.usedVisits} / {current.totalVisits}
                  </strong>
                  <span>использовано</span>
                </div>
                <div>
                  <strong>{current.remainingVisits}</strong>
                  <span>осталось</span>
                </div>
                <div>
                  <strong>{formatDateLabel(current.expiresAt)}</strong>
                  <span>действует до</span>
                </div>
              </div>
            </>
          )}
        </article>
      )}

      <h2>Тренеры</h2>
      <div className="stack">
        {trainers.map((trainer) => (
          <article key={trainer.id} className="card trainer-card">
            <img src={trainer.photo} alt="" />
            <div>
              <h3>{trainer.name}</h3>
              <p className="eyebrow">{trainer.specialization}</p>
              <p className="muted">{trainer.description}</p>
              {trainer.nextSession && (
                <p className="muted">
                  Ближайшее: {trainer.nextSession.date} · {trainer.nextSession.time} · {trainer.nextSession.activityName}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>

      <h2>Направления</h2>
      <div className="stack">
        {activities.map((activity) => (
          <article key={activity.id} className="card activity-card">
            <img src={activity.image} alt="" />
            <div>
              <h3>{activity.name}</h3>
              <p className="muted">{activity.description}</p>
              <p className="muted">{formatDuration(activity.durationMinutes)}</p>
            </div>
          </article>
        ))}
      </div>
      <Link to="/schedule" className="btn btn-secondary btn-block">
        Открыть расписание
      </Link>
      <TabBar />
    </div>
  );
}
