import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PurchaseOrderInput } from '@shared';
import { ApiError } from '../../api/client';
import { productsApi } from '../../api/products';
import { purchaseOrdersApi } from '../../api/purchaseOrders';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { useSettings } from '../../hooks/useAuth';
import { useSuppliers } from '../../hooks/useLookups';
import { useToast } from '../../hooks/useToast';
import { formatMoney } from '../../lib/format';

interface DraftLine {
  productId: number;
  quantity: string;
}

function isoToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * S15 — create or edit a draft purchase order.
 *
 * The unit price column is read-only: BR14 was amended at sign-off so prices
 * come from the product record and are changed there. The client never sends a
 * price, and the server would ignore one if it did.
 */
export function PurchaseOrderFormPage() {
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isNew = !params.id;
  const orderId = params.id ? Number(params.id) : null;

  const navigate = useNavigate();
  const toast = useToast();
  const settings = useSettings();
  const queryClient = useQueryClient();

  const suppliers = useSuppliers();
  const activeSuppliers = (suppliers.data ?? []).filter((s) => s.status === 'active');

  const [supplierId, setSupplierId] = useState<number>(0);
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [pendingSupplier, setPendingSupplier] = useState<number | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const today = isoToday();

  // Products for the chosen supplier, active only (BR7 + BR10).
  const productsQuery = useQuery({
    queryKey: ['products', 'po-picker', supplierId],
    queryFn: () =>
      productsApi.list({ supplier_id: supplierId, status: 'active', limit: 100, sort: 'name' }),
    enabled: supplierId > 0,
  });
  const products = productsQuery.data?.rows ?? [];

  const orderQuery = useQuery({
    queryKey: ['purchase-orders', orderId],
    queryFn: () => purchaseOrdersApi.get(orderId as number),
    enabled: orderId !== null,
  });

  // Editing an existing draft.
  useEffect(() => {
    const order = orderQuery.data;
    if (!order) return;
    setSupplierId(order.supplier_id);
    setExpectedDate(order.expected_date ?? '');
    setNotes(order.notes ?? '');
    setLines(order.items.map((item) => ({ productId: item.product_id, quantity: String(item.quantity) })));
  }, [orderQuery.data]);

  // Arriving from a low-stock alert: supplier, product and suggested quantity
  // are all pre-filled (§5.8).
  useEffect(() => {
    if (!isNew) return;
    const fromAlert = Number(searchParams.get('supplier'));
    const product = Number(searchParams.get('product'));
    const quantity = searchParams.get('quantity');
    if (!fromAlert) return;

    setSupplierId(fromAlert);
    setNotes('Raised from a low stock alert.');
    if (product) setLines([{ productId: product, quantity: quantity ?? '1' }]);
  }, [isNew, searchParams]);

  const supplier = activeSuppliers.find((candidate) => candidate.id === supplierId);

  // Default expected date is today + this supplier's lead time.
  useEffect(() => {
    if (!isNew || !supplier || expectedDate) return;
    setExpectedDate(addDays(today, supplier.lead_time_days));
  }, [isNew, supplier, expectedDate, today]);

  function priceOf(productId: number): number {
    return products.find((product) => product.id === productId)?.unit_price ?? 0;
  }

  const total = lines.reduce(
    (sum, line) => sum + (Number.parseInt(line.quantity, 10) || 0) * priceOf(line.productId),
    0
  );

  function buildInput(): PurchaseOrderInput {
    return {
      supplier_id: supplierId,
      expected_date: expectedDate,
      notes,
      items: lines
        .filter((line) => line.productId > 0)
        .map((line) => ({
          product_id: line.productId,
          quantity: Number.parseInt(line.quantity, 10) || 0,
        })),
    };
  }

  const save = useMutation({
    mutationFn: (options: { submit: boolean }) => {
      const input = buildInput();
      const saved = isNew
        ? purchaseOrdersApi.create(input)
        : purchaseOrdersApi.update(orderId as number, input);
      return saved.then(async (order) =>
        options.submit ? purchaseOrdersApi.submit(order.id) : order
      );
    },
    onSuccess: (order, options) => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setConfirmingSubmit(false);
      toast.success(
        options.submit
          ? `${order.po_number} submitted for approval. A manager will review it.`
          : `Draft saved as ${order.po_number} · ${formatMoney(order.total_amount, settings.currency_symbol)}.`
      );
      navigate(`/purchase-orders/${order.id}`);
    },
    onError: (error) => {
      setConfirmingSubmit(false);
      if (error instanceof ApiError) {
        if (error.fields) setErrors(error.fields);
        toast.error(error.message);
      } else {
        toast.error('Could not save this order.');
      }
    },
  });

  function requestSupplierChange(nextId: number) {
    if (lines.length > 0 && nextId !== supplierId) {
      setPendingSupplier(nextId);
      return;
    }
    setSupplierId(nextId);
    setExpectedDate('');
  }

  function addLine() {
    const used = new Set(lines.map((line) => line.productId));
    const next = products.find((product) => !used.has(product.id)) ?? products[0];
    if (!next) {
      toast.error('This supplier has no active products.');
      return;
    }
    setLines((current) => [...current, { productId: next.id, quantity: '1' }]);
  }

  function attemptSubmit() {
    const input = buildInput();
    if (input.items.length === 0 || total <= 0) {
      toast.error('A purchase order needs at least one line and a total above zero (BR6).');
      return;
    }
    setConfirmingSubmit(true);
  }

  const isLoading = orderId !== null && orderQuery.isLoading;

  return (
    <>
      <PageHeader
        title={isNew ? 'New purchase order' : `Edit ${orderQuery.data?.po_number ?? 'order'}`}
        subtitle="Lines must belong to the selected supplier (BR7). Unit price comes from the product record and cannot be changed here. Totals recalculate on every change (BR16)."
        back={{ label: 'Purchase orders', to: '/purchase-orders' }}
      />

      <div className="card card--pad po-header">
        <label className="field">
          <span className="field__label">
            Supplier <span className="field__required">*</span>
          </span>
          <select
            className="select"
            value={supplierId || ''}
            disabled={isLoading}
            onChange={(event) => requestSupplierChange(Number(event.target.value))}
          >
            <option value="">Select a supplier…</option>
            {activeSuppliers.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
          <span className="field__hint">
            The product picker is limited to this supplier's active products (BR7).
          </span>
        </label>

        <label className="field">
          <span className="field__label">Order date</span>
          <input className="input input--readonly" value={today} readOnly />
        </label>

        <label className="field">
          <span className="field__label">Expected date</span>
          <input
            type="date"
            className={`input${errors.expected_date ? ' input--error' : ''}`}
            value={expectedDate}
            min={today}
            onChange={(event) => setExpectedDate(event.target.value)}
          />
          {errors.expected_date ? (
            <span className="field__error">{errors.expected_date}</span>
          ) : (
            <span className="field__hint">
              {supplier
                ? `Default: today + ${supplier.lead_time_days} day lead time.`
                : 'Defaults to today plus the supplier lead time.'}
            </span>
          )}
        </label>

        <label className="field field--wide">
          <span className="field__label">Notes</span>
          <input
            className="input"
            value={notes}
            placeholder="Delivery instructions, references…"
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
      </div>

      <div className="table-card">
        <div className="table-card__toolbar">
          <span className="card-title" style={{ flex: 1 }}>
            Line items
          </span>
          <span className="muted" style={{ fontSize: 13 }}>
            {lines.length} {lines.length === 1 ? 'line' : 'lines'}
          </span>
        </div>

        <div className="table-card__scroll">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style={{ textAlign: 'right', width: 110 }}>Qty</th>
                <th style={{ textAlign: 'right', width: 150 }}>
                  Unit price <span style={{ fontWeight: 400, textTransform: 'none' }}>· fixed</span>
                </th>
                <th style={{ textAlign: 'right', width: 130 }}>Line total</th>
                <th style={{ width: 52 }} />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const price = priceOf(line.productId);
                const quantity = Number.parseInt(line.quantity, 10) || 0;
                return (
                  <tr key={index}>
                    <td>
                      <select
                        className="select"
                        value={line.productId || ''}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((candidate, position) =>
                              position === index
                                ? { ...candidate, productId: Number(event.target.value) }
                                : candidate
                            )
                          )
                        }
                      >
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.sku} · {product.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="input input--num"
                        value={line.quantity}
                        onChange={(event) =>
                          setLines((current) =>
                            current.map((candidate, position) =>
                              position === index
                                ? { ...candidate, quantity: event.target.value }
                                : candidate
                            )
                          )
                        }
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="input input--readonly input--num po-price">
                        {formatMoney(price, settings.currency_symbol)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} className="num">
                      <strong>{formatMoney(quantity * price, settings.currency_symbol)}</strong>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="po-remove"
                        title="Remove line"
                        onClick={() =>
                          setLines((current) => current.filter((_, position) => position !== index))
                        }
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="po-footer">
          <button
            type="button"
            className="po-add"
            onClick={addLine}
            disabled={!supplierId || products.length === 0}
          >
            + Add line
          </button>
          <span className="spacer" />
          <div className="po-totals">
            <div className="po-totals__row">
              <span>Lines</span>
              <span>{lines.length}</span>
            </div>
            <div className="po-totals__row po-totals__row--grand">
              <span>Order total</span>
              <span className="num">{formatMoney(total, settings.currency_symbol)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => navigate('/purchase-orders')}
          disabled={save.isPending}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={() => save.mutate({ submit: false })}
          disabled={save.isPending || !supplierId}
        >
          {save.isPending ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={attemptSubmit}
          disabled={save.isPending || !supplierId}
        >
          Submit for approval
        </button>
      </div>

      {pendingSupplier !== null && (
        <Modal
          title="Change supplier?"
          body={`All ${lines.length} ${lines.length === 1 ? 'line' : 'lines'} will be cleared — a line must belong to the order's supplier (BR7).`}
          confirmLabel="Change and clear lines"
          tone="danger"
          onCancel={() => setPendingSupplier(null)}
          onConfirm={() => {
            setSupplierId(pendingSupplier);
            setLines([]);
            setExpectedDate('');
            setPendingSupplier(null);
            toast.success('Supplier changed. Lines cleared.');
          }}
        />
      )}

      {confirmingSubmit && (
        <Modal
          title="Submit for approval?"
          body="The order becomes read-only until a manager approves or rejects it."
          confirmLabel="Submit"
          busy={save.isPending}
          summary={[
            {
              label: supplier?.name ?? 'Supplier',
              value: `${lines.length} lines · ${formatMoney(total, settings.currency_symbol)}`,
            },
          ]}
          onCancel={() => setConfirmingSubmit(false)}
          onConfirm={() => save.mutate({ submit: true })}
        />
      )}
    </>
  );
}
