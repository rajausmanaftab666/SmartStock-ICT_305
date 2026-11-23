import type { Category, CategoryInput } from '@shared';
import { api } from './client';

export const categoriesApi = {
  list: async (): Promise<Category[]> => {
    const { categories } = await api.get<{ categories: Category[] }>('/api/categories');
    return categories;
  },

  create: async (input: CategoryInput): Promise<Category> => {
    const { category } = await api.post<{ category: Category }>('/api/categories', { ...input });
    return category;
  },

  update: async (id: number, input: CategoryInput): Promise<Category> => {
    const { category } = await api.put<{ category: Category }>(`/api/categories/${id}`, {
      ...input,
    });
    return category;
  },

  /** 409 when the category is still referenced by a product (BR12). */
  remove: (id: number) => api.delete<void>(`/api/categories/${id}`),
};
