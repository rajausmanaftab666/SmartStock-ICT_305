import type {
  Paginated,
  PurchaseOrder,
  PurchaseOrderDetail,
  PurchaseOrderInput,
  ReceiveInput,
} from '@shared';
import { api, withQuery } from './client';

export interface PurchaseOrderListParams {
  status?: string;
  bucket?: string;
  supplier_id?: number | string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ReceiptResult {
  order: PurchaseOrderDetail;
  applied: Array<{
    product_name: string;
    sku: string;
    unit: string;
    previous_balance: number;
    balance_after: number;
    quantity: number;
  }>;
  fully_received: boolean;
}

async function unwrap(promise: Promise<{ order: PurchaseOrderDetail }>) {
  return (await promise).order;
}

export const purchaseOrdersApi = {
  list: (params: PurchaseOrderListParams) =>
    api.get<Paginated<PurchaseOrder>>(withQuery('/api/purchase-orders', { ...params })),

  get: (id: number) =>
    unwrap(api.get<{ order: PurchaseOrderDetail }>(`/api/purchase-orders/${id}`)),

  create: (input: PurchaseOrderInput) =>
    unwrap(api.post<{ order: PurchaseOrderDetail }>('/api/purchase-orders', { ...input })),

  update: (id: number, input: PurchaseOrderInput) =>
    unwrap(api.put<{ order: PurchaseOrderDetail }>(`/api/purchase-orders/${id}`, { ...input })),

  remove: (id: number) => api.delete<void>(`/api/purchase-orders/${id}`),

  submit: (id: number) =>
    unwrap(api.post<{ order: PurchaseOrderDetail }>(`/api/purchase-orders/${id}/submit`)),

  approve: (id: number) =>
    unwrap(api.post<{ order: PurchaseOrderDetail }>(`/api/purchase-orders/${id}/approve`)),

  reject: (id: number, rejection_reason: string) =>
    unwrap(
      api.post<{ order: PurchaseOrderDetail }>(`/api/purchase-orders/${id}/reject`, {
        rejection_reason,
      })
    ),

  cancel: (id: number) =>
    unwrap(api.post<{ order: PurchaseOrderDetail }>(`/api/purchase-orders/${id}/cancel`)),

  ship: (id: number) =>
    unwrap(api.post<{ order: PurchaseOrderDetail }>(`/api/purchase-orders/${id}/ship`)),

  receive: (id: number, input: ReceiveInput) =>
    api.post<ReceiptResult>(`/api/purchase-orders/${id}/receive`, { ...input }),
};
