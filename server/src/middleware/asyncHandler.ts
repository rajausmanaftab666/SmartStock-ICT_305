import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 does not forward rejected promises to the error handler, so every
 * async route is wrapped in this. Without it a failed await would hang the
 * request instead of returning a 500.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
