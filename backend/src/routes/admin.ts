import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { providers } from '../container.js';
import { errorBody, statusFromError } from '../errors.js';
import { adminReadMiddleware, adminWriteMiddleware } from '../middleware/adminAuth.js';
import { setBookingStatus } from '../services/booking.js';
import {
  adjustMembershipVisits,
  cancelMembership,
  extendMembership,
  freezeMembership,
  issueMembership,
  unfreezeMembership,
  calculateMembershipBalance,
} from '../services/membership.js';
import { getAdminDashboard, serializeBooking, serializeMembership, serializeSession } from '../services/portal.js';
import { listRetentionSignals, triggerRetentionAction } from '../services/retention.js';
import type { BookingStatus } from '../types.js';

export const adminRouter = Router();

adminRouter.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return adminReadMiddleware(req, res, next);
  }
  return adminWriteMiddleware(req, res, next);
});

adminRouter.get('/dashboard', (_req, res) => {
  res.json({ data: getAdminDashboard(providers) });
});

adminRouter.get('/customers', (_req, res) => {
  const customers = providers.customers.listAll().map((customer) => {
    const memberships = providers.memberships.listCustomerMemberships(customer.id);
    const active = memberships.find((item) => item.status === 'ACTIVE' || item.status === 'FROZEN');
    const bookings = providers.bookings.listByCustomer(customer.id);
    const lastVisit = bookings
      .filter((item) => item.status === 'ATTENDED')
      .sort((a, b) => b.session.starts_at.localeCompare(a.session.starts_at))[0];
    const plan = active ? providers.memberships.getPlan(active.membership_plan_id) : undefined;
    return {
      id: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone,
      email: customer.email,
      status: customer.status,
      membershipName: plan?.name ?? null,
      membershipStatus: active?.status ?? memberships[0]?.status ?? null,
      expiresAt: active?.expires_at ?? null,
      remainingVisits: active?.remaining_visits ?? null,
      lastVisitAt: lastVisit?.session.starts_at ?? null,
    };
  });
  res.json({ data: customers });
});

adminRouter.get('/customers/:id', (req, res) => {
  const customer = providers.customers.getById(Number(req.params.id));
  if (!customer) {
    res.status(404).json({ error: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
    return;
  }
  const memberships = providers.memberships
    .listCustomerMemberships(customer.id)
    .map((item) => serializeMembership(calculateMembershipBalance(providers, item.id)));
  const bookings = providers.bookings
    .listByCustomer(customer.id)
    .map((item) => serializeBooking(item, config.timezone));
  const lastVisit = bookings.find((item) => item.status === 'ATTENDED') ?? null;
  res.json({
    data: {
      id: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone,
      email: customer.email,
      status: customer.status,
      createdAt: customer.created_at,
      memberships,
      bookings,
      lastVisit,
      notes: providers.customers.listNotes(customer.id),
    },
  });
});

adminRouter.post('/customers/:id/notes', (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) {
      res.status(400).json({ error: 'text is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const note = providers.customers.addNote(Number(req.params.id), text);
    res.status(201).json({ data: note });
  } catch (error) {
    res.status(statusFromError(error)).json(errorBody(error));
  }
});

adminRouter.get('/membership-plans', (_req, res) => {
  res.json({
    data: providers.memberships.listPlans().map((plan) => ({
      id: plan.id,
      name: plan.name,
      membershipType: plan.membership_type,
      durationDays: plan.duration_days,
      visitLimit: plan.visit_limit,
      price: plan.price,
      description: plan.description,
      active: plan.active,
    })),
  });
});

adminRouter.post('/membership-plans', (req, res) => {
  try {
    const body = z
      .object({
        name: z.string().min(1),
        membershipType: z.enum(['VISIT_BASED', 'UNLIMITED']),
        durationDays: z.number().int().positive(),
        visitLimit: z.number().int().positive().nullable().optional(),
        price: z.number().int().nonnegative().nullable().optional(),
        description: z.string().optional(),
        active: z.boolean().optional(),
      })
      .parse(req.body);
    const plan = providers.memberships.createPlan({
      name: body.name,
      membership_type: body.membershipType,
      duration_days: body.durationDays,
      visit_limit: body.visitLimit ?? null,
      price: body.price ?? null,
      description: body.description ?? '',
      active: body.active ?? true,
    });
    res.status(201).json({ data: plan });
  } catch (error) {
    res.status(statusFromError(error, 400)).json(errorBody(error));
  }
});

adminRouter.patch('/membership-plans/:id', (req, res) => {
  try {
    const plan = providers.memberships.updatePlan(Number(req.params.id), {
      name: req.body?.name,
      membership_type: req.body?.membershipType,
      duration_days: req.body?.durationDays,
      visit_limit: req.body?.visitLimit,
      price: req.body?.price,
      description: req.body?.description,
      active: req.body?.active,
    });
    res.json({ data: plan });
  } catch (error) {
    res.status(statusFromError(error)).json(errorBody(error));
  }
});

adminRouter.get('/memberships', (req, res) => {
  const customerId = req.query.customerId ? Number(req.query.customerId) : undefined;
  const list = providers.memberships
    .listCustomerMemberships(Number.isFinite(customerId) ? customerId : undefined)
    .map((item) => serializeMembership(calculateMembershipBalance(providers, item.id)));
  res.json({ data: list });
});

adminRouter.post('/memberships', (req, res) => {
  try {
    const body = z
      .object({
        customerId: z.number().int().positive(),
        planId: z.number().int().positive(),
        startsAt: z.string().optional(),
      })
      .parse(req.body);
    const membership = issueMembership(providers, body);
    res.status(201).json({ data: serializeMembership(membership) });
  } catch (error) {
    res.status(statusFromError(error, 400)).json(errorBody(error));
  }
});

adminRouter.post('/memberships/:id/adjust', (req, res) => {
  try {
    const delta = Number(req.body?.delta);
    const reason = String(req.body?.reason || 'Admin adjustment');
    const membership = adjustMembershipVisits(providers, Number(req.params.id), delta, reason);
    res.json({ data: serializeMembership(membership) });
  } catch (error) {
    res.status(statusFromError(error)).json(errorBody(error));
  }
});

adminRouter.post('/memberships/:id/freeze', (req, res) => {
  try {
    const freezeUntil = String(req.body?.freezeUntil || '');
    const membership = freezeMembership(providers, Number(req.params.id), freezeUntil);
    res.json({ data: membership });
  } catch (error) {
    res.status(statusFromError(error)).json(errorBody(error));
  }
});

adminRouter.post('/memberships/:id/unfreeze', (req, res) => {
  try {
    const membership = unfreezeMembership(providers, Number(req.params.id));
    res.json({ data: membership });
  } catch (error) {
    res.status(statusFromError(error)).json(errorBody(error));
  }
});

adminRouter.post('/memberships/:id/cancel', (req, res) => {
  try {
    const membership = cancelMembership(providers, Number(req.params.id));
    res.json({ data: membership });
  } catch (error) {
    res.status(statusFromError(error)).json(errorBody(error));
  }
});

adminRouter.patch('/memberships/:id', (req, res) => {
  try {
    const expiresAt = req.body?.expiresAt as string | undefined;
    if (!expiresAt) {
      res.status(400).json({ error: 'expiresAt is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const membership = extendMembership(providers, Number(req.params.id), expiresAt);
    res.json({ data: membership });
  } catch (error) {
    res.status(statusFromError(error)).json(errorBody(error));
  }
});

adminRouter.get('/memberships/:id/ledger', (req, res) => {
  res.json({ data: providers.memberships.listLedger(Number(req.params.id)) });
});

adminRouter.get('/schedule', (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  res.json({
    data: providers.schedule.listSessions({ from, to }).map((item) => serializeSession(item, config.timezone)),
  });
});

adminRouter.post('/schedule', (req, res) => {
  try {
    const body = z
      .object({
        locationId: z.number().int().positive(),
        activityId: z.number().int().positive(),
        trainerId: z.number().int().positive(),
        startsAt: z.string(),
        endsAt: z.string(),
        capacity: z.number().int().positive(),
      })
      .parse(req.body);
    const session = providers.schedule.createSession({
      location_id: body.locationId,
      activity_id: body.activityId,
      trainer_id: body.trainerId,
      starts_at: body.startsAt,
      ends_at: body.endsAt,
      capacity: body.capacity,
      status: 'SCHEDULED',
    });
    res.status(201).json({ data: serializeSession(session, config.timezone) });
  } catch (error) {
    res.status(statusFromError(error, 400)).json(errorBody(error));
  }
});

adminRouter.patch('/schedule/:id', (req, res) => {
  try {
    const session = providers.schedule.updateSession(Number(req.params.id), {
      location_id: req.body?.locationId,
      activity_id: req.body?.activityId,
      trainer_id: req.body?.trainerId,
      starts_at: req.body?.startsAt,
      ends_at: req.body?.endsAt,
      capacity: req.body?.capacity,
      status: req.body?.status,
    });
    res.json({ data: serializeSession(session, config.timezone) });
  } catch (error) {
    res.status(statusFromError(error)).json(errorBody(error));
  }
});

adminRouter.get('/bookings', (req, res) => {
  const status = typeof req.query.status === 'string' ? (req.query.status as BookingStatus) : undefined;
  res.json({
    data: providers.bookings.list({ status }).map((item) => serializeBooking(item, config.timezone)),
  });
});

adminRouter.patch('/bookings/:id', (req, res) => {
  try {
    const status = req.body?.status as BookingStatus;
    const booking = setBookingStatus(providers, { bookingId: Number(req.params.id), status });
    res.json({ data: serializeBooking(booking, config.timezone) });
  } catch (error) {
    res.status(statusFromError(error)).json(errorBody(error));
  }
});

adminRouter.get('/trainers', (_req, res) => {
  res.json({ data: providers.trainers.list() });
});

adminRouter.post('/trainers', (req, res) => {
  try {
    const trainer = providers.trainers.create({
      location_id: Number(req.body.locationId),
      name: String(req.body.name),
      photo: String(req.body.photo || ''),
      specialization: String(req.body.specialization || ''),
      description: String(req.body.description || ''),
      active: req.body.active !== false,
    });
    res.status(201).json({ data: trainer });
  } catch (error) {
    res.status(statusFromError(error, 400)).json(errorBody(error));
  }
});

adminRouter.patch('/trainers/:id', (req, res) => {
  try {
    const trainer = providers.trainers.update(Number(req.params.id), {
      location_id: req.body?.locationId,
      name: req.body?.name,
      photo: req.body?.photo,
      specialization: req.body?.specialization,
      description: req.body?.description,
      active: req.body?.active,
    });
    res.json({ data: trainer });
  } catch (error) {
    res.status(statusFromError(error)).json(errorBody(error));
  }
});

adminRouter.get('/activities', (_req, res) => {
  res.json({ data: providers.activities.list() });
});

adminRouter.post('/activities', (req, res) => {
  try {
    const activity = providers.activities.create({
      name: String(req.body.name),
      description: String(req.body.description || ''),
      duration_minutes: Number(req.body.durationMinutes),
      capacity_default: Number(req.body.capacityDefault || 12),
      image: String(req.body.image || ''),
      active: req.body.active !== false,
    });
    res.status(201).json({ data: activity });
  } catch (error) {
    res.status(statusFromError(error, 400)).json(errorBody(error));
  }
});

adminRouter.patch('/activities/:id', (req, res) => {
  try {
    const activity = providers.activities.update(Number(req.params.id), {
      name: req.body?.name,
      description: req.body?.description,
      duration_minutes: req.body?.durationMinutes,
      capacity_default: req.body?.capacityDefault,
      image: req.body?.image,
      active: req.body?.active,
    });
    res.json({ data: activity });
  } catch (error) {
    res.status(statusFromError(error)).json(errorBody(error));
  }
});

adminRouter.get('/retention', (_req, res) => {
  res.json({ data: listRetentionSignals(providers) });
});

adminRouter.post('/retention/:customerId/:action', (req, res) => {
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

adminRouter.get('/events', (_req, res) => {
  res.json({ data: providers.events.list(40) });
});

adminRouter.get('/notifications', (_req, res) => {
  res.json({ data: providers.notifications.list() });
});
