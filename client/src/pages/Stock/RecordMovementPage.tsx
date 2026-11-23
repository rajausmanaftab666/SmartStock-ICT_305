import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MOVEMENT_REASON_LABEL,
  NOTE_REQUIRED_REASONS,
  movementCreateSchema,
  reasonsForDirection,
  type MovementReason,
  type MovementType,
} from '@shared';
import { ApiError } from '../../api/client';
import { movementsApi } from '../../api/movements';
import { productsApi } from '../../api/products';
import { FormField } from '../../components/FormField';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { useToast } from '../../hooks/useToast';

/**
 * S11 — one manual adjustment.
 *
 * The preview panel is the point of this screen: it shows the resulting
 * balance before anything is committed, and turns red when the result would be
 * negative. Submit is blocked in that state, but the server enforces BR3
 * regardless — this is a courtesy, not the control.
 */
export function RecordMovementPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const preselected = Number(searchParams.get('product')) || 0;

  const [productId, setProductId] = useState(preselected);
  const [type, setType] = useState<MovementType>('OUT');
  const [reason, setReason] = useState<MovementReason>('sale_dispatch');
  const [quantityText, setQuantityText] = useState('1');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  // Only active products can be adjusted.
  const productsQuery = useQuery({
    queryKey: ['products', 'movement-picker'],
    queryFn: () =>
      productsApi.list({ status: 'active', limit: 100, sort: 'name', direction: 'asc' }),
    staleTime: 60_000,
  });

  const products = productsQuery.data?.rows ?? [];
  const product = products.find((candidate) => candidate.id === productId) ?? products[0];

  const quantity = Math.max(0, Number.parseInt(quantityText, 10) || 0);
  const delta = type === 'IN' ? quantity : -quantity;
  const currentBalance = product?.quantity_in_stock ?? 0;
  const nextBalance = currentBalance + delta;
  const noteRequired = NOTE_REQUIRED_REASONS.includes(reason);
  const wouldGoNegative = nextBalance < 0;

  const reasonOptions = useMemo(
    () =>
      reasonsForDirection(type).map((value) => ({
        value,
        label: MOVEMENT_REASON_LABEL[value],
      })),
    [type]
  );

  // Switching direction repopulates the reasons, so keep the selection valid.
  function changeDirection(next: MovementType) {
    setType(next);
    const allowed = reasonsForDirection(next);
    if (!allowed.includes(reason)) setReason(allowed[0]);
    setErrors({});
  }

  const record = useMutation({
    mutationFn: () =>
      movementsApi.create({
        product_id: product!.id,
        type,
        reason,
        quantity,
        reference,
        note,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      setConfirming(false);
      toast.success(
        `Movement recorded. ${result.product.name} is now ${result.balance_after} ${result.product.unit}.`
      );
      navigate(`/products/${result.product.id}`);
    },
    onError: (error) => {
      setConfirming(false);
      if (error instanceof ApiError) {
        if (error.fields) setErrors(error.fields);
        toast.error(error.message);
      } else {
        toast.error('Could not record the movement.');
      }
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});

    if (!product) {
      toast.error('Choose a product first.');
      return;
    }

    const parsed = movementCreateSchema.safeParse({
      product_id: product.id,
      type,
      reason,
      quantity,
      reference,
      note,
    });

    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!found[key]) found[key] = issue.message;
      }
      setErrors(found);
      toast.error('Please correct the highlighted fields.');
      return;
    }

    if (wouldGoNegative) {
      toast.error('Cannot record: the balance would go below zero (BR3).');
      return;
    }

    setConfirming(true);
  }

  // Green above the minimum, amber at or below it, red when negative.
  const previewTone = wouldGoNegative
    ? 'danger'
    : product && nextBalance <= product.min_stock_level
      ? 'warning'
      : 'success';

  const previewMessage = wouldGoNegative
    ? 'Rejected: a movement may never drive stock below zero (BR3).'
    : product && nextBalance <= product.min_stock_level
      ? 'After this movement the product will be at or below its minimum level.'
      : `Balance stays above the minimum level of ${product?.min_stock_level ?? 0}.`;

  return (
    <>
      <PageHeader
        title="Record stock movement"
        subtitle="One transaction: validate, update the balance, insert the ledger row (BR1–BR3)."
        back={{ label: 'Inventory', to: '/products' }}
      />

      <form className="form-card" onSubmit={handleSubmit} noValidate>
        <div className="form-card__grid">
          <FormField
            label="Product"
            kind="select"
            required
            wide
            value={product ? String(product.id) : ''}
            onChange={(value) => setProductId(Number(value))}
            options={products.map((candidate) => ({
              value: String(candidate.id),
              label: `${candidate.sku} · ${candidate.name}`,
            }))}
            hint={
              product
                ? `Current balance: ${product.quantity_in_stock} ${product.unit} · minimum ${product.min_stock_level}`
                : 'Loading the catalogue…'
            }
            error={errors.product_id}
          />

          <FormField
            label="Direction"
            kind="select"
            required
            value={type}
            onChange={(value) => changeDirection(value as MovementType)}
            options={[
              { value: 'IN', label: 'IN — stock increases' },
              { value: 'OUT', label: 'OUT — stock decreases' },
            ]}
            error={errors.type}
          />

          <FormField
            label="Reason"
            kind="select"
            required
            value={reason}
            onChange={(value) => {
              setReason(value as MovementReason);
              setErrors({});
            }}
            options={reasonOptions}
            hint="Options follow the chosen direction."
            error={errors.reason}
          />

          <FormField
            label="Quantity"
            kind="number"
            required
            value={quantityText}
            onChange={setQuantityText}
            hint="Whole number, at least 1."
            error={errors.quantity}
          />

          <FormField
            label="Reference"
            value={reference}
            onChange={setReference}
            placeholder="SO-2291, CNT-07…"
            error={errors.reference}
          />

          <FormField
            label="Note"
            kind="textarea"
            wide
            required={noteRequired}
            value={note}
            onChange={setNote}
            placeholder={noteRequired ? 'Required for this reason' : 'Optional'}
            hint={
              noteRequired
                ? 'Required for count correction, damaged and expired.'
                : undefined
            }
            error={errors.note}
          />
        </div>

        {product && (
          <div className={`preview preview--${previewTone}`}>
            <div className="preview__figure">
              <span className="preview__label">Current</span>
              <span className="preview__value">
                {currentBalance} {product.unit}
              </span>
            </div>
            <span className="preview__arrow" aria-hidden="true">
              →
            </span>
            <div className="preview__figure">
              <span className="preview__label">New balance</span>
              <span className="preview__value preview__value--tone">
                {nextBalance} {product.unit}
              </span>
            </div>
            <span className="spacer" />
            <span className="preview__message">{previewMessage}</span>
          </div>
        )}

        <div className="form-card__footer">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => navigate(-1)}
            disabled={record.isPending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={record.isPending || wouldGoNegative || !product}
          >
            {record.isPending ? 'Recording…' : 'Record movement'}
          </button>
        </div>
      </form>

      {confirming && product && (
        <Modal
          title="Record this movement?"
          body={`${MOVEMENT_REASON_LABEL[reason]} · ${delta > 0 ? '+' : ''}${delta} ${product.unit} on ${product.name}.`}
          confirmLabel="Record movement"
          busy={record.isPending}
          summary={[
            {
              label: product.name,
              value: `${currentBalance} → ${nextBalance} ${product.unit}`,
            },
          ]}
          onCancel={() => setConfirming(false)}
          onConfirm={() => record.mutate()}
        />
      )}
    </>
  );
}
