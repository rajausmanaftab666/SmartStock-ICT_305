import bcrypt from 'bcrypt';
import type {
  EntityStatus,
  Paginated,
  UserCreateInput,
  UserQuery,
  UserRecord,
  UserUpdateInput,
} from '@shared';
import { badRequest, forbidden, notFound } from '../../types/errors';
import { isCheckViolation, isUniqueViolation } from '../../types/pg';
import { updatePasswordHash } from '../auth/auth.repo';
import * as repo from './users.repo';

const BCRYPT_ROUNDS = 10;
const DUPLICATE_EMAIL = { email: 'That email is already in use' };

export async function list(query: UserQuery): Promise<Paginated<UserRecord>> {
  const { rows, total } = await repo.list(query);
  return { rows, total, page: query.page, limit: query.limit };
}

export async function get(id: number): Promise<UserRecord> {
  const user = await repo.findById(id);
  if (!user) throw notFound('That user does not exist.');
  return user;
}

/**
 * BR18, checked here as well as in the schema and by the table constraint.
 * The schema catches a malformed request; this catches a supplier id that
 * looks fine but does not exist.
 */
async function assertSupplierLink(role: string, supplierId: number | null): Promise<void> {
  if (role === 'supplier') {
    if (!supplierId) {
      throw badRequest('Please correct the highlighted fields.', {
        supplier_id: 'A supplier user must be linked to a supplier company',
      });
    }
    if (!(await repo.supplierExists(supplierId))) {
      throw badRequest('Please correct the highlighted fields.', {
        supplier_id: 'Select a supplier company that exists',
      });
    }
  } else if (supplierId) {
    throw badRequest('Please correct the highlighted fields.', {
      supplier_id: 'Only a supplier user can be linked to a supplier company',
    });
  }
}

function translate(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw badRequest('Please correct the highlighted fields.', DUPLICATE_EMAIL);
  }
  // The BR18 table constraint, if something slipped past both checks above.
  if (isCheckViolation(error, 'users_supplier_link')) {
    throw badRequest('Please correct the highlighted fields.', {
      supplier_id: 'Only a supplier user can be linked to a supplier company (BR18)',
    });
  }
  throw error;
}

export async function create(input: UserCreateInput): Promise<UserRecord> {
  await assertSupplierLink(input.role, input.supplier_id);

  try {
    const id = await repo.insert({
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
      role: input.role,
      supplierId: input.supplier_id,
      status: input.status,
    });
    return await get(id);
  } catch (error) {
    translate(error);
  }
}

export async function update(
  id: number,
  input: UserUpdateInput,
  actingUserId: number
): Promise<UserRecord> {
  const existing = await get(id);
  await assertSupplierLink(input.role, input.supplier_id);

  // Locking yourself out by demoting your own account is a support call.
  if (id === actingUserId && input.role !== existing.role) {
    throw forbidden('You cannot change your own role.');
  }
  if (id === actingUserId && input.status !== 'active') {
    throw forbidden('You cannot deactivate your own account.');
  }

  try {
    await repo.update(id, {
      name: input.name,
      email: input.email,
      role: input.role,
      supplierId: input.supplier_id,
      status: input.status,
    });
  } catch (error) {
    translate(error);
  }

  return get(id);
}

/** BR10 — users are deactivated, never deleted. §6.2 — never yourself. */
export async function setStatus(
  id: number,
  status: EntityStatus,
  actingUserId: number
): Promise<UserRecord> {
  await get(id);
  if (id === actingUserId && status === 'inactive') {
    throw forbidden('You cannot deactivate your own account.');
  }
  await repo.updateStatus(id, status);
  return get(id);
}

/**
 * An administrator sets a new password directly. Email delivery is explicitly
 * out of scope (§1.2), so the new password is handed over in person.
 */
export async function resetPassword(id: number, newPassword: string): Promise<void> {
  await get(id);
  await updatePasswordHash(id, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
}
