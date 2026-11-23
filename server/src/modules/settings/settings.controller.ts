import type { Request, Response } from 'express';
import { unauthorized } from '../../types/errors';
import * as service from './settings.service';
import { settingsSchema } from './settings.schema';

export async function get(_req: Request, res: Response): Promise<void> {
  res.json({ settings: await service.getSettings() });
}

export async function update(req: Request, res: Response): Promise<void> {
  if (!req.user) throw unauthorized();
  const input = settingsSchema.parse(req.body);
  res.json({ settings: await service.updateSettings(input, req.user.id) });
}
