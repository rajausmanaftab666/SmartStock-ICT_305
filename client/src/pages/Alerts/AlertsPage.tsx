import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LowStockItem } from '@shared';
import {
  CellActions,
  CellNumber,
  CellText,
  DataTable,
  type Column,
} from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { useLowStockList } from '../../hooks/useLowStock';
import { useSuppliers } from '../../hooks/useLookups';
import { formatDate } from '../../lib/format';

/**
 * S12 — everything at or below its minimum, worst shortfall first (BR15).
 *
 * Staff get a "Create order" action per row, which opens S15 pre-filled with
 * that product's supplier and a suggested quantity of min × 2 − quantity.
 */
export function AlertsPage() {
  const { is } = useAuth();
  const navigate = useNavigate();
  const [supplierId, setSupplierId] = useState('all');

  const suppliers = useSuppliers();
  const lowStock = useLowStockList(supplierId);
  const items = lowStock.data?.items ?? [];

  const canRaiseOrder = is('staff');

  const columns: Column<LowStockItem>[] = [
    {
      key: 'name',
      label: 'Product',
      render: (row) => <CellText value={row.name} sub={row.sku} strong wrap />,
    },
    {
      key: 'supplier_name',
      label: 'Supplier',
      render: (row) => <CellText value={row.supplier_name} tone="muted" />,
    },
    {
      key: 'quantity_in_stock',
      label: 'In stock',
      align: 'right',
      render: (row) => <CellNumber value={row.quantity_in_stock} strong tone="danger" />,
    },
    {
      key: 'min_stock_level',
      label: 'Min',
      align: 'right',
      render: (row) => <CellNumber value={row.min_stock_level} tone="muted" />,
    },
    {
      key: 'shortfall',
      label: 'Shortfall',
      align: 'right',
      render: (row) => <CellNumber value={row.shortfall} strong />,
    },
    {
      key: 'last_received_at',
      label: 'Last received',
      render: (row) => (
        <CellText
          value={row.last_received_at ? formatDate(row.last_received_at.slice(0, 10)) : 'Never'}
          tone="muted"
        />
      ),
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) =>
        canRaiseOrder ? (
          <CellActions>
            <button
              type="button"
              className="btn btn--xs"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'var(--surface)' }}
              onClick={() =>
                navigate(
                  `/purchase-orders/new?supplier=${row.supplier_id}&product=${row.id}&quantity=${row.suggested_order_quantity}`
                )
              }
            >
              Create order
            </button>
          </CellActions>
        ) : (
          <CellNumber value="—" tone="muted" />
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Low stock alerts"
        subtitle="Computed live: quantity at or below minimum and status active (BR15). Sorted by shortfall."
      />

      <DataTable
        title="Below minimum"
        columns={columns}
        rows={items}
        rowKey={(row) => row.id}
        // The alerts list is short by nature and always shown whole.
        total={items.length}
        page={1}
        limit={Math.max(items.length, 1)}
        onPageChange={() => undefined}
        loading={lowStock.isLoading}
        unit="products below minimum"
        filters={
          <select
            className="select select--sm"
            style={{ width: 'auto' }}
            value={supplierId}
            aria-label="Supplier"
            onChange={(event) => setSupplierId(event.target.value)}
          >
            <option value="all">All suppliers</option>
            {(suppliers.data ?? []).map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        }
        empty={{
          title: 'All good',
          text: 'All products are above their minimum stock level.',
        }}
      />
    </>
  );
}
