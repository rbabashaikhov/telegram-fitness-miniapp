import { formatDateLabel } from './format';
import type { Membership } from '../types';

export type MembershipUrgency = 'missing' | 'expired' | 'exhausted' | 'low-balance' | 'expiring' | 'ok';

export interface MembershipCta {
  label: string;
  to: string;
}

export interface MembershipHomeState {
  eyebrow: string;
  remainingLine: string | null;
  expiresLine: string | null;
  primary: MembershipCta;
  secondary: MembershipCta | null;
  urgency: MembershipUrgency;
}

const PLANS = '/plans';

export function daysUntil(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function membershipHomeState(
  membership: Pick<
    Membership,
    'status' | 'membershipType' | 'remainingVisits' | 'totalVisits' | 'expiresAt' | 'planId'
  > | null,
  options: { today: string; expiringDays: number; lowVisits: number },
): MembershipHomeState {
  if (!membership) {
    return {
      eyebrow: 'Абонемент',
      remainingLine: null,
      expiresLine: null,
      primary: { label: 'Выбрать абонемент', to: PLANS },
      secondary: null,
      urgency: 'missing',
    };
  }

  const renew: MembershipCta = { label: 'Продлить', to: `${PLANS}/${membership.planId}` };
  const pickNew: MembershipCta = { label: 'Выбрать новый тариф', to: PLANS };
  const daysLeft = daysUntil(options.today, membership.expiresAt);
  const expired = membership.status === 'EXPIRED' || daysLeft < 0;
  const remaining = membership.remainingVisits;
  const exhausted =
    membership.status === 'EXHAUSTED' ||
    (membership.membershipType === 'VISIT_BASED' && remaining !== null && remaining <= 0);
  const lowBalance =
    membership.membershipType === 'VISIT_BASED' &&
    remaining !== null &&
    remaining > 0 &&
    remaining <= options.lowVisits;
  const expiring = !expired && daysLeft <= options.expiringDays;

  const remainingLine =
    membership.membershipType === 'VISIT_BASED' && remaining !== null && membership.totalVisits !== null
      ? `Осталось ${remaining} из ${membership.totalVisits}`
      : membership.membershipType === 'UNLIMITED'
        ? 'Безлимит'
        : null;
  const expiresLine = `До ${formatDateLabel(membership.expiresAt)}`;

  let urgency: MembershipUrgency = 'ok';
  if (expired) urgency = 'expired';
  else if (exhausted) urgency = 'exhausted';
  else if (lowBalance) urgency = 'low-balance';
  else if (expiring) urgency = 'expiring';

  return {
    eyebrow: 'Ваш абонемент',
    remainingLine,
    expiresLine,
    primary: renew,
    secondary: pickNew,
    urgency,
  };
}
