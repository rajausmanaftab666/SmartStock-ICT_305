import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PO_STATUS_LABEL, supplierSchema, type SupplierInput } from '@shared';
import { ApiError } from '../../api/client';
import { suppliersApi } from '../../api/suppliers';
import { FormField } from '../../components/FormField';
import { PageHeader } from '../../components/PageHeader';
import { Panel, PanelGrid } from '../../components/Panel';
import { useSettings } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { formatDate, formatMoney } from '../../lib/format';

const BLANK: SupplierInput = {
  name: '',
  contact_person: '',
  email: '',
  phone: '',
  address: '',
  lead_time_days: 7,
  status: 'active',
};

/** S14 — add or edit a supplier. Administrator only (§7.3). */
export function SupplierFormPage() {
  const params = useParams<{ id: string }>();
  const isNew = !params.id;
  const supplierId = params.id ? Number(params.id) : null;

  const navigate = useNavigate();
  const toast = useToast();
  const settings = useSettings();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<SupplierInput>(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const detailQuery = useQuery({
    queryKey: ['suppliers', supplierId],
    queryFn: () => suppliersApi.get(supplierId as number),
    enabled: supplierId !== null,
  });

  // Fill the form once the record arrives.
  useEffect(() => {
    const supplier = detailQuery.data;
    if (!supplier) return;
    setForm({
      name: supplier.name,
      contact_person: supplier.contact_person ?? '',
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
      address: supplier.address ?? '',
      lead_time_days: supplier.lead_time_days,
      status: supplier.status,
    });
  }, [detailQuery.data]);

  const save = useMutation({
    mutationFn: (input: SupplierInput) =>
      isNew ? suppliersApi.create(input) : suppliersApi.update(supplierId as number, input),
    onSuccess: (supplier) => {
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success(isNew ? `${supplier.name} created.` : `${supplier.name} saved.`);
      navigate('/suppliers');
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.fields) setErrors(error.fields);
        toast.error(error.message);
      } else {
        toast.error('Could not save this supplier.');
      }
    },
  });

  function update<K extends keyof SupplierInput>(key: K, value: SupplierInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});

    // The same schema the server enforces — this only saves a round trip.
    const parsed = supplierSchema.safeParse(form);
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

    save.mutate(parsed.data);
  }

  const supplier = detailQuery.data;
  const isLoading = supplierId !== null && detailQuery.isLoading;

  return (
    <>
      <PageHeader
        title={isNew ? 'Add supplier' : supplier ? `Edit ${supplier.name}` : 'Edit supplier'}
        subtitle="Lead time drives the default expected date on purchase orders."
        back={{ label: 'Suppliers', to: '/suppliers' }}
      />

      <form className="form-card" onSubmit={handleSubmit} noValidate>
        <div className="form-card__grid">
          <FormField
            label="Supplier name"
            required
            value={form.name}
            onChange={(value) => update('name', value)}
            placeholder="2–150 characters"
            error={errors.name}
            disabled={isLoading}
          />
          <FormField
            label="Contact person"
            value={form.contact_person ?? ''}
            onChange={(value) => update('contact_person', value)}
            error={errors.contact_person}
            disabled={isLoading}
          />
          <FormField
            label="Email"
            kind="email"
            value={form.email ?? ''}
            onChange={(value) => update('email', value)}
            hint="Valid format if supplied."
            error={errors.email}
            disabled={isLoading}
          />
          <FormField
            label="Phone"
            value={form.phone ?? ''}
            onChange={(value) => update('phone', value)}
            error={errors.phone}
            disabled={isLoading}
          />
          <FormField
            label="Address"
            wide
            value={form.address ?? ''}
            onChange={(value) => update('address', value)}
            error={errors.address}
            disabled={isLoading}
          />
          <FormField
            label="Lead time (days)"
            kind="number"
            value={String(form.lead_time_days)}
            onChange={(value) => update('lead_time_days', value === '' ? 0 : Number(value))}
            hint="Integer 0–365."
            error={errors.lead_time_days}
            disabled={isLoading}
          />
          <FormField
            label="Status"
            kind="select"
            value={form.status}
            onChange={(value) => update('status', value as SupplierInput['status'])}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
            error={errors.status}
            disabled={isLoading}
          />
        </div>

        <div className="form-card__footer">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => navigate('/suppliers')}
            disabled={save.isPending}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={save.isPending || isLoading}>
            {save.isPending ? 'Saving…' : isNew ? 'Create supplier' : 'Save changes'}
          </button>
        </div>
      </form>

      {supplier && (
        <PanelGrid>
          <Panel
            title="Products supplied"
            badge={{
              label: String(supplier.products.length),
              bg: 'var(--info-bg)',
              fg: 'var(--info-fg)',
            }}
            emptyText="No products are sourced from this supplier yet."
            rows={supplier.products.map((product) => ({
              label: product.name,
              value: `${product.quantity_in_stock} ${product.unit}`,
              tone:
                product.status === 'active' && product.quantity_in_stock <= product.min_stock_level
                  ? ('danger' as const)
                  : ('default' as const),
            }))}
          />

          <Panel
            title="Recent orders"
            emptyText="No purchase orders have been raised with this supplier."
            rows={supplier.recent_orders.map((order) => ({
              label: `${order.po_number} · ${PO_STATUS_LABEL[order.status]}`,
              value: (
                <span>
                  {formatMoney(order.total_amount, settings.currency_symbol)}
                  <span className="subtle" style={{ fontWeight: 400 }}>
                    {' '}
                    · {formatDate(order.order_date)}
                  </span>
                </span>
              ),
              tone: 'default' as const,
            }))}
          />
        </PanelGrid>
      )}
    </>
  );
}
