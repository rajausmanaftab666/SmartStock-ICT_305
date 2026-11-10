import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../types/errors';
import { isDev } from '../config/env';

/**
 * `instanceof` alone is not enough: if npm ever resolves two copies of zod,
 * a schema from shared/ throws an error whose prototype chain does not match
 * the class this file imported, and a validation failure would surface as a
 * 500 instead of a 400. Checking the shape as well makes that impossible.
 */
function isZodError(error: unknown): error is ZodError {
  return (
    error instanceof ZodError ||
    (error instanceof Error && error.name === 'ZodError' && Array.isArray((error as ZodError).issues))
  );
}

/** Anything that reaches the API without a matching route. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found.' });
};

/**
 * Single exit point for every failure. Produces the `{ error, fields? }` body
 * from §6 and nothing else — internal messages and stack traces never reach a
 * client.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (isZodError(error)) {
    // Flatten to one message per field so the client can drop them straight
    // onto the matching inputs.
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join('.') || 'form';
      if (!fields[key]) fields[key] = issue.message;
    }
    res.status(400).json({ error: 'Please correct the highlighted fields.', fields });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.status).json(
      error.fields ? { error: error.message, fields: error.fields } : { error: error.message }
    );
    return;
  }

  console.error('[api] unhandled error', error);
  res.status(500).json({
    error: isDev && error instanceof Error ? error.message : 'Something went wrong on our end.',
  });
};
