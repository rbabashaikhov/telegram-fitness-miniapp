export interface SalesDemoEligibility {
  isDemo: boolean;
  isTelegram: boolean;
  demoMode: boolean;
  demoTourEnabled: boolean;
  isAdminPath: boolean;
}

export function isSalesDemoAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/demo/admin');
}

export function canRunSalesDemoTour(input: SalesDemoEligibility): boolean {
  return (
    input.isDemo &&
    !input.isTelegram &&
    input.demoMode &&
    input.demoTourEnabled
  );
}

export function shouldAutoStartTour(input: SalesDemoEligibility & { hasBeenSeen: boolean }): boolean {
  return canRunSalesDemoTour(input) && !input.hasBeenSeen && !input.isAdminPath;
}

export function canShowSalesDemoChrome(input: {
  isDemo: boolean;
  isTelegram: boolean;
  demoMode: boolean;
  demoTourEnabled: boolean;
  demoAdminPreviewEnabled: boolean;
  isAdminPath: boolean;
}): boolean {
  if (!input.isDemo || input.isTelegram || !input.demoMode) return false;
  return input.demoTourEnabled || input.demoAdminPreviewEnabled;
}
