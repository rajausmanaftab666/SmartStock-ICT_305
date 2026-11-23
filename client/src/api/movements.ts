import type { LowStockItem, MovementCreateInput, Paginated, Product, StockMovement } from '@shared';
import { api, withQuery } from './client';

export interface RecordedMovement {
  movement_id: number;
  previous_balance: number;
  quantity_change: number;
  balance_after: number;
  is_low_after: boolean;
  product: Product;
}

export interface MovementListParams {
  product_id?: number | string;
  type?: string;
  reason?: string;
  user_id?: number | string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const movementsApi = {
  list: (params: MovementListParams) =>
    api.get<Paginated<StockMovement>>(withQuery('/api/stock-movements', { ...params })),

  create: (input: MovementCreateInput) =>
    api.post<RecordedMovement>('/api/stock-movements', { ...input }),

  lowStock: (supplierId?: number | string) =>
    api.get<{ items: LowStockItem[]; count: number }>(
      withQuery('/api/products/low-stock', { supplier_id: supplierId })
    ),
};
