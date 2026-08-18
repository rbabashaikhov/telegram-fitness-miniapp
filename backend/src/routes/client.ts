import { Router } from 'express';
import { config, publicAppConfig } from '../config.js';
import { providers } from '../container.js';
import { AppError, errorBody, statusFromError } from '../errors.js';
import { authMiddleware } from '../middleware/auth.js';
import { bookingRateLimit } from '../middleware/rateLimit.js';
import { cancelBooking, createBooking } from '../services/booking.js';
import { calculateMembershipBalance } from '../services/membership.js';
import { buildCustomerPortal, serializeBooking, serializeMembership, serializeSession } from '../services/portal.js';
import { getCustomerProgress } from '../services/progress.js';

export const publicRouter = Router();
export const meRouter = Router();
export const bookingsRouter = Router();

publicRouter.get('/config', (_req, res) => {
  res.json({ data: publicAppConfig() });
});

publicRouter.get('/activities', (_req, res) => {
  res.json({
    data: providers.activities.list(true).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      durationMinutes: item.duration_minutes,
      capacityDefault: item.capacity_default,
      image: item.image,
    })),
  });
});

publicRouter.get('/trainers', (_req, res) => {
  const timezone = config.timezone;
  const nowIso = new Date().toISOString();
  const upcoming = providers.schedule.listSessions({ from: nowIso, status: 'SCHEDULED' });
  res.json({
    data: providers.trainers.list(true).map((trainer) => {
      const next = upcoming.find((session) => session.trainer_id === trainer.id);
      return {
        id: trainer.id,
        name: trainer.name,
        photo: trainer.photo,
        specialization: trainer.specialization,
        description: trainer.description,
        nextSession: next ? serializeSession(next, timezone) : null,
      };
    }),
  });
});

publicRouter.get('/schedule', (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : new Date().toISOString();
  const to =
    typeof req.query.to === 'string'
      ? req.query.to
      : new Date(Date.now() + 14 * 86_400_000).toISOString();
  const activityId = req.query.activityId ? Number(req.query.activityId) : undefined;
  const trainerId = req.query.trainerId ? Number(req.query.trainerId) : undefined;
  const sessions = providers.schedule.listSessions({
    from,
    to,
    activityId: Number.isFinite(activityId) ? activityId : undefined,
    trainerId: Number.isFinite(trainerId) ? trainerId : undefined,
    status: 'SCHEDULED',
  });
  res.json({
    data: sessions.map((session) => serializeSession(session, config.timezone)),
  });
});

publicRouter.get('/schedule/:id', (req, res) => {
  const session = providers.schedule.getSession(Number(req.params.id));
  if (!session) {
    res.status(404).json({ error: 'Class not found', code: 'SESSION_NOT_FOUND' });
    return;
  }
  res.json({ data: serializeSession(session, config.timezone) });
});

meRouter.use(authMiddleware);

meRouter.get('/', (req, res) => {
  const user = req.auth!.telegramUser;
  const { customer } = providers.customers.upsert(user);
  res.json({
    data: {
      id: customer.id,
      firstName: customer.first_name,
      lastName: customer.last_name,
      phone: customer.phone,
      email: customer.email,
      isDemo: req.auth!.isDemo,
    },
  });
});

meRouter.get('/portal', (req, res) => {
  const user = req.auth!.telegramUser;
  providers.customers.upsert(user);
  const portal = buildCustomerPortal(providers, user.id, config.timezone);
  res.json({ data: portal });
});

meRouter.get('/membership', (req, res) => {
  const user = req.auth!.telegramUser;
  const { customer } = providers.customers.upsert(user);
  const memberships = providers.memberships
    .listCustomerMemberships(customer.id)
    .map((item) => serializeMembership(calculateMembershipBalance(providers, item.id)));
  res.json({ data: memberships });
});

meRouter.get('/bookings', (req, res) => {
  const user = req.auth!.telegramUser;
  const { customer } = providers.customers.upsert(user);
  res.json({
    data: providers.bookings.listByCustomer(customer.id).map((item) => serializeBooking(item, config.timezone)),
  });
});

meRouter.get('/progress', (req, res) => {
  const user = req.auth!.telegramUser;
  const { customer } = providers.customers.upsert(user);
  res.json({ data: getCustomerProgress(providers, customer.id) });
});

bookingsRouter.use(authMiddleware);

bookingsRouter.post('/', bookingRateLimit, (req, res) => {
  try {
    const classSessionId = Number(req.body?.classSessionId);
    const customerMembershipId =
      req.body?.customerMembershipId !== undefined && req.body?.customerMembershipId !== null
        ? Number(req.body.customerMembershipId)
        : undefined;
    if (!Number.isFinite(classSessionId)) {
      throw new AppError('classSessionId is required', 400, 'VALIDATION_ERROR');
    }
    const booking = createBooking(providers, {
      user: req.auth!.telegramUser,
      classSessionId,
      customerMembershipId,
    });
    res.status(201).json({ data: serializeBooking(booking, config.timezone) });
  } catch (error) {
    res.status(statusFromError(error)).json(errorBody(error));
  }
});

bookingsRouter.patch('/:id/cancel', (req, res) => {
  try {
    const user = req.auth!.telegramUser;
    const { customer } = providers.customers.upsert(user);
    const booking = cancelBooking(providers, {
      bookingId: Number(req.params.id),
      customerId: customer.id,
    });
    res.json({ data: serializeBooking(booking, config.timezone) });
  } catch (error) {
    res.status(statusFromError(error)).json(errorBody(error));
  }
});
