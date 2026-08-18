import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import App from './App';
import { api, setTelegramInitData } from './api/client';
import { AppContext, type AppContextValue } from './context/AppContext';
import { BusinessContext, DEFAULT_APP_CONFIG } from './context/BusinessContext';
import { fitnessDemoTour } from './demo-tour/fitnessTour';
import { DemoTourProvider } from './demo-tour/DemoTourProvider';
import type { AppConfig } from './types';
import './styles.css';

const DEMO_USER = {
  id: 999000001,
  username: 'demo_client',
  firstName: 'Александр',
  lastName: 'Волков',
};

function Root() {
  const [ready, setReady] = useState(false);
  const [business, setBusiness] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [context, setContext] = useState<AppContextValue>({
    user: DEMO_USER,
    isDemo: true,
    isTelegram: false,
  });

  useEffect(() => {
    let cancelled = false;
    api
      .getConfig()
      .then((res) => {
        if (cancelled) return;
        setBusiness(res.data);
        document.title = res.data.appTitle;
        if (res.data.branding?.accent) {
          document.documentElement.style.setProperty('--accent', res.data.branding.accent);
        }
      })
      .catch(() => {
        if (!cancelled) setBusiness(DEFAULT_APP_CONFIG);
      });

    try {
      const tg = WebApp;
      tg.ready();
      tg.expand();
      const initData = tg.initData || '';
      const user = tg.initDataUnsafe?.user;
      if (initData && user?.id) {
        setTelegramInitData(initData);
        setContext({
          user: {
            id: user.id,
            username: user.username,
            firstName: user.first_name,
            lastName: user.last_name,
          },
          isDemo: false,
          isTelegram: true,
        });
      } else {
        setTelegramInitData('');
        setContext({ user: DEMO_USER, isDemo: true, isTelegram: false });
      }
    } catch {
      setTelegramInitData('');
      setContext({ user: DEMO_USER, isDemo: true, isTelegram: false });
    } finally {
      setReady(true);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => context, [context]);

  if (!ready) {
    return (
      <div className="app-shell">
        <div className="loading">Загрузка…</div>
      </div>
    );
  }

  return (
    <BusinessContext.Provider value={business}>
      <AppContext.Provider value={value}>
        <BrowserRouter>
          <DemoTourProvider definition={fitnessDemoTour}>
            <App />
          </DemoTourProvider>
        </BrowserRouter>
      </AppContext.Provider>
    </BusinessContext.Provider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
