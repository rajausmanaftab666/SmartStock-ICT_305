import type { Request, Response } from 'express';
import { unauthorized } from '../../types/errors';
import * as service from './purchaseOrders.service';
import {
  idParamSchema,
  purchaseOrderQuerySchema,
  purchaseOrderSchema,
  receiveSchema,
  rejectSchema,
} from './purchaseOrders.schema';

/** Every handler passes req.user through: BR11 scoping is the service's job. */
function requireUser(req: Request) {
  if (!req.user) throw unauthorized();
  return req.user;
}

export async function list(req: Request, res: Response): Promise<void> {
  const query = purchaseOrderQuerySchema.parse(req.query);
  res.json(await service.list(query, requireUser(req)));
}

export async function get(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  res.json({ order: await service.get(id, requireUser(req)) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = purchaseOrderSchema.parse(req.body);
  res.status(201).json({ order: await service.create(input, requireUser(req)) });
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const input = purchaseOrderSchema.parse(req.body);
  res.json({ order: await service.update(id, input, requireUser(req)) });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  await service.remove(id, requireUser(req));
  res.status(204).end();
}

export async function submit(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  res.json({ order: await service.submit(id, requireUser(req)) });
}

export async function approve(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  res.json({ order: await service.approve(id, requireUser(req)) });
}

export async function reject(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const { rejection_reason } = rejectSchema.parse(req.body);
  res.json({ order: await service.reject(id, rejection_reason, requireUser(req)) });
}

export async function cancel(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  res.json({ order: await service.cancel(id, requireUser(req)) });
}

export async function ship(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  res.json({ order: await service.ship(id, requireUser(req)) });
}

export async function receive(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const input = receiveSchema.parse(req.body);
  res.json(await service.receive(id, input, requireUser(req)));
}
