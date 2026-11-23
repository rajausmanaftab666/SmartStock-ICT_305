import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserRecord } from '@shared';
import { ApiError } from '../../api/client';
import { usersApi } from '../../api/admin';
import { Badge } from '../../components/Badge';
import { CellActions, CellText, DataTable, type Column } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { useCurrentUser } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../lib/format';

const PAGE_SIZE = 20;

type Pending = { kind: 'status' | 'reset'; user: UserRecord } | null;

/** S3 — user management. Administrator only. */
export function UserListPage() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<Pending>(null);
  const [newPassword, setNewPassword] = useState('');

  const listQuery = useQuery({
    queryKey: ['users', { search, role, status, page }],
    queryFn: () =>
      usersApi.list({ search: search || undefined, role, status, page, limit: PAGE_SIZE }),
  });

  const act = useMutation({
    mutationFn: async () => {
      if (!pending) return;
      if (pending.kind === 'status') {
        return usersApi.setStatus(
          pending.user.id,
          pending.user.status === 'active' ? 'inactive' : 'active'
        );
      }
      return usersApi.resetPassword(pending.user.id, newPassword);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      const name = pending?.user.name ?? 'The user';
      const kind = pending?.kind;
      const wasActive = pending?.user.status === 'active';
      setPending(null);
      setNewPassword('');
      toast.success(
        kind === 'reset'
          ? `Password reset for ${name}. Hand it over directly — there is no email delivery.`
          : `${name} ${wasActive ? 'deactivated' : 'reactivated'}.`
      );
    },
    onError: (error) => {
      setPending(null);
      toast.error(error instanceof ApiError ? error.message : 'That action could not be completed.');
    },
  });

  function resetTo(update: () => void) {
    update();
    setPage(1);
  }

  const columns: Column<UserRecord>[] = [
    { key: 'name', label: 'Name', render: (row) => <CellText value={row.name} strong /> },
    { key: 'email', label: 'Email', render: (row) => <CellText value={row.email} tone="muted" /> },
    { key: 'role', label: 'Role', render: (row) => <Badge tone={row.role} /> },
    {
      key: 'supplier_name',
      label: 'Linked supplier',
      render: (row) => <CellText value={row.supplier_name ?? '—'} tone="muted" />,
    },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={row.status} /> },
    {
      key: 'created_at',
      label: 'Created',
      render: (row) => <CellText value={formatDate(row.created_at.slice(0, 10))} tone="muted" />,
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
            onClick={() => navigate(`/users/${row.id}/edit`)}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--xs"
            onClick={() => {
              setNewPassword('');
              setPending({ kind: 'reset', user: row });
            }}
          >
            Reset password
          </button>
          <button
            type="button"
            className={`btn btn--xs ${row.status === 'active' ? 'btn--danger' : 'btn--secondary'}`}
            // §6.2 — an administrator cannot deactivate themselves.
            disabled={row.id === me.id && row.status === 'active'}
            title={
              row.id === me.id && row.status === 'active'
                ? 'You cannot deactivate your own account'
                : undefined
            }
            onClick={() => setPending({ kind: 'status', user: row })}
          >
            {row.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
        </CellActions>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Accounts and roles. Users are deactivated, never deleted (BR10)."
        actions={[{ label: 'Add user', variant: 'primary', onClick: () => navigate('/users/new') }]}
      />

      <DataTable
        title="Accounts"
        columns={columns}
        rows={listQuery.data?.rows ?? []}
        rowKey={(row) => row.id}
        total={listQuery.data?.total ?? 0}
        page={page}
        limit={PAGE_SIZE}
        onPageChange={setPage}
        loading={listQuery.isLoading}
        unit="users"
        search={{
          value: search,
          onChange: (value) => resetTo(() => setSearch(value)),
          placeholder: 'Search name or email',
        }}
        filters={
          <>
            <select
              className="select select--sm"
              style={{ width: 'auto' }}
              value={role}
              aria-label="Role"
              onChange={(event) => resetTo(() => setRole(event.target.value))}
            >
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
              <option value="supplier">Supplier</option>
            </select>
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
          </>
        }
        empty={{ title: 'No users match', text: 'Clear the search or filters.' }}
      />

      {pending?.kind === 'status' && (
        <Modal
          title={
            pending.user.status === 'active'
              ? `Deactivate ${pending.user.name}?`
              : `Reactivate ${pending.user.name}?`
          }
          body={
            pending.user.status === 'active'
              ? `${pending.user.name} will no longer be able to sign in (BR19). The account is kept — users are deactivated, never deleted.`
              : `${pending.user.name} will be able to sign in again.`
          }
          confirmLabel={pending.user.status === 'active' ? 'Deactivate' : 'Activate'}
          tone={pending.user.status === 'active' ? 'danger' : 'primary'}
          busy={act.isPending}
          onCancel={() => setPending(null)}
          onConfirm={() => act.mutate()}
        />
      )}

      {pending?.kind === 'reset' && (
        <Modal
          title="Reset password?"
          body={`A new password will be set for ${pending.user.name}. There is no email delivery in scope — hand it over directly.`}
          confirmLabel="Reset password"
          busy={act.isPending}
          reason={{
            label: 'New password',
            placeholder: 'Minimum 8 characters',
            value: newPassword,
            onChange: setNewPassword,
            error: newPassword && newPassword.length < 8 ? 'At least 8 characters' : undefined,
          }}
          onCancel={() => {
            setPending(null);
            setNewPassword('');
          }}
          onConfirm={() => {
            if (newPassword.length < 8) {
              toast.error('The new password must be at least 8 characters.');
              return;
            }
            act.mutate();
          }}
        />
      )}
    </>
  );
}
