import { useQuery } from '@tanstack/react-query';
import { movementsApi } from '../api/movements';
import { useAuth } from './useAuth';

/**
 * BR15 — the low-stock count behind the sidebar pill and the header bell.
 *
 * There is no notifications table and no background job: this is the same
 * computed query every other consumer runs. Supplier users never see it.
 */
export function useLowStockCount(): number | null {
  const { user } = useAuth();
  const enabled = Boolean(user) && user?.role !== 'supplier';

  const { data } = useQuery({
    queryKey: ['products', 'low-stock', 'count'],
    queryFn: () => movementsApi.lowStock(),
    enabled,
    staleTime: 30_000,
    select: (result) => result.count,
  });

  return enabled ? (data ?? null) : null;
}

export function useLowStockList(supplierId?: string) {
  return useQuery({
    queryKey: ['products', 'low-stock', supplierId ?? 'all'],
    queryFn: () => movementsApi.lowStock(supplierId === 'all' ? undefined : supplierId),
  });
}
