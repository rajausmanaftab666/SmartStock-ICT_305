import { useState, type FormEvent } from 'react';
import { ROLE_LABEL, changePasswordSchema } from '@shared';
import { ApiError } from '../../api/client';
import { authApi } from '../../api/auth';
import { useCurrentUser } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { FormField } from '../../components/FormField';
import { PageHeader } from '../../components/PageHeader';

/**
 * S23 — profile. Name and email are an administrator's to change; the only
 * thing a user can change about themselves is their own password.
 */
export function ProfilePage() {
  const user = useCurrentUser();
  const toast = useToast();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});

    const payload = {
      current_password: current,
      new_password: next,
      confirm_password: confirm,
    };

    const parsed = changePasswordSchema.safeParse(payload);
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

    setSaving(true);
    try {
      await authApi.changePassword(payload);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success('Password changed.');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fields) setErrors(error.fields);
        toast.error(error.message);
      } else {
        toast.error('Something went wrong. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Profile"
        subtitle="Name and email are managed by an administrator. Change your own password here."
      />

      <form className="form-card" onSubmit={handleSubmit} noValidate>
        <div className="form-card__grid">
          <FormField label="Name" value={user.name} onChange={() => undefined} readOnly />
          <FormField label="Email" value={user.email} onChange={() => undefined} readOnly />
          <FormField
            label="Role"
            value={ROLE_LABEL[user.role]}
            onChange={() => undefined}
            readOnly
            wide
            hint={
              user.supplier_name
                ? `Linked to ${user.supplier_name}. You only ever see orders addressed to your own company.`
                : undefined
            }
          />
          <FormField
            label="Current password"
            kind="password"
            required
            value={current}
            onChange={setCurrent}
            error={errors.current_password}
            autoComplete="current-password"
            wide
          />
          <FormField
            label="New password"
            kind="password"
            required
            value={next}
            onChange={setNext}
            hint="Minimum 8 characters."
            error={errors.new_password}
            autoComplete="new-password"
          />
          <FormField
            label="Confirm new password"
            kind="password"
            required
            value={confirm}
            onChange={setConfirm}
            error={errors.confirm_password}
            autoComplete="new-password"
          />
        </div>

        <div className="form-card__footer">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </form>
    </>
  );
}
