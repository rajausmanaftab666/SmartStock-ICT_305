import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userCreateSchema, userUpdateSchema, type Role } from '@shared';
import { ApiError } from '../../api/client';
import { usersApi } from '../../api/admin';
import { FormField } from '../../components/FormField';
import { PageHeader } from '../../components/PageHeader';
import { useSuppliers } from '../../hooks/useLookups';
import { useToast } from '../../hooks/useToast';

interface FormState {
  name: string;
  email: string;
  role: Role;
  supplier_id: string;
  status: 'active' | 'inactive';
  password: string;
  confirm_password: string;
}

const BLANK: FormState = {
  name: '',
  email: '',
  role: 'staff',
  supplier_id: '',
  status: 'active',
  password: '',
  confirm_password: '',
};

/** S4 — add or edit a user. The supplier link is BR18 made visible. */
export function UserFormPage() {
  const params = useParams<{ id: string }>();
  const isNew = !params.id;
  const userId = params.id ? Number(params.id) : null;

  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const suppliers = useSuppliers();

  const [form, setForm] = useState<FormState>(BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const userQuery = useQuery({
    queryKey: ['users', userId],
    queryFn: () => usersApi.get(userId as number),
    enabled: userId !== null,
  });

  useEffect(() => {
    const user = userQuery.data;
    if (!user) return;
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      supplier_id: user.supplier_id ? String(user.supplier_id) : '',
      status: user.status,
      password: '',
      confirm_password: '',
    });
  }, [userQuery.data]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        email: form.email,
        role: form.role,
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        status: form.status,
      };
      return isNew
        ? usersApi.create({
            ...payload,
            password: form.password,
            confirm_password: form.confirm_password,
          })
        : usersApi.update(userId as number, payload);
    },
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success(isNew ? `${user.name} created.` : `${user.name} saved.`);
      navigate('/users');
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.fields) setErrors(error.fields);
        toast.error(error.message);
      } else {
        toast.error('Could not save this user.');
      }
    },
  });

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      // BR18 — changing away from the supplier role clears the link, so the
      // form can never submit an impossible combination.
      if (key === 'role' && value !== 'supplier') next.supplier_id = '';
      return next;
    });
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

    const candidate = {
      name: form.name,
      email: form.email,
      role: form.role,
      supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      status: form.status,
      ...(isNew ? { password: form.password, confirm_password: form.confirm_password } : {}),
    };

    const parsed = isNew
      ? userCreateSchema.safeParse(candidate)
      : userUpdateSchema.safeParse(candidate);

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

    save.mutate();
  }

  const isSupplierRole = form.role === 'supplier';
  const isLoading = userId !== null && userQuery.isLoading;

  return (
    <>
      <PageHeader
        title={isNew ? 'Add user' : `Edit ${userQuery.data?.name ?? 'user'}`}
        subtitle="A supplier role must be linked to a supplier company; every other role must not be (BR18)."
        back={{ label: 'Users', to: '/users' }}
      />

      <form className="form-card" onSubmit={handleSubmit} noValidate>
        <div className="form-card__grid">
          <FormField
            label="Name"
            required
            value={form.name}
            onChange={(value) => update('name', value)}
            error={errors.name}
            disabled={isLoading}
          />
          <FormField
            label="Email"
            kind="email"
            required
            value={form.email}
            onChange={(value) => update('email', value)}
            hint="Unique across users."
            error={errors.email}
            disabled={isLoading}
          />
          <FormField
            label="Role"
            kind="select"
            required
            value={form.role}
            onChange={(value) => update('role', value as Role)}
            options={[
              { value: 'admin', label: 'Admin' },
              { value: 'staff', label: 'Staff' },
              { value: 'manager', label: 'Manager' },
              { value: 'supplier', label: 'Supplier' },
            ]}
            error={errors.role}
            disabled={isLoading}
          />
          <FormField
            label="Linked supplier"
            kind="select"
            required={isSupplierRole}
            value={form.supplier_id}
            onChange={(value) => update('supplier_id', value)}
            options={[
              { value: '', label: '— none —' },
              ...(suppliers.data ?? []).map((supplier) => ({
                value: String(supplier.id),
                label: supplier.name,
              })),
            ]}
            hint={
              isSupplierRole
                ? 'Required for a supplier user — they only ever see this company’s orders.'
                : 'Only a supplier user can be linked to a company.'
            }
            hintTone={isSupplierRole ? 'warning' : 'muted'}
            error={errors.supplier_id}
            disabled={isLoading || !isSupplierRole}
          />

          {isNew && (
            <>
              <FormField
                label="Password"
                kind="password"
                required
                value={form.password}
                onChange={(value) => update('password', value)}
                hint="Minimum 8 characters."
                error={errors.password}
              />
              <FormField
                label="Confirm password"
                kind="password"
                required
                value={form.confirm_password}
                onChange={(value) => update('confirm_password', value)}
                error={errors.confirm_password}
              />
            </>
          )}

          <FormField
            label="Status"
            kind="select"
            value={form.status}
            onChange={(value) => update('status', value as 'active' | 'inactive')}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
            hint="An inactive user cannot sign in (BR19)."
            error={errors.status}
            disabled={isLoading}
          />
        </div>

        <div className="form-card__footer">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => navigate('/users')}
            disabled={save.isPending}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={save.isPending || isLoading}>
            {save.isPending ? 'Saving…' : isNew ? 'Create user' : 'Save changes'}
          </button>
        </div>
      </form>
    </>
  );
}
