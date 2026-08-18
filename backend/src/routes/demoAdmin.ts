import { Router } from 'express';
import { config } from '../config.js';
import { providers } from '../container.js';
import { errorBody, statusFromError } from '../errors.js';
import { demoAdminPreviewMiddleware } from '../middleware/adminAuth.js';
import { setBookingStatus } from '../services/booking.js';
import { calculateMembershipBalance } from '../services/membership.js';
import { getAdminDashboard, serializeBooking, serializeMembership } from '../services/portal.js';
import { listRetentionSignals, triggerRetentionAction } from '../services/retention.js';
import type { BookingStatus } from '../types.js';

export const demoAdminRouter = Router();

demoAdminRouter.use(demoAdminPreviewMiddleware);

demoAdminRouter.get('/dashboard', (_req, res) => {
  res.json({ data: getAdminDashboard(providers) });
});

demoAdminRouter.get('/customers', (_req, res) => {
  const customers = providers.customers.listAll().map((customer) => {
    const memberships = providers.memberships.listCustomerMemberships(customer.id);
    const active = memberships.find((item) => item.status === 'ACTIVE' || item.status === 'FROZEN');
    const plan = active ? providers.memberships.getPlan(active.membership_plan_id) : undefined;
    const lastVisit = providers.bookings
      .listByCustomer(customer.id)
      .filter((item) => item.status === 'ATTENDED')
      .sort((a, b) => b.session.starts_at.localeCompare(a.session.starts_at))[0];
    return {
      id: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone,
      membershipName: plan?.name ?? null,
      membershipStatus: active?.status ?? null,
      expiresAt: active?.expires_at ?? null,
      remainingVisits: active?.remaining_visits ?? null,
      lastVisitAt: lastVisit?.session.starts_at ?? null,
    };
  });
  res.json({ data: customers });
});

demoAdminRouter.get('/customers/:id', (req, res) => {
  const customer = providers.customers.getById(Number(req.params.id));
  if (!customer) {
    res.status(404).json({ error: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    return;
  }
  res.json({
    data: {
      ...customer,
      memberships: providers.memberships
        .listCustomerMemberships(customer.id)
        .map((item) => serializeMembership(calculateMembershipBalance(providers, item.id))),
      bookings: providers.bookings.listByCustomer(customer.id).map((item) => serializeBooking(item, config.timezone)),
      notes: providers.customers.listNotes(customer.id),
    },
  });
});

demoAdminRouter.get('/bookings', (req, res) => {
  const status = typeof req.query.status === 'string' ? (req.query.status as BookingStatus) : undefined;
  res.json({
    data: providers.bookings.list({ status }).map((item) => serializeBooking(item, config.timezone)),
  });
});

demoAdminRouter.get('/retention', (_req, res) => {
  res.json({ data: listRetentionSignals(providers) });
});

demoAdminRouter.post('/retention/:customerId/:action', (req, res) => {
  try {
    const action = req.params.action === 'renewal' ? 'renewal_offer' : 'reminder';
    const notification = triggerRetentionAction(providers, {
      customerId: Number(req.params.customerId),
      action,
    });
    res.status(201).json({ data: notification });
  } catch (error) {
    res.status(statusFromError(error)).json(errorBody(error));
  }
});

demoAdminRouter.get('/memberships/:id/ledger', (req, res) => {
  res.json({ data: providers.memberships.listLedger(Number(req.params.id)) });
});

demoAdminRouter.patch('/bookings/:id', (req, res) => {
  try {
    const status = req.body?.status as BookingStatus;
    if (status !== 'ATTENDED' && status !== 'NO_SHOW') {
      res.status(403).json({ error: 'Demo admin can only mark attendance', code: 'DEMO_WRITE_LIMITED' });
      return;
    }
    const booking = setBookingStatus(providers, { bookingId: Number(req.params.id), status });
    res.json({ data: serializeBooking(booking, config.timezone) });
  } catch (error) {
    res.status(statusFromError(error)).json(errorBody(error));
  }
});
