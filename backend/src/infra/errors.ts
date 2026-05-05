export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message, 'VALIDATION_ERROR');
  }
}

export function extractErrorCode(err: unknown): number {
  if (err instanceof AppError) return err.statusCode;
  if (err instanceof SyntaxError) return 400;
  return 500;
}

export function formatErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    let message = err.message;
    let cause = (err as any).cause;
    while (cause instanceof Error) {
      message += ` | ${cause.message}`;
      cause = (cause as any).cause;
    }
    return message;
  }
  return String(err);
}
