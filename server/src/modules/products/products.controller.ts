import type { Request, Response } from 'express';
import { unauthorized } from '../../types/errors';
import * as service from './products.service';
import {
  idParamSchema,
  lowStockQuerySchema,
  movementPageSchema,
  productCreateSchema,
  productQuerySchema,
  productStatusSchema,
  productUpdateSchema,
} from './products.schema';

export async function list(req: Request, res: Response): Promise<void> {
  const query = productQuerySchema.parse(req.query);
  res.json(await service.list(query));
}

export async function get(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  res.json({ product: await service.get(id) });
}

export async function create(req: Request, res: Response): Promise<void> {
  if (!req.user) throw unauthorized();
  const input = productCreateSchema.parse(req.body);
  res.status(201).json({ product: await service.create(input, req.user.id) });
}

export async function update(req: Request, res: Response): Promise<void> {
  if (!req.user) throw unauthorized();
  const { id } = idParamSchema.parse(req.params);
  const input = productUpdateSchema.parse(req.body);
  res.json({ product: await service.update(id, input, req.user.id) });
}

export async function setStatus(req: Request, res: Response): Promise<void> {
  if (!req.user) throw unauthorized();
  const { id } = idParamSchema.parse(req.params);
  const { status } = productStatusSchema.parse(req.body);
  res.json({ product: await service.setStatus(id, status, req.user.id) });
}

export async function lowStock(req: Request, res: Response): Promise<void> {
  const { supplier_id } = lowStockQuerySchema.parse(req.query);
  const items = await service.lowStock(supplier_id);
  res.json({ items, count: items.length });
}

export async function movements(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const { page, limit } = movementPageSchema.parse(req.query);
  res.json(await service.movements(id, page, limit));
}
