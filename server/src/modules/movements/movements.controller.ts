import type { Request, Response } from 'express';
import { unauthorized } from '../../types/errors';
import * as service from './movements.service';
import { movementCreateSchema, movementQuerySchema } from './movements.schema';

export async function list(req: Request, res: Response): Promise<void> {
  const query = movementQuerySchema.parse(req.query);
  res.json(await service.list(query));
}

export async function create(req: Request, res: Response): Promise<void> {
  if (!req.user) throw unauthorized();
  const input = movementCreateSchema.parse(req.body);
  const applied = await service.recordManual(input, req.user.id);

  res.status(201).json({
    movement_id: applied.movementId,
    previous_balance: applied.previousBalance,
    quantity_change: applied.quantityChange,
    balance_after: applied.balanceAfter,
    is_low_after: applied.isLowAfter,
    product: applied.product,
  });
}
