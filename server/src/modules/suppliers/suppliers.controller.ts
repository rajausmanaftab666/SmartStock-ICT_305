import type { Request, Response } from 'express';
import * as service from './suppliers.service';
import {
  idParamSchema,
  supplierQuerySchema,
  supplierSchema,
  supplierStatusSchema,
} from './suppliers.schema';

export async function list(req: Request, res: Response): Promise<void> {
  const query = supplierQuerySchema.parse(req.query);
  res.json(await service.list(query));
}

export async function get(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  res.json({ supplier: await service.getDetail(id) });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = supplierSchema.parse(req.body);
  res.status(201).json({ supplier: await service.create(input) });
}

export async function update(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const input = supplierSchema.parse(req.body);
  res.json({ supplier: await service.update(id, input) });
}

export async function setStatus(req: Request, res: Response): Promise<void> {
  const { id } = idParamSchema.parse(req.params);
  const { status } = supplierStatusSchema.parse(req.body);
  res.json({ supplier: await service.setStatus(id, status) });
}
