import { createContext, useContext } from 'react';

export interface AppUser {
  id: number;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export interface AppContextValue {
  user: AppUser;
  isDemo: boolean;
  isTelegram: boolean;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppContext');
  return ctx;
}
