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

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(403, message, 'FORBIDDEN');
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
