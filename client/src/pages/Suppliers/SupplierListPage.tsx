import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Supplier } from '@shared';
import { ApiError } from '../../api/client';
import { suppliersApi } from '../../api/suppliers';
import { Badge } from '../../components/Badge';
import {
  CellActions,
  CellNumber,
  CellText,
  DataTable,
  type Column,
  type SortState,
} from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';

const PAGE_SIZE = 20;

/** S13 — supplier list. Readable by admin, staff and manager; writable by admin. */
export function SupplierListPage() {
  const { is } = useAuth();
  const isAdmin = is('admin');
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: 'name', direction: 'asc' });
  const [pendingToggle, setPendingToggle] = useState<Supplier | null>(null);

  const listQuery = useQuery({
    queryKey: ['suppliers', { search, status, page, sort }],
    queryFn: () =>
      suppliersApi.list({
        search: search || undefined,
        status,
        page,
        limit: PAGE_SIZE,
        sort: sort.key,
        direction: sort.direction,
      }),
  });

  const toggleStatus = useMutation({
    mutationFn: (supplier: Supplier) =>
      suppliersApi.setStatus(supplier.id, supplier.status === 'active' ? 'inactive' : 'active'),
    onSuccess: (updated) => {
      // Re-read from the server rather than patching the cached row.
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setPendingToggle(null);
      toast.success(
        `${updated.name} ${updated.status === 'active' ? 'reactivated' : 'deactivated'}.`
      );
    },
    onError: (error) => {
      setPendingToggle(null);
      toast.error(error instanceof ApiError ? error.message : 'Could not change the status.');
    },
  });

  // Changing a filter must return to the first page, or the user lands on an
  // empty page of a shorter result set.
  function resetTo(update: () => void) {
    update();
    setPage(1);
  }

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      label: 'Supplier',
      sortable: true,
      render: (row) => <CellText value={row.name} strong wrap />,
    },
    {
      key: 'contact_person',
      label: 'Contact',
      render: (row) => <CellText value={row.contact_person ?? '—'} tone="muted" />,
    },
    {
      key: 'email',
      label: 'Email',
      render: (row) => <CellText value={row.email ?? '—'} tone="muted" />,
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (row) => <CellText value={row.phone ?? '—'} tone="muted" />,
    },
    {
      key: 'lead_time_days',
      label: 'Lead time',
      align: 'right',
      sortable: true,
      render: (row) => <CellNumber value={`${row.lead_time_days} d`} />,
    },
    {
      key: 'product_count',
      label: 'Products',
      align: 'right',
      render: (row) => <CellNumber value={row.product_count} />,
    },
    {
      key: 'open_order_count',
      label: 'Open orders',
      align: 'right',
      render: (row) => <CellNumber value={row.open_order_count} />,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => <Badge tone={row.status} />,
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) =>
        isAdmin ? (
          <CellActions>
            <button
              type="button"
              className="btn btn--secondary btn--xs"
              onClick={() => navigate(`/suppliers/${row.id}/edit`)}
            >
              Edit
            </button>
            <button
              type="button"
              className={`btn btn--xs ${row.status === 'active' ? 'btn--danger' : 'btn--secondary'}`}
              onClick={() => setPendingToggle(row)}
            >
              {row.status === 'active' ? 'Deactivate' : 'Activate'}
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
        title="Suppliers"
        subtitle={
          isAdmin
            ? 'Companies you order from, with the lead times that default expected dates on purchase orders.'
            : 'Read-only. Contacts and lead times for the companies you order from — administrators maintain these records.'
        }
        actions={
          isAdmin
            ? [
                {
                  label: 'Add supplier',
                  variant: 'primary',
                  onClick: () => navigate('/suppliers/new'),
                },
              ]
            : []
        }
      />

      <DataTable
        title="Suppliers"
        columns={columns}
        rows={listQuery.data?.rows ?? []}
        rowKey={(row) => row.id}
        total={listQuery.data?.total ?? 0}
        page={page}
        limit={PAGE_SIZE}
        onPageChange={setPage}
        sort={sort}
        onSortChange={(next) => resetTo(() => setSort(next))}
        loading={listQuery.isLoading}
        unit="suppliers"
        search={{
          value: search,
          onChange: (value) => resetTo(() => setSearch(value)),
          placeholder: 'Search name or contact',
        }}
        filters={
          <select
            className="select select--sm"
            style={{ width: 'auto' }}
            value={status}
            aria-label="Status"
            onChange={(event) => resetTo(() => setStatus(event.target.value))}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        }
        empty={{
          title: 'No suppliers match',
          text: 'Clear the search or the status filter to see every company on record.',
        }}
      />

      {pendingToggle && (
        <Modal
          title={
            pendingToggle.status === 'active'
              ? `Deactivate ${pendingToggle.name}?`
              : `Reactivate ${pendingToggle.name}?`
          }
          body={
            pendingToggle.status === 'active'
              ? `${pendingToggle.name} will stop appearing when a new product or purchase order is created. Its ${pendingToggle.product_count} products and its order history stay exactly as they are — suppliers are deactivated, never deleted (BR10).`
              : `${pendingToggle.name} will be offered again when creating products and purchase orders.`
          }
          confirmLabel={pendingToggle.status === 'active' ? 'Deactivate' : 'Activate'}
          tone={pendingToggle.status === 'active' ? 'danger' : 'primary'}
          busy={toggleStatus.isPending}
          onCancel={() => setPendingToggle(null)}
          onConfirm={() => toggleStatus.mutate(pendingToggle)}
        />
      )}
    </>
  );
}
