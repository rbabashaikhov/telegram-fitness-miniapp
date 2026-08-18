export function tourTargetSelector(hook: string): string {
  return `[data-demo-tour="${hook}"]`;
}

export function findTourTarget(
  hook: string,
  root: ParentNode | null | undefined = typeof document !== 'undefined' ? document : undefined,
): Element | null {
  if (!hook || !root || typeof root.querySelector !== 'function') return null;
  try {
    return root.querySelector(tourTargetSelector(hook));
  } catch {
    return null;
  }
}

export async function waitForTourTarget(
  hook: string,
  options?: { timeoutMs?: number; intervalMs?: number; root?: ParentNode | null },
): Promise<Element | null> {
  const timeoutMs = options?.timeoutMs ?? 2500;
  const intervalMs = options?.intervalMs ?? 80;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const found = findTourTarget(hook, options?.root);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return findTourTarget(hook, options?.root);
}

export function paddedRect(rect: DOMRect, padding = 8): {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
} {
  return {
    top: Math.max(8, rect.top - padding),
    left: Math.max(8, rect.left - padding),
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
    bottom: rect.bottom + padding,
    right: rect.right + padding,
  };
}
