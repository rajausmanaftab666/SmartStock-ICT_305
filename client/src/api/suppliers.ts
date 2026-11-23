import type {
  EntityStatus,
  Paginated,
  Supplier,
  SupplierDetail,
  SupplierInput,
} from '@shared';
import { api, withQuery } from './client';

export interface SupplierListParams {
  search?: string;
  status?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export const suppliersApi = {
  list: (params: SupplierListParams) =>
    api.get<Paginated<Supplier>>(withQuery('/api/suppliers', { ...params })),

  get: async (id: number): Promise<SupplierDetail> => {
    const { supplier } = await api.get<{ supplier: SupplierDetail }>(`/api/suppliers/${id}`);
    return supplier;
  },

  create: async (input: SupplierInput): Promise<Supplier> => {
    const { supplier } = await api.post<{ supplier: Supplier }>('/api/suppliers', { ...input });
    return supplier;
  },

  update: async (id: number, input: SupplierInput): Promise<Supplier> => {
    const { supplier } = await api.put<{ supplier: Supplier }>(`/api/suppliers/${id}`, {
      ...input,
    });
    return supplier;
  },

  setStatus: async (id: number, status: EntityStatus): Promise<Supplier> => {
    const { supplier } = await api.patch<{ supplier: Supplier }>(`/api/suppliers/${id}/status`, {
      status,
    });
    return supplier;
  },
};
