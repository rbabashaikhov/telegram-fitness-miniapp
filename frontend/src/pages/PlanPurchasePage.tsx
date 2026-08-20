import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { TabBar } from '../components/TabBar';
import { formatPlanTerm, formatPrice } from '../lib/format';
import type { MembershipPlan } from '../types';

export function PlanPurchasePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<MembershipPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const planId = Number(id);
    if (!planId) return;
    api
      .getMembershipPlans()
      .then((res) => {
        const found = res.data.find((item) => item.id === planId) ?? null;
        setPlan(found);
        if (!found) setError('Тариф не найден');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить тариф'));
  }, [id]);

  async function pay() {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      await api.purchaseMembership(plan.id);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Оплата не прошла');
    } finally {
      setBusy(false);
    }
  }

  if (!plan) {
    return (
      <div className="page">
        {error ? <div className="state-block">{error}</div> : <div className="loading">Загрузка тарифа…</div>}
        <Link to="/plans" className="back">
          ← К тарифам
        </Link>
        <TabBar />
      </div>
    );
  }

  return (
    <div className="page">
      <Link to="/plans" className="back">
        ← К тарифам
      </Link>
      <article className="card">
        <p className="eyebrow">Подтверждение оплаты</p>
        <h1>{plan.name}</h1>
        <div className="summary-row">
          <span>Срок</span>
          <span>{formatPlanTerm(plan)}</span>
        </div>
        <div className="summary-row">
          <span>Стоимость</span>
          <span>{formatPrice(plan.price)}</span>
        </div>
        <p className="muted">{plan.description}</p>
        <p className="notice">Демо-оплата: деньги не списываются, абонемент появится сразу.</p>
      </article>
      {error && <div className="state-block">{error}</div>}
      <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => void pay()}>
        {busy ? 'Оплачиваем…' : 'Подтвердить оплату'}
      </button>
      <TabBar />
    </div>
  );
}
