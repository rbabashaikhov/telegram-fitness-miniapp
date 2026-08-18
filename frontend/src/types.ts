export interface AppConfig {
  businessName: string;
  appTitle: string;
  appDescription: string;
  timezone: string;
  demoMode: boolean;
  adminProtected: boolean;
  branding: { accent: string; logoUrl: string | null };
  features: { demoTour: boolean; demoAdminPreview: boolean };
}

export interface Session {
  id: number;
  locationId: number;
  locationName: string;
  locationAddress: string;
  activityId: number;
  activityName: string;
  activityImage: string;
  trainerId: number;
  trainerName: string;
  trainerPhoto: string;
  trainerSpecialization: string;
  startsAt: string;
  endsAt: string;
  date: string;
  time: string;
  durationMinutes: number;
  capacity: number;
  bookedCount: number;
  spotsLeft: number;
  status: string;
}

export interface Booking {
  id: number;
  customerId: number;
  customerName: string;
  classSessionId: number;
  membershipId: number | null;
  membershipName: string | null;
  status: 'BOOKED' | 'CANCELLED' | 'ATTENDED' | 'NO_SHOW';
  bookedAt: string;
  cancelledAt: string | null;
  attendedAt: string | null;
  session: Session;
}

export interface Membership {
  id: number;
  customerId: number;
  planId: number;
  name: string;
  membershipType: 'VISIT_BASED' | 'UNLIMITED';
  status: string;
  startsAt: string;
  expiresAt: string;
  totalVisits: number | null;
  remainingVisits: number | null;
  usedVisits: number;
  reservedVisits: number;
  bookableVisits: number | null;
  freezeFrom: string | null;
  freezeUntil: string | null;
  description: string;
}

export interface Progress {
  monthLabel: string;
  thisMonth: number;
  previousMonth: number;
  delta: number;
  streakWeeks: number;
  weekly: Array<{ weekStart: string; count: number }>;
  favouriteActivities: Array<{ activityId: number; name: string; count: number }>;
}

export interface Portal {
  club: {
    id: number;
    name: string;
    description: string;
    phone: string;
    email: string;
    address: string;
    timezone: string;
  };
  customer: {
    id: number;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    status: string;
  };
  membership: Membership | null;
  memberships: Membership[];
  nextWorkout: Booking | null;
  bookings: Booking[];
  progress: Progress;
}

export interface Activity {
  id: number;
  name: string;
  description: string;
  durationMinutes: number;
  capacityDefault: number;
  image: string;
}

export interface Trainer {
  id: number;
  name: string;
  photo: string;
  specialization: string;
  description: string;
  nextSession: Session | null;
}

export interface RetentionSignal {
  kind: string;
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

export interface AdminCustomer {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  status?: string;
  membershipName: string | null;
  membershipStatus: string | null;
  expiresAt: string | null;
  remainingVisits: number | null;
  lastVisitAt: string | null;
}

export interface LedgerEntry {
  id: number;
  customer_membership_id: number;
  booking_id: number | null;
  operation: string;
  delta: number;
  reason: string;
  created_at: string;
}
