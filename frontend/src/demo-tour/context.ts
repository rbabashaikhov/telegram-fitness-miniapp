import { createContext, useContext } from 'react';

export interface DemoTourContextValue {
  start: () => void;
  skip: () => void;
  showChrome: boolean;
  demoTourEnabled: boolean;
  demoAdminPreviewEnabled: boolean;
}

export const DemoTourContext = createContext<DemoTourContextValue | null>(null);

export function useDemoTour(): DemoTourContextValue {
  const ctx = useContext(DemoTourContext);
  if (!ctx) throw new Error('useDemoTour must be used within DemoTourProvider');
  return ctx;
}
