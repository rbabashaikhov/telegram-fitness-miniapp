import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { TabBar } from '../components/TabBar';
import { dayChipLabel, formatDuration } from '../lib/format';
import type { Activity, Session, Trainer } from '../types';

export function SchedulePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [day, setDay] = useState(0);
  const [activityId, setActivityId] = useState<number | 'all'>('all');
  const [trainerId, setTrainerId] = useState<number | 'all'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getSchedule(), api.getActivities(), api.getTrainers()])
      .then(([schedule, acts, tr]) => {
        setSessions(schedule.data);
        setActivities(acts.data);
        setTrainers(tr.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить расписание'));
  }, []);

  const days = useMemo(() => {
    const unique = [...new Set(sessions.map((item) => item.date))].sort();
    return unique.slice(0, 14);
  }, [sessions]);

  const selectedDate = days[day] ?? days[0];
  const filtered = sessions.filter((item) => {
    if (selectedDate && item.date !== selectedDate) return false;
    if (activityId !== 'all' && item.activityId !== activityId) return false;
    if (trainerId !== 'all' && item.trainerId !== trainerId) return false;
    return true;
  });

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Pulse Arena</p>
        <h1>Расписание</h1>
      </header>

      {error && <div className="state-block">{error}</div>}

      <div className="day-strip" data-demo-tour="schedule-days">
        {days.map((date, index) => (
          <button
            key={date}
            type="button"
            className={index === day ? 'chip is-active' : 'chip'}
            onClick={() => setDay(index)}
          >
            {dayChipLabel(date, index)}
          </button>
        ))}
      </div>

      <div className="filters">
        <select value={activityId} onChange={(event) => setActivityId(event.target.value === 'all' ? 'all' : Number(event.target.value))}>
          <option value="all">Все направления</option>
          {activities.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select value={trainerId} onChange={(event) => setTrainerId(event.target.value === 'all' ? 'all' : Number(event.target.value))}>
          <option value="all">Все тренеры</option>
          {trainers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div className="stack" data-demo-tour="schedule-list">
        {filtered.length === 0 && <div className="state-block">На этот день свободных классов нет.</div>}
        {filtered.map((session) => (
          <article key={session.id} className="card class-card">
            <div className="class-time">{session.time}</div>
            <div>
              <h3>{session.activityName}</h3>
              <p className="muted">{session.trainerName}</p>
              <p className="muted">
                {formatDuration(session.durationMinutes)} · {session.spotsLeft} мест
              </p>
            </div>
            <Link
              to={`/schedule/${session.id}`}
              className="btn btn-primary"
              data-demo-tour={session.activityName === 'Functional Training' ? 'class-book' : undefined}
            >
              Записаться
            </Link>
          </article>
        ))}
      </div>
      <TabBar />
    </div>
  );
}
