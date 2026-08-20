import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { TabBar } from '../components/TabBar';
import { formatPlanTerm, formatPrice } from '../lib/format';
import type { MembershipPlan } from '../types';

export function PlansPage() {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMembershipPlans()
      .then((res) => setPlans(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить тарифы'));
  }, []);

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Pulse Fitness Club</p>
        <h1>Абонементы</h1>
        <p className="lead">Выберите тариф. В демо оплата проходит сразу, без эквайринга.</p>
      </header>

      {error && <div className="state-block">{error}</div>}

      <div className="stack">
        {plans.map((plan) => (
          <article key={plan.id} className="card">
            <p className="eyebrow">{formatPlanTerm(plan)}</p>
            <h2>{plan.name}</h2>
            <p className="hero-metric">{formatPrice(plan.price)}</p>
            <p className="muted">{plan.description}</p>
            <div className="row-actions">
              <Link to={`/plans/${plan.id}`} className="btn btn-primary btn-block">
                Купить
              </Link>
            </div>
          </article>
        ))}
      </div>
      <TabBar />
    </div>
  );
}
