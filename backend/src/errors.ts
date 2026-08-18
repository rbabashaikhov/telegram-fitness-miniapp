export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorBody(error: unknown): {
  error: string;
  code: string;
  details?: unknown;
} {
  if (error instanceof AppError) {
    return {
      error: error.message,
      code: error.code,
      ...(error.details !== undefined ? { details: error.details } : {}),
    };
  }
  if (error instanceof Error) {
    return { error: error.message, code: 'INTERNAL_ERROR' };
  }
  return { error: 'Internal server error', code: 'INTERNAL_ERROR' };
}

export function statusFromError(error: unknown, fallback = 500): number {
  if (error instanceof AppError) return error.status;
  return fallback;
}
