import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsSchemaShape } from './settingsSchema';
import type { AppSettings, Category } from '@shared';
import { ApiError } from '../../api/client';
import { categoriesApi } from '../../api/categories';
import { settingsWriteApi } from '../../api/admin';
import { settingsApi } from '../../api/settings';
import {
  CellActions,
  CellNumber,
  CellText,
  DataTable,
  type Column,
} from '../../components/DataTable';
import { FormField } from '../../components/FormField';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { useToast } from '../../hooks/useToast';

type Tab = 'general' | 'categories';

/** S5 — system settings. Two tabs, administrator only. */
export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general');

  return (
    <>
      <PageHeader
        title="System settings"
        subtitle="Values read by the header, report titles, money formatting and PO numbering."
      />

      <div className="form-card__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'general'}
          className={`form-card__tab${tab === 'general' ? ' form-card__tab--active' : ''}`}
          onClick={() => setTab('general')}
        >
          General
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'categories'}
          className={`form-card__tab${tab === 'categories' ? ' form-card__tab--active' : ''}`}
          onClick={() => setTab('categories')}
        >
          Categories
        </button>
      </div>

      {tab === 'general' ? <GeneralTab /> : <CategoriesTab />}
    </>
  );
}

// ---------------------------------------------------------------------------
// General
// ---------------------------------------------------------------------------

function GeneralTab() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const [form, setForm] = useState<AppSettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settingsQuery.data) setForm(settingsQuery.data);
  }, [settingsQuery.data]);

  const save = useMutation({
    mutationFn: (input: AppSettings) => settingsWriteApi.update(input),
    onSuccess: (settings) => {
      // The shell reads the company name and currency from this cache.
      queryClient.setQueryData(['settings'], settings);
      toast.success('Settings saved.');
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.fields) setErrors(error.fields);
        toast.error(error.message);
      } else {
        toast.error('Could not save the settings.');
      }
    },
  });

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setErrors({});

    const parsed = settingsSchemaShape.safeParse(form);
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

    save.mutate(form);
  }

  if (!form) return <div className="card card--pad">Loading…</div>;

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <div className="form-card__grid">
        <FormField
          label="Company name"
          required
          value={form.company_name}
          onChange={(value) => update('company_name', value)}
          hint="Shown in the sidebar, the breadcrumb and report titles."
          error={errors.company_name}
        />
        <FormField
          label="Currency symbol"
          required
          value={form.currency_symbol}
          onChange={(value) => update('currency_symbol', value)}
          hint="Used for every money value in the app."
          error={errors.currency_symbol}
        />
        <FormField
          label="Default minimum stock level"
          kind="number"
          value={String(form.default_min_stock_level)}
          onChange={(value) => update('default_min_stock_level', value === '' ? 0 : Number(value))}
          hint="Pre-fills the add product form."
          error={errors.default_min_stock_level}
        />
        <FormField
          label="Purchase order prefix"
          required
          value={form.po_number_prefix}
          onChange={(value) => update('po_number_prefix', value)}
          hint="PO numbers generate as PO-00042 (BR13). Existing numbers never change."
          error={errors.po_number_prefix}
        />
        <FormField
          label="Low stock banner"
          kind="toggle"
          wide
          value={form.low_stock_banner_enabled}
          onChange={(value) => update('low_stock_banner_enabled', value)}
          toggleLabel={
            form.low_stock_banner_enabled
              ? 'Shown on dashboards when any product is low'
              : 'Hidden'
          }
        />
      </div>

      <div className="form-card__footer">
        <button type="submit" className="btn btn--primary" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

function CategoriesTab() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [error, setError] = useState<string | undefined>();

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['categories'] });
  }

  const save = useMutation({
    mutationFn: () =>
      editing
        ? categoriesApi.update(editing.id, { name, description })
        : categoriesApi.create({ name, description }),
    onSuccess: (category) => {
      refresh();
      toast.success(editing ? `${category.name} renamed.` : `${category.name} added.`);
      setName('');
      setDescription('');
      setEditing(null);
      setError(undefined);
    },
    onError: (apiError) => {
      if (apiError instanceof ApiError) {
        setError(apiError.fields?.name ?? apiError.message);
        toast.error(apiError.message);
      } else {
        toast.error('Could not save the category.');
      }
    },
  });

  const remove = useMutation({
    mutationFn: (category: Category) => categoriesApi.remove(category.id),
    onSuccess: () => {
      refresh();
      toast.success(`${deleting?.name} deleted.`);
      setDeleting(null);
    },
    onError: (apiError) => {
      setDeleting(null);
      // BR12 comes back as a 409 with a message naming the blocking count.
      toast.error(
        apiError instanceof ApiError ? apiError.message : 'Could not delete the category.'
      );
    },
  });

  const columns: Column<Category>[] = [
    { key: 'name', label: 'Name', render: (row) => <CellText value={row.name} strong /> },
    {
      key: 'description',
      label: 'Description',
      render: (row) => <CellText value={row.description ?? '—'} tone="muted" wrap />,
    },
    {
      key: 'product_count',
      label: 'Products',
      align: 'right',
      render: (row) => <CellNumber value={row.product_count} />,
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      render: (row) => (
        <CellActions>
          <button
            type="button"
            className="btn btn--secondary btn--xs"
            onClick={() => {
              setEditing(row);
              setName(row.name);
              setDescription(row.description ?? '');
              setError(undefined);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className="btn btn--danger btn--xs"
            onClick={() => setDeleting(row)}
            title={
              row.product_count > 0
                ? `Used by ${row.product_count} products — cannot be deleted (BR12)`
                : undefined
            }
          >
            Delete
          </button>
        </CellActions>
      ),
    },
  ];

  return (
    <>
      <form
        className="card card--pad category-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) {
            setError('Category name is required');
            return;
          }
          save.mutate();
        }}
      >
        <FormField
          label={editing ? `Rename “${editing.name}”` : 'New category'}
          required
          value={name}
          onChange={(value) => {
            setName(value);
            setError(undefined);
          }}
          placeholder="e.g. Frozen Goods"
          error={error}
        />
        <FormField
          label="Description"
          value={description}
          onChange={setDescription}
          placeholder="Optional"
        />
        <div className="btn-group" style={{ alignSelf: 'end' }}>
          {editing && (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => {
                setEditing(null);
                setName('');
                setDescription('');
                setError(undefined);
              }}
            >
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn--primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : editing ? 'Save name' : 'Add category'}
          </button>
        </div>
      </form>

      <DataTable
        title="Categories"
        columns={columns}
        rows={categoriesQuery.data ?? []}
        rowKey={(row) => row.id}
        total={categoriesQuery.data?.length ?? 0}
        page={1}
        limit={Math.max(categoriesQuery.data?.length ?? 1, 1)}
        onPageChange={() => undefined}
        loading={categoriesQuery.isLoading}
        unit="categories"
        empty={{ title: 'No categories', text: 'Add one above to start classifying products.' }}
      />

      {deleting && (
        <Modal
          title={`Delete “${deleting.name}”?`}
          body={
            deleting.product_count > 0
              ? `${deleting.name} is used by ${deleting.product_count} products. A category in use cannot be deleted (BR12) — move those products first.`
              : 'This category is not used by any product, so it can be removed.'
          }
          confirmLabel="Delete category"
          tone="danger"
          busy={remove.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() => remove.mutate(deleting)}
        />
      )}
    </>
  );
}
