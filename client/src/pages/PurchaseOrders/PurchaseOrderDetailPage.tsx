import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PurchaseOrderLine } from '@shared';
import { ApiError } from '../../api/client';
import { purchaseOrdersApi } from '../../api/purchaseOrders';
import { CellNumber, CellText, DataTable, type Column } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { PageHeader, type PageAction } from '../../components/PageHeader';
import { Panel, PanelGrid } from '../../components/Panel';
import { StatusTimeline, buildTimeline } from '../../components/StatusTimeline';
import { toneFor } from '../../components/statusTone';
import { useAuth, useSettings } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { formatDate, formatMoney } from '../../lib/format';

type PendingAction = 'submit' | 'approve' | 'reject' | 'cancel' | 'delete' | 'ship' | null;

/** S17 for staff, admin and managers; S22 reuses it for supplier users. */
export function PurchaseOrderDetailPage({ supplierView = false }: { supplierView?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const settings = useSettings();
  const queryClient = useQueryClient();
  const { is } = useAuth();

  const [pending, setPending] = useState<PendingAction>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>();

  const orderQuery = useQuery({
    queryKey: ['purchase-orders', orderId],
    queryFn: () => purchaseOrdersApi.get(orderId),
  });

  const order = orderQuery.data;
  const backTo = supplierView ? '/supplier/orders' : '/purchase-orders';

  const act = useMutation({
    mutationFn: async (action: Exclude<PendingAction, null>) => {
      switch (action) {
        case 'submit':
          return purchaseOrdersApi.submit(orderId);
        case 'approve':
          return purchaseOrdersApi.approve(orderId);
        case 'reject':
          return purchaseOrdersApi.reject(orderId, reason);
        case 'cancel':
          return purchaseOrdersApi.cancel(orderId);
        case 'ship':
          return purchaseOrdersApi.ship(orderId);
        case 'delete':
          await purchaseOrdersApi.remove(orderId);
          return null;
      }
    },
    onSuccess: (_result, action) => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setPending(null);
      setReason('');
      const messages: Record<string, string> = {
        submit: `${order?.po_number} submitted for approval.`,
        approve: `${order?.po_number} approved and released to ${order?.supplier_name}.`,
        reject: `${order?.po_number} rejected. The reason is recorded on the order.`,
        cancel: `${order?.po_number} cancelled.`,
        ship: `${order?.po_number} marked as shipped.`,
        delete: 'Draft deleted.',
      };
      toast.success(messages[action]);
      if (action === 'delete') navigate(backTo);
    },
    onError: (error) => {
      setPending(null);
      toast.error(error instanceof ApiError ? error.message : 'That action could not be completed.');
    },
  });

  if (orderQuery.isError) {
    const error = orderQuery.error;
    return (
      <>
        <PageHeader title="Purchase order" back={{ label: supplierView ? 'My orders' : 'Purchase orders', to: backTo }} />
        <div className="card card--pad empty">
          <span className="empty__glyph">—</span>
          <span className="empty__title">
            {error instanceof ApiError && error.status === 403
              ? 'You cannot open this order'
              : 'That order could not be loaded'}
          </span>
          <span className="empty__text">
            {error instanceof ApiError ? error.message : 'Please try again.'}
          </span>
        </div>
      </>
    );
  }

  const columns: Column<PurchaseOrderLine>[] = [
    {
      key: 'product_name',
      label: 'Product',
      render: (row) => <CellText value={row.product_name} sub={row.sku} strong wrap />,
    },
    { key: 'unit', label: 'Unit', render: (row) => <CellText value={row.unit} tone="muted" /> },
    {
      key: 'quantity',
      label: 'Ordered',
      align: 'right',
      render: (row) => <CellNumber value={row.quantity} />,
    },
    {
      key: 'received_quantity',
      label: 'Received',
      align: 'right',
      render: (row) => (
        <CellNumber
          value={row.received_quantity}
          strong={row.received_quantity > 0}
          tone={row.received_quantity >= row.quantity ? 'success' : 'muted'}
        />
      ),
    },
    {
      key: 'unit_price',
      label: 'Unit price',
      align: 'right',
      render: (row) => <CellNumber value={formatMoney(row.unit_price, settings.currency_symbol)} />,
    },
    {
      key: 'line_total',
      label: 'Line total',
      align: 'right',
      render: (row) => (
        <CellNumber value={formatMoney(row.line_total, settings.currency_symbol)} strong />
      ),
    },
  ];

  // §7 S17 — the action set is a function of role and status, and nothing else.
  const actions: PageAction[] = [];
  if (order) {
    if (supplierView) {
      if (order.status === 'approved') {
        actions.push({ label: 'Mark as shipped', variant: 'primary', onClick: () => setPending('ship') });
      }
    } else if (is('staff')) {
      if (order.status === 'draft') {
        actions.push(
          { label: 'Edit', variant: 'primary', onClick: () => navigate(`/purchase-orders/${orderId}/edit`) },
          { label: 'Submit for approval', variant: 'secondary', onClick: () => setPending('submit') },
          { label: 'Delete', variant: 'danger', onClick: () => setPending('delete') }
        );
      } else if (order.status === 'pending_approval') {
        actions.push({ label: 'Cancel order', variant: 'danger', onClick: () => setPending('cancel') });
      } else if (['approved', 'shipped', 'partially_received'].includes(order.status)) {
        actions.push({
          label: 'Receive stock',
          variant: 'primary',
          onClick: () => navigate(`/purchase-orders/${orderId}/receive`),
        });
      }
    } else if (is('manager') && order.status === 'pending_approval') {
      actions.push(
        { label: 'Approve', variant: 'primary', onClick: () => setPending('approve') },
        { label: 'Reject', variant: 'danger', onClick: () => setPending('reject') }
      );
    }

    actions.push({ label: 'Print', variant: 'secondary', onClick: () => window.print() });
  }

  return (
    <>
      <PageHeader
        title={order?.po_number ?? 'Purchase order'}
        subtitle={
          order
            ? `${order.supplier_name} · raised by ${order.created_by_name} on ${formatDate(order.order_date)}`
            : undefined
        }
        back={{ label: supplierView ? 'My orders' : 'Purchase orders', to: backTo }}
        actions={actions}
      />

      {order && (
        <PanelGrid>
          <Panel
            title="Supplier"
            badge={{
              label: toneFor(order.status).label,
              bg: toneFor(order.status).bg,
              fg: toneFor(order.status).fg,
            }}
            rows={[
              { label: 'Company', value: order.supplier_name },
              { label: 'Contact', value: order.supplier_contact ?? '—' },
              { label: 'Email', value: order.supplier_email ?? '—', tone: 'muted' },
              { label: 'Lead time', value: `${order.supplier_lead_time_days} days`, tone: 'muted' },
            ]}
          />
          <Panel
            title="Dates"
            rows={[
              { label: 'Order date', value: formatDate(order.order_date) },
              { label: 'Expected date', value: formatDate(order.expected_date) },
              { label: 'Raised by', value: order.created_by_name },
              { label: 'Notes', value: order.notes || '—', tone: 'muted' },
            ]}
          />
          <Panel
            title="Totals"
            rows={[
              { label: 'Lines', value: String(order.line_count) },
              { label: 'Units ordered', value: String(order.units_ordered) },
              { label: 'Units received', value: String(order.units_received) },
              {
                label: 'Order total',
                value: formatMoney(order.total_amount, settings.currency_symbol),
              },
            ]}
          />
          {order.status === 'rejected' && order.rejection_reason && (
            <Panel
              title="Rejection reason"
              badge={{ label: 'Terminal', bg: 'var(--danger-bg)', fg: 'var(--danger-fg)' }}
              rows={[
                { label: 'Reason', value: order.rejection_reason, tone: 'danger' },
                { label: 'Rejected by', value: order.approved_by_name ?? '—', tone: 'muted' },
              ]}
            />
          )}
        </PanelGrid>
      )}

      <DataTable
        title="Line items"
        columns={columns}
        rows={order?.items ?? []}
        rowKey={(row) => row.id}
        total={order?.items.length ?? 0}
        page={1}
        limit={Math.max(order?.items.length ?? 1, 1)}
        onPageChange={() => undefined}
        loading={orderQuery.isLoading}
        unit="lines"
        empty={{
          title: 'No lines yet',
          text: 'A draft needs at least one line and a total above zero before it can be submitted (BR6).',
        }}
      />

      {order && <StatusTimeline steps={buildTimeline(order)} />}

      {order && supplierView && order.shipped_at && (
        <p className="page-subtitle">
          Shipped on {formatDate(order.shipped_at.slice(0, 10))}. No further action is needed from you.
        </p>
      )}

      {pending && order && (
        <Modal
          title={
            {
              submit: 'Submit for approval?',
              approve: `Approve ${order.po_number}?`,
              reject: `Reject ${order.po_number}?`,
              cancel: `Cancel ${order.po_number}?`,
              delete: 'Delete this draft?',
              ship: `Mark ${order.po_number} as shipped?`,
            }[pending]
          }
          body={
            {
              submit: 'The order becomes read-only until a manager approves or rejects it.',
              approve: `Approving releases the order to ${order.supplier_name} and stamps you as the approver. ${formatMoney(order.total_amount, settings.currency_symbol)} across ${order.line_count} lines.`,
              reject: 'A reason is mandatory and stays visible on the order.',
              cancel:
                'Cancelling is terminal. The order stays on record but can no longer be approved or received.',
              delete: `${order.po_number} and its lines will be removed. Only drafts can be deleted (BR5).`,
              ship: 'This tells the buyer the goods have left your warehouse. You cannot undo it, and you have no further action on this order.',
            }[pending]
          }
          confirmLabel={
            {
              submit: 'Submit',
              approve: 'Approve order',
              reject: 'Reject order',
              cancel: 'Cancel order',
              delete: 'Delete draft',
              ship: 'Mark as shipped',
            }[pending]
          }
          tone={['reject', 'cancel', 'delete'].includes(pending) ? 'danger' : 'primary'}
          busy={act.isPending}
          reason={
            pending === 'reject'
              ? {
                  label: 'Rejection reason',
                  placeholder: '5–255 characters',
                  value: reason,
                  onChange: (value) => {
                    setReason(value);
                    setReasonError(undefined);
                  },
                  error: reasonError,
                }
              : undefined
          }
          onCancel={() => {
            setPending(null);
            setReason('');
            setReasonError(undefined);
          }}
          onConfirm={() => {
            if (pending === 'reject' && reason.trim().length < 5) {
              setReasonError('A reason of at least 5 characters is required');
              return;
            }
            act.mutate(pending);
          }}
        />
      )}
    </>
  );
}
