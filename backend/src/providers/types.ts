import type {
  Activity,
  Booking,
  BookingDetails,
  BookingStatus,
  BusinessEvent,
  ClassSession,
  ClassSessionDetails,
  ClassSessionStatus,
  ClientNote,
  Club,
  Customer,
  CustomerMembership,
  LedgerOperation,
  Location,
  MembershipLedgerEntry,
  MembershipPlan,
  MembershipStatus,
  NotificationKind,
  NotificationRecord,
  OutboundEventName,
  TelegramUser,
  Trainer,
} from '../types.js';

export interface ClubProvider {
  getClub(): Club;
  listLocations(activeOnly?: boolean): Location[];
  getLocation(id: number): Location | undefined;
}

export interface CustomerProvider {
  upsert(user: TelegramUser, extras?: Partial<Pick<Customer, 'phone' | 'email'>>): {
    customer: Customer;
    created: boolean;
  };
  getByTelegramUserId(telegramUserId: number): Customer | undefined;
  getById(id: number): Customer | undefined;
  listAll(): Customer[];
  update(
    id: number,
    patch: Partial<Pick<Customer, 'first_name' | 'last_name' | 'phone' | 'email' | 'status'>>,
  ): Customer;
  listNotes(customerId: number): ClientNote[];
  addNote(customerId: number, text: string): ClientNote;
}

export interface TrainerProvider {
  list(activeOnly?: boolean): Trainer[];
  getById(id: number): Trainer | undefined;
  create(params: Omit<Trainer, 'id'>): Trainer;
  update(id: number, patch: Partial<Omit<Trainer, 'id'>>): Trainer;
}

export interface ActivityProvider {
  list(activeOnly?: boolean): Activity[];
  getById(id: number): Activity | undefined;
  create(params: Omit<Activity, 'id'>): Activity;
  update(id: number, patch: Partial<Omit<Activity, 'id'>>): Activity;
}

export interface MembershipProvider {
  listPlans(activeOnly?: boolean): MembershipPlan[];
  getPlan(id: number): MembershipPlan | undefined;
  createPlan(params: Omit<MembershipPlan, 'id'>): MembershipPlan;
  updatePlan(id: number, patch: Partial<Omit<MembershipPlan, 'id'>>): MembershipPlan;
  listCustomerMemberships(customerId?: number): CustomerMembership[];
  getCustomerMembership(id: number): CustomerMembership | undefined;
  createCustomerMembership(params: Omit<CustomerMembership, 'id' | 'created_at'>): CustomerMembership;
  updateCustomerMembership(
    id: number,
    patch: Partial<
      Pick<
        CustomerMembership,
        | 'starts_at'
        | 'expires_at'
        | 'remaining_visits'
        | 'status'
        | 'freeze_from'
        | 'freeze_until'
      >
    >,
  ): CustomerMembership;
  listLedger(membershipId: number): MembershipLedgerEntry[];
  findRedeemForBooking(bookingId: number): MembershipLedgerEntry | undefined;
  insertLedger(params: {
    customerMembershipId: number;
    bookingId?: number | null;
    operation: LedgerOperation;
    delta: number;
    reason?: string;
  }): MembershipLedgerEntry;
}

export interface ScheduleProvider {
  listSessions(filters?: {
    from?: string;
    to?: string;
    activityId?: number;
    trainerId?: number;
    locationId?: number;
    status?: ClassSessionStatus;
  }): ClassSessionDetails[];
  getSession(id: number): ClassSessionDetails | undefined;
  createSession(params: Omit<ClassSession, 'id'>): ClassSessionDetails;
  updateSession(
    id: number,
    patch: Partial<Omit<ClassSession, 'id'>>,
  ): ClassSessionDetails;
  countActiveBookings(sessionId: number): number;
}

export interface BookingProvider {
  getById(id: number): BookingDetails | undefined;
  listByCustomer(customerId: number): BookingDetails[];
  list(filters?: {
    status?: BookingStatus;
    customerId?: number;
    sessionId?: number;
    from?: string;
    to?: string;
  }): BookingDetails[];
  findActiveForSession(customerId: number, sessionId: number): Booking | undefined;
  insert(params: {
    customerId: number;
    classSessionId: number;
    customerMembershipId: number | null;
  }): BookingDetails;
  updateStatus(
    id: number,
    status: BookingStatus,
    extra?: { cancelledAt?: string | null; attendedAt?: string | null },
  ): BookingDetails;
}

export interface EventProvider {
  publish(name: OutboundEventName, payload: Record<string, unknown>): BusinessEvent;
  list(limit?: number): BusinessEvent[];
}

export interface NotificationProvider {
  enqueue(params: {
    customerId: number;
    kind: NotificationKind;
    title: string;
    body: string;
  }): NotificationRecord;
  list(customerId?: number): NotificationRecord[];
}

export interface PaymentProvider {
  createIntent(params: { customerId: number; planId: number; amount: number }): {
    id: string;
    status: 'mock';
  };
}

export interface Providers {
  club: ClubProvider;
  customers: CustomerProvider;
  trainers: TrainerProvider;
  activities: ActivityProvider;
  memberships: MembershipProvider;
  schedule: ScheduleProvider;
  bookings: BookingProvider;
  events: EventProvider;
  notifications: NotificationProvider;
  payments: PaymentProvider;
  transaction<T>(fn: () => T): T;
}
