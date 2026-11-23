import type { Request, Response } from 'express';
import { unauthorized } from '../../types/errors';
import * as service from './auth.service';
import { changePasswordSchema, loginSchema } from './auth.schema';

/**
 * Controllers do HTTP and nothing else: parse, delegate, respond. Every rule
 * lives in the service.
 */

export async function login(req: Request, res: Response): Promise<void> {
  const credentials = loginSchema.parse(req.body);
  const user = await service.login(credentials.email, credentials.password);

  // Rotate the session id on privilege change so a pre-login cookie cannot be
  // reused after authentication.
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.supplierId = user.supplier_id;

  await new Promise<void>((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });

  res.json({ user, redirect_to: service.landingPathFor(user) });
}

export async function logout(req: Request, res: Response): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
  res.clearCookie('smartstock.sid', { path: '/' });
  res.status(204).end();
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) throw unauthorized();
  res.json({ user: req.user });
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  if (!req.user) throw unauthorized();
  const input = changePasswordSchema.parse(req.body);
  await service.changePassword(req.user.id, input.current_password, input.new_password);
  res.json({ message: 'Password changed.' });
}
