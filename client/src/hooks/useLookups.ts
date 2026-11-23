import { useQuery } from '@tanstack/react-query';
import { categoriesApi } from '../api/categories';
import { suppliersApi } from '../api/suppliers';

/**
 * Category and supplier lists for filter dropdowns and form pickers. Both are
 * small, rarely change and are used on several screens, so they are cached for
 * a few minutes rather than refetched per screen.
 */

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: categoriesApi.list,
    staleTime: 5 * 60_000,
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers', 'lookup'],
    queryFn: () => suppliersApi.list({ limit: 100, sort: 'name', direction: 'asc' }),
    staleTime: 5 * 60_000,
    select: (page) => page.rows,
  });
}
