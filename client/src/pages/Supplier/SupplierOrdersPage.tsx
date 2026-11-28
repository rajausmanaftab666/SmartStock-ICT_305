import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { PurchaseOrder } from '@shared';
import { dashboardApi } from '../../api/admin';
import { purchaseOrdersApi } from '../../api/purchaseOrders';
import { Badge } from '../../components/Badge';
import { CellNumber, CellText, DataTable, type Column } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { useCurrentUser, useSettings } from '../../hooks/useAuth';
import { formatDate, formatMoney } from '../../lib/format';

const PAGE_SIZE = 20;

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'approved', label: 'New' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'received', label: 'Completed' },
];

/**
 * S21 — the supplier portal.
 *
 * Nothing here filters by supplier: the API confines a supplier user to their
 * own company inside the SQL (BR11). If this component asked for another
 * supplier's orders it would simply get its own back.
 */
export function SupplierOrdersPage() {
  const user = useCurrentUser();
  const settings = useSettings();
  const navigate = useNavigate();

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const listQuery = useQuery({
    queryKey: ['purchase-orders', 'supplier', { tab, search, page }],
    queryFn: () =>
      purchaseOrdersApi.list({
        // "Completed" covers full and partial receipts, so it goes through a
        // server-side bucket rather than filtering a single page in the browser.
        status: tab === 'all' || tab === 'received' ? undefined : tab,
        bucket: tab === 'received' ? 'received' : undefined,
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      }),
  });

  const rows = listQuery.data?.rows ?? [];

  // The three cards come from the supplier dashboard endpoint, which counts in
  // SQL over this supplier's own orders (BR11) rather than over one page.
  const countsQuery = useQuery({
    queryKey: ['dashboard', 'supplier'],
    queryFn: dashboardApi.supplier,
    select: (board) => ({
      newOrders: board.new_orders,
      shipped: board.shipped,
      completed: board.completed_this_month,
    }),
  });

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'po_number',
      label: 'PO number',
      render: (row) => <CellText value={row.po_number} mono strong />,
    },
    {
      key: 'order_date',
      label: 'Order date',
      render: (row) => <CellText value={formatDate(row.order_date)} tone="muted" />,
    },
    {
      key: 'expected_date',
      label: 'Expected',
      render: (row) => <CellText value={formatDate(row.expected_date)} tone="muted" />,
    },
    {
      key: 'line_count',
      label: 'Lines',
      align: 'right',
      render: (row) => <CellNumber value={row.line_count} />,
    },
    {
      key: 'total_amount',
      label: 'Total',
      align: 'right',
      render: (row) => (
        <CellNumber value={formatMoney(row.total_amount, settings.currency_symbol)} strong />
      ),
    },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={row.status} /> },
  ];

  const counts = countsQuery.data;

  return (
    <>
      <PageHeader
        title="My orders"
        subtitle={`Orders addressed to ${user.supplier_name ?? 'your company'}. Scoped server-side by supplier (BR11).`}
      />

      <div className="stat-grid">
        <button type="button" className="stat-card" onClick={() => setTab('approved')}>
          <span className="stat-card__label">New orders</span>
          <span className="stat-card__value" style={{ color: 'var(--primary)' }}>
            {counts?.newOrders ?? '—'}
          </span>
          <span className="stat-card__note">approved, ready to ship</span>
        </button>
        <button type="button" className="stat-card" onClick={() => setTab('shipped')}>
          <span className="stat-card__label">Shipped</span>
          <span className="stat-card__value">{counts?.shipped ?? '—'}</span>
          <span className="stat-card__note">awaiting receipt</span>
        </button>
        <button type="button" className="stat-card" onClick={() => setTab('received')}>
          <span className="stat-card__label">Completed this month</span>
          <span className="stat-card__value">{counts?.completed ?? '—'}</span>
          <span className="stat-card__note">fully received</span>
        </button>
      </div>

      <DataTable
        title="Purchase orders"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        total={listQuery.data?.total ?? 0}
        page={page}
        limit={PAGE_SIZE}
        onPageChange={setPage}
        loading={listQuery.isLoading}
        onRowClick={(row) => navigate(`/supplier/orders/${row.id}`)}
        unit="orders"
        search={{
          value: search,
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
          placeholder: 'Search PO number',
        }}
        tabs={{
          value: tab,
          options: TABS,
          onChange: (value) => {
            setTab(value);
            setPage(1);
          },
        }}
        empty={{
          title: 'No orders here',
          text: 'Approved orders for your company appear here.',
        }}
      />
    </>
  );
}
