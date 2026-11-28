import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { PurchaseOrder } from '@shared';
import { purchaseOrdersApi } from '../../api/purchaseOrders';
import { Badge } from '../../components/Badge';
import { CellNumber, CellText, DataTable, type Column } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { useAuth, useSettings } from '../../hooks/useAuth';
import { useSuppliers } from '../../hooks/useLookups';
import { formatDate, formatMoney } from '../../lib/format';

const PAGE_SIZE = 20;

/** The S16 tabs. "Received" covers partial receipts too; the last tab groups
 *  both terminal refusals, as the approved design shows. */
const TABS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'received', label: 'Received' },
  { value: 'closed', label: 'Rejected / cancelled' },
];

export function PurchaseOrderListPage() {
  const { is } = useAuth();
  const settings = useSettings();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState(searchParams.get('status') ?? 'all');
  const [supplierId, setSupplierId] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const suppliers = useSuppliers();

  /**
   * Two tabs cover more than one status, so they map to a server-side bucket
   * rather than a single status. Doing this on the server matters: filtering a
   * page of results in the browser would silently drop rows that belong on
   * later pages.
   */
  const BUCKET_TABS: Record<string, string> = {
    received: 'received', // full and partial receipts
    closed: 'refused', // rejected and cancelled — NOT received
  };

  const listQuery = useQuery({
    queryKey: ['purchase-orders', { tab, supplierId, search, dateFrom, dateTo, page }],
    queryFn: () =>
      purchaseOrdersApi.list({
        status: tab === 'all' || BUCKET_TABS[tab] ? undefined : tab,
        bucket: BUCKET_TABS[tab],
        supplier_id: supplierId,
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
        limit: PAGE_SIZE,
      }),
  });

  const rows = listQuery.data?.rows ?? [];

  function resetTo(update: () => void) {
    update();
    setPage(1);
  }

  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'po_number',
      label: 'PO number',
      render: (row) => <CellText value={row.po_number} mono strong />,
    },
    {
      key: 'supplier_name',
      label: 'Supplier',
      render: (row) => <CellText value={row.supplier_name} wrap />,
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
    {
      key: 'created_by_name',
      label: 'Raised by',
      render: (row) => <CellText value={row.created_by_name} tone="muted" />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Purchase orders"
        subtitle="Draft → pending approval → approved → shipped → received. Every transition is stamped."
        actions={
          is('staff')
            ? [
                {
                  label: 'New purchase order',
                  variant: 'primary',
                  onClick: () => navigate('/purchase-orders/new'),
                },
              ]
            : []
        }
      />

      <DataTable
        title="Orders"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        total={listQuery.data?.total ?? 0}
        page={page}
        limit={PAGE_SIZE}
        onPageChange={setPage}
        loading={listQuery.isLoading}
        onRowClick={(row) => navigate(`/purchase-orders/${row.id}`)}
        unit="orders"
        search={{
          value: search,
          onChange: (value) => resetTo(() => setSearch(value)),
          placeholder: 'Search PO number or supplier',
        }}
        tabs={{ value: tab, options: TABS, onChange: (value) => resetTo(() => setTab(value)) }}
        filters={
          <>
            <select
              className="select select--sm"
              style={{ width: 'auto' }}
              value={supplierId}
              aria-label="Supplier"
              onChange={(event) => resetTo(() => setSupplierId(event.target.value))}
            >
              <option value="all">All suppliers</option>
              {(suppliers.data ?? []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="input input--sm"
              style={{ width: 'auto' }}
              value={dateFrom}
              aria-label="Ordered from"
              onChange={(event) => resetTo(() => setDateFrom(event.target.value))}
            />
            <input
              type="date"
              className="input input--sm"
              style={{ width: 'auto' }}
              value={dateTo}
              aria-label="Ordered to"
              onChange={(event) => resetTo(() => setDateTo(event.target.value))}
            />
          </>
        }
        empty={{
          title: 'No orders in this state',
          text: 'Switch tabs or clear the supplier and date filters.',
        }}
      />
    </>
  );
}
