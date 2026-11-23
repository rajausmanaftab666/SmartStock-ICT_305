import type { Request, Response } from 'express';
import { unauthorized } from '../../types/errors';
import * as service from './users.service';
import {
  idParamSchema,
  resetPasswordSchema,
  userCreateSchema,
  userQuerySchema,
  userStatusSchema,
  userUpdateSchema,
} from './users.schema';

function actingUserId(req: Request): number {
  if (!req.user) throw unauthorized();
  return req.user.id;
}

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.list(userQuerySchema.parse(req.query)));
}

export async function get(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  res.json({ user: await service.get(id) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = userCreateSchema.parse(req.body);
  res.status(201).json({ user: await service.create(input) });
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const input = userUpdateSchema.parse(req.body);
  res.json({ user: await service.update(id, input, actingUserId(req)) });
}

export async function setStatus(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const { status } = userStatusSchema.parse(req.body);
  res.json({ user: await service.setStatus(id, status, actingUserId(req)) });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const { new_password } = resetPasswordSchema.parse(req.body);
  await service.resetPassword(id, new_password);
  res.json({ message: 'Password reset. Hand the new password over directly.' });
}
