export type MembershipType = 'VISIT_BASED' | 'UNLIMITED';

export type MembershipStatus = 'ACTIVE' | 'FROZEN' | 'EXPIRED' | 'EXHAUSTED' | 'CANCELLED';

export type ClassSessionStatus = 'SCHEDULED' | 'CANCELLED' | 'COMPLETED';

export type BookingStatus = 'BOOKED' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW';

export type LedgerOperation = 'PURCHASE' | 'REDEEM' | 'RESTORE' | 'ADJUSTMENT' | 'EXPIRATION';

export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type OutboundEventName =
  | 'customer.created'
  | 'membership.issued'
  | 'membership.expiring'
  | 'membership.frozen'
  | 'membership.cancelled'
  | 'membership.adjusted'
  | 'booking.created'
  | 'booking.cancelled'
  | 'booking.attended'
  | 'booking.no_show'
  | 'booking.status_changed'
  | 'customer.inactive'
  | 'retention.triggered';

export type NotificationKind = 'renewal_offer' | 'reminder' | 'retention';

export interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface AuthContext {
  telegramUser: TelegramUser;
  isDemo: boolean;
}

export interface Club {
  id: number;
  name: string;
  description: string;
  phone: string;
  email: string;
  address: string;
  timezone: string;
}

export interface Location {
  id: number;
  club_id: number;
  name: string;
  address: string;
  timezone: string;
  active: boolean;
}

export interface Customer {
  id: number;
  telegram_user_id: number | null;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  birth_date: string | null;
  username: string | null;
  status: CustomerStatus;
  created_at: string;
  updated_at: string;
}

export interface Trainer {
  id: number;
  location_id: number;
  name: string;
  photo: string;
  specialization: string;
  description: string;
  active: boolean;
}

export interface Activity {
  id: number;
  name: string;
  description: string;
  duration_minutes: number;
  capacity_default: number;
  image: string;
  active: boolean;
}

export interface MembershipPlan {
  id: number;
  name: string;
  membership_type: MembershipType;
  duration_days: number;
  visit_limit: number | null;
  price: number | null;
  description: string;
  active: boolean;
}

export interface CustomerMembership {
  id: number;
  customer_id: number;
  membership_plan_id: number;
  starts_at: string;
  expires_at: string;
  total_visits: number | null;
  remaining_visits: number | null;
  status: MembershipStatus;
  freeze_from: string | null;
  freeze_until: string | null;
  created_at: string;
}

export interface ClassSession {
  id: number;
  location_id: number;
  activity_id: number;
  trainer_id: number;
  starts_at: string;
  ends_at: string;
  capacity: number;
  status: ClassSessionStatus;
}

export interface Booking {
  id: number;
  customer_id: number;
  class_session_id: number;
  customer_membership_id: number | null;
  status: BookingStatus;
  booked_at: string;
  cancelled_at: string | null;
  attended_at: string | null;
}

export interface MembershipLedgerEntry {
  id: number;
  customer_membership_id: number;
  booking_id: number | null;
  operation: LedgerOperation;
  delta: number;
  reason: string;
  created_at: string;
}

export interface ClientNote {
  id: number;
  customer_id: number;
  text: string;
  created_at: string;
}

export interface BusinessEvent {
  id: number;
  name: OutboundEventName;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface NotificationRecord {
  id: number;
  customer_id: number;
  kind: NotificationKind;
  title: string;
  body: string;
  channel: string;
  status: 'queued' | 'sent' | 'mock';
  created_at: string;
}

export interface ClassSessionDetails extends ClassSession {
  activity_name: string;
  activity_image: string;
  duration_minutes: number;
  trainer_name: string;
  trainer_photo: string;
  trainer_specialization: string;
  location_name: string;
  location_address: string;
  booked_count: number;
  spots_left: number;
}

export interface BookingDetails extends Booking {
  session: ClassSessionDetails;
  membership_name: string | null;
  customer_first_name: string;
  customer_last_name: string;
}

export interface MembershipBalance {
  membership: CustomerMembership;
  plan: MembershipPlan;
  redeemed: number;
  remaining: number | null;
  reserved: number;
  bookable: number | null;
  used: number;
}

export interface ProgressSummary {
  monthLabel: string;
  thisMonth: number;
  previousMonth: number;
  delta: number;
  streakWeeks: number;
  weekly: Array<{ weekStart: string; count: number }>;
  favouriteActivities: Array<{ activityId: number; name: string; count: number }>;
}

export interface RetentionSignal {
  kind: 'expiring' | 'low_visits' | 'inactive' | 'cancellations' | 'no_show';
  customerId: number;
  customerName: string;
  phone: string;
  title: string;
  detail: string;
  severity: 'high' | 'medium';
}

export interface AdminDashboard {
  activeCustomers: number;
  activeMemberships: number;
  bookingsToday: number;
  attendanceThisMonth: number;
  classesToday: number;
  occupancyToday: number;
  membershipsExpiringSoon: number;
  clientsAtRisk: number;
}
