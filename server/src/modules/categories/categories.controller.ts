import type { Request, Response } from 'express';
import * as service from './categories.service';
import { categorySchema, idParamSchema } from './categories.schema';

export async function list(_req: Request, res: Response): Promise<void> {
  res.json({ categories: await service.list() });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = categorySchema.parse(req.body);
  res.status(201).json({ category: await service.create(input) });
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const input = categorySchema.parse(req.body);
  res.json({ category: await service.update(id, input) });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  await service.remove(id);
  res.status(204).end();
}
