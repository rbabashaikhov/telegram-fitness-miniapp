import { createContext, useContext } from 'react';
import type { AppConfig } from '../types';

export const DEFAULT_APP_CONFIG: AppConfig = {
  businessName: 'Pulse Fitness Club',
  appTitle: 'Pulse Fitness Club',
  appDescription: 'Персональный кабинет фитнес-клуба',
  timezone: 'Europe/Moscow',
  demoMode: true,
  adminProtected: true,
  branding: { accent: '#C6FF4A', logoUrl: null },
  features: { demoTour: true, demoAdminPreview: true },
  retention: { expiringDays: 7, lowVisits: 2 },
};

export const BusinessContext = createContext<AppConfig>(DEFAULT_APP_CONFIG);

export function useBusiness(): AppConfig {
  return useContext(BusinessContext);
}
