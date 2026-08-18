import type {
  Activity,
  AdminCustomer,
  AdminDashboard,
  AppConfig,
  Booking,
  LedgerEntry,
  Membership,
  Portal,
  Progress,
  RetentionSignal,
  Session,
  Trainer,
} from '../types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

let initData = '';
let adminToken = '';

if (typeof sessionStorage !== 'undefined') {
  adminToken = sessionStorage.getItem('admin_token') || '';
}

export function setTelegramInitData(value: string): void {
  initData = value;
}

export function setAdminToken(value: string): void {
  adminToken = value;
  if (typeof sessionStorage !== 'undefined') {
    if (value) sessionStorage.setItem('admin_token', value);
    else sessionStorage.removeItem('admin_token');
  }
}

export function getAdminToken(): string {
  return adminToken;
}

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (initData) headers.set('x-telegram-init-data', initData);
  if (adminToken && path.startsWith('/api/admin')) headers.set('x-admin-token', adminToken);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.error || `Request failed (${response.status})`, response.status);
  }
  return payload as T;
}

export const api = {
  getConfig: () => request<{ data: AppConfig }>('/api/config'),
  getPortal: () => request<{ data: Portal | null }>('/api/me/portal'),
  getMemberships: () => request<{ data: Membership[] }>('/api/me/membership'),
  getMyBookings: () => request<{ data: Booking[] }>('/api/me/bookings'),
  getProgress: () => request<{ data: Progress }>('/api/me/progress'),
  getActivities: () => request<{ data: Activity[] }>('/api/activities'),
  getTrainers: () => request<{ data: Trainer[] }>('/api/trainers'),
  getSchedule: (query?: { from?: string; to?: string; activityId?: number; trainerId?: number }) => {
    const params = new URLSearchParams();
    if (query?.from) params.set('from', query.from);
    if (query?.to) params.set('to', query.to);
    if (query?.activityId) params.set('activityId', String(query.activityId));
    if (query?.trainerId) params.set('trainerId', String(query.trainerId));
    const suffix = params.toString() ? `?${params}` : '';
    return request<{ data: Session[] }>(`/api/schedule${suffix}`);
  },
  getSession: (id: number) => request<{ data: Session }>(`/api/schedule/${id}`),
  createBooking: (classSessionId: number, customerMembershipId?: number) =>
    request<{ data: Booking }>('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({ classSessionId, customerMembershipId }),
    }),
  cancelBooking: (id: number) =>
    request<{ data: Booking }>(`/api/bookings/${id}/cancel`, { method: 'PATCH' }),
  getAdminDashboard: () => request<{ data: AdminDashboard }>('/api/admin/dashboard'),
  getAdminCustomers: () => request<{ data: AdminCustomer[] }>('/api/admin/customers'),
  getAdminCustomer: (id: number) => request<{ data: Record<string, unknown> }>(`/api/admin/customers/${id}`),
  getAdminBookings: (status?: string) =>
    request<{ data: Booking[] }>(status ? `/api/admin/bookings?status=${status}` : '/api/admin/bookings'),
  updateAdminBooking: (id: number, status: string) =>
    request<{ data: Booking }>(`/api/admin/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getAdminRetention: () => request<{ data: RetentionSignal[] }>('/api/admin/retention'),
  triggerRetention: (customerId: number, action: 'renewal' | 'reminder') =>
    request<{ data: unknown }>(`/api/admin/retention/${customerId}/${action}`, { method: 'POST' }),
  getAdminLedger: (id: number) => request<{ data: LedgerEntry[] }>(`/api/admin/memberships/${id}/ledger`),
  getAdminPlans: () => request<{ data: unknown[] }>('/api/admin/membership-plans'),
  getAdminMemberships: () => request<{ data: Membership[] }>('/api/admin/memberships'),
  issueMembership: (customerId: number, planId: number) =>
    request<{ data: Membership }>('/api/admin/memberships', {
      method: 'POST',
      body: JSON.stringify({ customerId, planId }),
    }),
  adjustMembership: (id: number, delta: number, reason: string) =>
    request<{ data: Membership }>(`/api/admin/memberships/${id}/adjust`, {
      method: 'POST',
      body: JSON.stringify({ delta, reason }),
    }),
  freezeMembership: (id: number, freezeUntil: string) =>
    request<{ data: unknown }>(`/api/admin/memberships/${id}/freeze`, {
      method: 'POST',
      body: JSON.stringify({ freezeUntil }),
    }),
  unfreezeMembership: (id: number) =>
    request<{ data: unknown }>(`/api/admin/memberships/${id}/unfreeze`, { method: 'POST' }),
  cancelMembership: (id: number) =>
    request<{ data: unknown }>(`/api/admin/memberships/${id}/cancel`, { method: 'POST' }),
  getAdminTrainers: () => request<{ data: Trainer[] }>('/api/admin/trainers'),
  getAdminActivities: () => request<{ data: Activity[] }>('/api/admin/activities'),
  getAdminSchedule: () => request<{ data: Session[] }>('/api/admin/schedule'),
  getDemoDashboard: () => request<{ data: AdminDashboard }>('/api/demo-admin/dashboard'),
  getDemoCustomers: () => request<{ data: AdminCustomer[] }>('/api/demo-admin/customers'),
  getDemoCustomer: (id: number) => request<{ data: Record<string, unknown> }>(`/api/demo-admin/customers/${id}`),
  getDemoBookings: (status?: string) =>
    request<{ data: Booking[] }>(
      status ? `/api/demo-admin/bookings?status=${status}` : '/api/demo-admin/bookings',
    ),
  updateDemoBooking: (id: number, status: string) =>
    request<{ data: Booking }>(`/api/demo-admin/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  getDemoRetention: () => request<{ data: RetentionSignal[] }>('/api/demo-admin/retention'),
  getDemoLedger: (id: number) => request<{ data: LedgerEntry[] }>(`/api/demo-admin/memberships/${id}/ledger`),
};
