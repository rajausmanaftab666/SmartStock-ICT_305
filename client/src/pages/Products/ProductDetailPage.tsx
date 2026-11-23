import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MOVEMENT_REASON_LABEL, type StockMovement } from '@shared';
import { ApiError } from '../../api/client';
import { productsApi } from '../../api/products';
import { Badge } from '../../components/Badge';
import { CellNumber, CellText, DataTable, type Column } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { PageHeader, type PageAction } from '../../components/PageHeader';
import { Panel, PanelGrid } from '../../components/Panel';
import { useAuth, useSettings } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { formatDateTime, formatMoney } from '../../lib/format';

const PAGE_SIZE = 20;

/** S10 — product detail and its full stock movement history. */
export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const productId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const settings = useSettings();
  const queryClient = useQueryClient();
  const { is } = useAuth();

  const canEdit = is('admin', 'staff');
  const canRecordMovement = is('staff');

  const [page, setPage] = useState(1);
  const [confirmingStatus, setConfirmingStatus] = useState(false);

  const productQuery = useQuery({
    queryKey: ['products', productId],
    queryFn: () => productsApi.get(productId),
  });

  const movementsQuery = useQuery({
    queryKey: ['products', productId, 'movements', page],
    queryFn: () => productsApi.movements(productId, page, PAGE_SIZE),
  });

  const product = productQuery.data;

  const toggleStatus = useMutation({
    mutationFn: () =>
      productsApi.setStatus(productId, product?.status === 'active' ? 'inactive' : 'active'),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      setConfirmingStatus(false);
      toast.success(
        `${updated.name} ${updated.status === 'active' ? 'reactivated' : 'deactivated'}.`
      );
    },
    onError: (error) => {
      setConfirmingStatus(false);
      toast.error(error instanceof ApiError ? error.message : 'Could not change the status.');
    },
  });

  if (productQuery.isError) {
    return (
      <>
        <PageHeader title="Product" back={{ label: 'Inventory', to: '/products' }} />
        <div className="card card--pad empty">
          <span className="empty__glyph">—</span>
          <span className="empty__title">That product could not be loaded</span>
          <span className="empty__text">
            {productQuery.error instanceof ApiError
              ? productQuery.error.message
              : 'Please try again.'}
          </span>
        </div>
      </>
    );
  }

  const columns: Column<StockMovement>[] = [
    {
      key: 'created_at',
      label: 'Date',
      render: (row) => <CellText value={formatDateTime(row.created_at)} tone="muted" />,
    },
    {
      key: 'type',
      label: 'Type',
      // Green for stock coming in, red for stock going out.
      render: (row) => <Badge tone={row.type === 'IN' ? 'received' : 'rejected'}>{row.type}</Badge>,
    },
    {
      key: 'reason',
      label: 'Reason',
      render: (row) => <CellText value={MOVEMENT_REASON_LABEL[row.reason]} tone="muted" />,
    },
    {
      key: 'quantity_change',
      label: 'Change',
      align: 'right',
      render: (row) => (
        <CellNumber
          value={`${row.quantity_change > 0 ? '+' : ''}${row.quantity_change}`}
          strong
          tone={row.quantity_change > 0 ? 'success' : 'danger'}
        />
      ),
    },
    {
      key: 'balance_after',
      label: 'Balance after',
      align: 'right',
      render: (row) => <CellNumber value={row.balance_after} />,
    },
    {
      key: 'reference',
      label: 'Reference',
      render: (row) => <CellText value={row.reference ?? '—'} mono tone="muted" />,
    },
    {
      key: 'note',
      label: 'Note',
      render: (row) => <CellText value={row.note ?? '—'} tone="muted" wrap />,
    },
    {
      key: 'user_name',
      label: 'User',
      render: (row) => <CellText value={row.user_name} tone="muted" />,
    },
  ];

  const actions: PageAction[] = [];
  if (canEdit && product) {
    actions.push({
      label: 'Edit product',
      variant: 'primary',
      onClick: () => navigate(`/products/${productId}/edit`),
    });
  }
  if (canRecordMovement && product) {
    actions.push({
      label: 'Record movement',
      variant: 'secondary',
      onClick: () => navigate(`/stock/record?product=${productId}`),
    });
  }
  if (canEdit && product) {
    actions.push({
      label: product.status === 'active' ? 'Deactivate' : 'Activate',
      variant: product.status === 'active' ? 'danger' : 'secondary',
      onClick: () => setConfirmingStatus(true),
    });
  }

  const shortfall = product ? product.min_stock_level - product.quantity_in_stock : 0;

  return (
    <>
      <PageHeader
        title={product?.name ?? 'Product'}
        subtitle={
          product
            ? `${product.sku} · ${product.category_name} · ${product.supplier_name}`
            : undefined
        }
        back={{ label: 'Inventory', to: '/products' }}
        actions={actions}
      />

      {product && (
        <PanelGrid>
          <Panel
            title="Product details"
            badge={
              product.is_low
                ? { label: 'Low stock', bg: 'var(--danger-bg)', fg: 'var(--danger-fg)' }
                : product.status === 'active'
                  ? { label: 'Active', bg: 'var(--success-bg)', fg: 'var(--success-fg)' }
                  : { label: 'Inactive', bg: 'var(--divider)', fg: 'var(--muted)' }
            }
            rows={[
              { label: 'SKU', value: <span className="mono">{product.sku}</span> },
              { label: 'Category', value: product.category_name },
              {
                label: 'Supplier',
                value: <Link to={`/suppliers?search=${encodeURIComponent(product.supplier_name)}`}>{product.supplier_name}</Link>,
              },
              { label: 'Unit', value: product.unit },
              {
                label: 'Unit price',
                value: formatMoney(product.unit_price, settings.currency_symbol),
              },
            ]}
          />

          <Panel
            title="Stock position"
            rows={[
              {
                label: 'In stock',
                value: `${product.quantity_in_stock} ${product.unit}`,
                tone: product.is_low ? 'danger' : 'default',
              },
              { label: 'Minimum level', value: String(product.min_stock_level) },
              {
                label: 'Shortfall',
                value: product.is_low ? String(shortfall) : '—',
                tone: product.is_low ? 'danger' : 'muted',
              },
              {
                label: 'Stock value',
                value: formatMoney(
                  product.quantity_in_stock * product.unit_price,
                  settings.currency_symbol
                ),
              },
            ]}
            action={
              canRecordMovement
                ? {
                    label: 'Record movement',
                    onClick: () => navigate(`/stock/record?product=${productId}`),
                  }
                : undefined
            }
          />

          <Panel
            title="Audit"
            rows={[
              { label: 'Created by', value: product.created_by_name },
              { label: 'Created', value: formatDateTime(product.created_at), tone: 'muted' },
              { label: 'Last updated by', value: product.updated_by_name ?? '—' },
              { label: 'Updated', value: formatDateTime(product.updated_at), tone: 'muted' },
            ]}
          />
        </PanelGrid>
      )}

      <DataTable
        title="Stock movement history"
        columns={columns}
        rows={movementsQuery.data?.rows ?? []}
        rowKey={(row) => row.id}
        total={movementsQuery.data?.total ?? 0}
        page={page}
        limit={PAGE_SIZE}
        onPageChange={setPage}
        loading={movementsQuery.isLoading}
        unit="movements"
        empty={{
          title: 'No movements recorded',
          text: 'Movements appear here as stock is received or adjusted.',
        }}
      />

      {confirmingStatus && product && (
        <Modal
          title={
            product.status === 'active' ? 'Deactivate this product?' : 'Reactivate this product?'
          }
          body={
            product.status === 'active'
              ? `${product.name} will be hidden from purchase order pickers but stays visible in history, and its ${movementsQuery.data?.total ?? 0} ledger rows are kept. Products are deactivated, never deleted (BR10).`
              : `${product.name} will be offered again when raising purchase orders.`
          }
          confirmLabel={product.status === 'active' ? 'Deactivate' : 'Activate'}
          tone={product.status === 'active' ? 'danger' : 'primary'}
          busy={toggleStatus.isPending}
          onCancel={() => setConfirmingStatus(false)}
          onConfirm={() => toggleStatus.mutate()}
        />
      )}
    </>
  );
}
