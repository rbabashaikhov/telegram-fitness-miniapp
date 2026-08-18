type LogLevel = 'info' | 'warn' | 'error';

const SENSITIVE = /token|secret|password|authorization|initdata|init_data/i;

function sanitize(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.length > 500) return `${value.slice(0, 80)}…`;
    return value;
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
      if (SENSITIVE.test(key)) {
        return [key, '[redacted]'];
      }
      return [key, sanitize(nested)];
    });
    return Object.fromEntries(entries);
  }
  return value;
}

function write(level: LogLevel, message: string, extra?: unknown): void {
  const line = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(extra !== undefined ? { extra: sanitize(extra) } : {}),
  };
  const serialized = JSON.stringify(line);
  if (level === 'error') {
    console.error(serialized);
    return;
  }
  if (level === 'warn') {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
}

export const logger = {
  info: (message: string, extra?: unknown) => write('info', message, extra),
  warn: (message: string, extra?: unknown) => write('warn', message, extra),
  error: (message: string, extra?: unknown) => write('error', message, extra),
};
