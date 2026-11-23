import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productCreateSchema, productUpdateSchema, type ProductCreateInput } from '@shared';
import { ApiError } from '../../api/client';
import { productsApi } from '../../api/products';
import { FormField } from '../../components/FormField';
import { PageHeader } from '../../components/PageHeader';
import { useSettings } from '../../hooks/useAuth';
import { useCategories, useSuppliers } from '../../hooks/useLookups';
import { useToast } from '../../hooks/useToast';

/**
 * S8 (add) and S9 (edit) are one form in two modes. The single difference that
 * matters: on edit the quantity is read-only and says so, because BR1 means
 * stock only ever moves through the ledger.
 */
export function ProductFormPage() {
  const params = useParams<{ id: string }>();
  const isNew = !params.id;
  const productId = params.id ? Number(params.id) : null;

  const navigate = useNavigate();
  const toast = useToast();
  const settings = useSettings();
  const queryClient = useQueryClient();

  const categories = useCategories();
  const suppliers = useSuppliers();

  const [form, setForm] = useState<ProductCreateInput>({
    sku: '',
    name: '',
    description: '',
    category_id: 0,
    supplier_id: 0,
    unit: 'pcs',
    unit_price: 0,
    opening_quantity: 0,
    min_stock_level: settings.default_min_stock_level,
    status: 'active',
  });
  const [priceText, setPriceText] = useState('0.00');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const productQuery = useQuery({
    queryKey: ['products', productId],
    queryFn: () => productsApi.get(productId as number),
    enabled: productId !== null,
  });

  const product = productQuery.data;

  useEffect(() => {
    if (!product) return;
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description ?? '',
      category_id: product.category_id,
      supplier_id: product.supplier_id,
      unit: product.unit,
      unit_price: product.unit_price,
      opening_quantity: 0,
      min_stock_level: product.min_stock_level,
      status: product.status,
    });
    setPriceText(product.unit_price.toFixed(2));
  }, [product]);

  // A new product's minimum level is pre-filled from settings (§3.2).
  useEffect(() => {
    if (isNew) {
      setForm((current) => ({ ...current, min_stock_level: settings.default_min_stock_level }));
    }
  }, [isNew, settings.default_min_stock_level]);

  const save = useMutation({
    mutationFn: (input: ProductCreateInput) => {
      if (isNew) return productsApi.create(input);
      const { opening_quantity: _ignored, ...rest } = input;
      return productsApi.update(productId as number, rest);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(
        isNew && form.opening_quantity > 0
          ? `${saved.name} created with an opening balance of ${saved.quantity_in_stock} ${saved.unit}.`
          : isNew
            ? `${saved.name} created.`
            : `${saved.name} saved.`
      );
      navigate(`/products/${saved.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.fields) setErrors(error.fields);
        toast.error(error.message);
      } else {
        toast.error('Could not save this product.');
      }
    },
  });

  function update<K extends keyof ProductCreateInput>(key: K, value: ProductCreateInput[K]) {
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

    const candidate = { ...form, unit_price: priceText };
    const parsed = isNew
      ? productCreateSchema.safeParse(candidate)
      : productUpdateSchema.safeParse(candidate);

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

    save.mutate({ ...form, ...parsed.data } as ProductCreateInput);
  }

  // Inactive suppliers are not offered (BR10), but a product already attached
  // to one keeps showing it rather than silently switching supplier.
  const supplierOptions = (suppliers.data ?? [])
    .filter((supplier) => supplier.status === 'active' || supplier.id === form.supplier_id)
    .map((supplier) => ({
      value: String(supplier.id),
      label: supplier.status === 'active' ? supplier.name : `${supplier.name} (inactive)`,
    }));

  const categoryOptions = (categories.data ?? []).map((category) => ({
    value: String(category.id),
    label: category.name,
  }));

  const isLoading = productId !== null && productQuery.isLoading;

  return (
    <>
      <PageHeader
        title={isNew ? 'Add product' : 'Edit product'}
        subtitle={
          isNew
            ? 'An opening quantity above zero writes an opening_balance movement in the same transaction.'
            : 'Quantity in stock is read-only — it only changes through stock movements (BR1).'
        }
        back={
          isNew
            ? { label: 'Inventory', to: '/products' }
            : { label: product?.name ?? 'product', to: `/products/${productId}` }
        }
      />

      <form className="form-card" onSubmit={handleSubmit} noValidate>
        <div className="form-card__grid">
          <FormField
            label="SKU"
            required
            value={form.sku}
            onChange={(value) => update('sku', value)}
            placeholder="BEV-1005"
            hint="Unique, letters, numbers and dashes."
            error={errors.sku}
            disabled={isLoading}
          />
          <FormField
            label="Product name"
            required
            value={form.name}
            onChange={(value) => update('name', value)}
            placeholder="2–150 characters"
            error={errors.name}
            disabled={isLoading}
          />
          <FormField
            label="Description"
            kind="textarea"
            wide
            value={form.description ?? ''}
            onChange={(value) => update('description', value)}
            placeholder="Optional"
            error={errors.description}
            disabled={isLoading}
          />
          <FormField
            label="Category"
            kind="select"
            required
            value={form.category_id ? String(form.category_id) : ''}
            onChange={(value) => update('category_id', Number(value))}
            options={[{ value: '', label: 'Select a category…' }, ...categoryOptions]}
            error={errors.category_id}
            disabled={isLoading}
          />
          <FormField
            label="Supplier"
            kind="select"
            required
            value={form.supplier_id ? String(form.supplier_id) : ''}
            onChange={(value) => update('supplier_id', Number(value))}
            options={[{ value: '', label: 'Select a supplier…' }, ...supplierOptions]}
            error={errors.supplier_id}
            disabled={isLoading}
          />
          <FormField
            label="Unit"
            required
            value={form.unit}
            onChange={(value) => update('unit', value)}
            hint="case, bottle, sack, drum, roll, box, pcs…"
            error={errors.unit}
            disabled={isLoading}
          />
          <FormField
            label={`Unit price (${settings.currency_symbol})`}
            required
            value={priceText}
            onChange={setPriceText}
            hint="Zero or more, at most two decimal places."
            error={errors.unit_price}
            disabled={isLoading}
          />

          {isNew ? (
            <FormField
              label="Opening quantity"
              kind="number"
              value={String(form.opening_quantity)}
              onChange={(value) => update('opening_quantity', value === '' ? 0 : Number(value))}
              hint="Whole number, zero or more. Above zero writes an opening_balance movement."
              error={errors.opening_quantity}
              disabled={isLoading}
            />
          ) : (
            <FormField
              label="Quantity in stock"
              value={product ? `${product.quantity_in_stock} ${product.unit}` : ''}
              onChange={() => undefined}
              readOnly
              hint="Stock is changed through stock movements and goods receipt."
              hintTone="warning"
            />
          )}

          <FormField
            label="Minimum stock level"
            kind="number"
            value={String(form.min_stock_level)}
            onChange={(value) => update('min_stock_level', value === '' ? 0 : Number(value))}
            hint={isNew ? `Pre-filled from settings (${settings.default_min_stock_level}).` : undefined}
            error={errors.min_stock_level}
            disabled={isLoading}
          />
          <FormField
            label="Status"
            kind="select"
            value={form.status}
            onChange={(value) => update('status', value as ProductCreateInput['status'])}
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
            onClick={() => navigate(isNew ? '/products' : `/products/${productId}`)}
            disabled={save.isPending}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={save.isPending || isLoading}>
            {save.isPending ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}
          </button>
        </div>
      </form>
    </>
  );
}
