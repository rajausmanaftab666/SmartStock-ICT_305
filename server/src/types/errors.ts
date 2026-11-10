/**
 * Every failure the API reports deliberately is an AppError. The error handler
 * turns it into the `{ error, fields? }` body §6 specifies; anything else that
 * reaches the handler is an unexpected fault and becomes a 500.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fields?: Record<string, string>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new AppError(400, message, fields);

export const unauthorized = (message = 'You are not signed in.') => new AppError(401, message);

export const forbidden = (message = 'You do not have access to this.') => new AppError(403, message);

export const notFound = (message = 'Not found.') => new AppError(404, message);

/** Illegal state transitions and in-use deletions (BR4, BR12). */
export const conflict = (message: string) => new AppError(409, message);
