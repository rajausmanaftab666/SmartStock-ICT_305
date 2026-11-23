import type {
  EntityStatus,
  Paginated,
  Product,
  ProductCreateInput,
  ProductUpdateInput,
  StockMovement,
} from '@shared';
import { api, withQuery } from './client';

export interface ProductListParams {
  search?: string;
  category_id?: number | string;
  supplier_id?: number | string;
  status?: string;
  low_stock?: boolean;
  sort?: string;
  direction?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export const productsApi = {
  list: (params: ProductListParams) =>
    api.get<Paginated<Product>>(
      withQuery('/api/products', {
        ...params,
        // withQuery drops falsey values, so only send the flag when it is on.
        low_stock: params.low_stock ? 'true' : undefined,
      })
    ),

  get: async (id: number): Promise<Product> => {
    const { product } = await api.get<{ product: Product }>(`/api/products/${id}`);
    return product;
  },

  movements: (id: number, page: number, limit: number) =>
    api.get<Paginated<StockMovement>>(
      withQuery(`/api/products/${id}/movements`, { page, limit })
    ),

  create: async (input: ProductCreateInput): Promise<Product> => {
    const { product } = await api.post<{ product: Product }>('/api/products', { ...input });
    return product;
  },

  update: async (id: number, input: ProductUpdateInput): Promise<Product> => {
    const { product } = await api.put<{ product: Product }>(`/api/products/${id}`, { ...input });
    return product;
  },

  setStatus: async (id: number, status: EntityStatus): Promise<Product> => {
    const { product } = await api.patch<{ product: Product }>(`/api/products/${id}/status`, {
      status,
    });
    return product;
  },
};
