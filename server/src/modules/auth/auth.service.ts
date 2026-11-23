import bcrypt from 'bcrypt';
import type { AuthUser } from '@shared';
import { badRequest, unauthorized } from '../../types/errors';
import * as repo from './auth.repo';
import type { AuthUserWithHash } from './auth.repo';

const BCRYPT_ROUNDS = 10;

/**
 * A real hash, compared against when no account matches, so that an unknown
 * email costs the same time as a known one. Computed once at start-up.
 */
const TIMING_EQUALISER_HASH = bcrypt.hashSync('smartstock-timing-equaliser', BCRYPT_ROUNDS);

/**
 * A single message for every failure mode — wrong email, wrong password, or a
 * deactivated account. Distinguishing them would tell an attacker which emails
 * are real (§5.1 step 2).
 */
const GENERIC_LOGIN_FAILURE = 'Invalid email or password.';

function toPublic(user: AuthUserWithHash): AuthUser {
  const { password_hash: _hash, ...rest } = user;
  return rest;
}

/**
 * Verifies credentials. BR19: a deactivated user is refused even when the
 * password is correct.
 */
export async function login(email: string, password: string): Promise<AuthUser> {
  const user = await repo.findByEmail(email);

  if (!user) {
    await bcrypt.compare(password, TIMING_EQUALISER_HASH);
    throw unauthorized(GENERIC_LOGIN_FAILURE);
  }

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) throw unauthorized(GENERIC_LOGIN_FAILURE);

  // BR19 — checked after the password so an inactive account is not revealed
  // by a faster rejection.
  if (user.status !== 'active') throw unauthorized(GENERIC_LOGIN_FAILURE);

  return toPublic(user);
}

/**
 * Re-reads the session's user from the database. Called on every authenticated
 * request, so deactivating a user takes effect immediately rather than when
 * their session happens to expire.
 */
export async function loadActiveUser(userId: number): Promise<AuthUser | null> {
  const user = await repo.findById(userId);
  if (!user || user.status !== 'active') return null;
  return toPublic(user);
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await repo.findById(userId);
  if (!user) throw unauthorized();

  const matches = await bcrypt.compare(currentPassword, user.password_hash);
  if (!matches) {
    throw badRequest('Please correct the highlighted fields.', {
      current_password: 'That is not your current password',
    });
  }

  await repo.updatePasswordHash(userId, await bcrypt.hash(newPassword, BCRYPT_ROUNDS));
}

/** Where each role lands after signing in (§5.1 step 4). */
export function landingPathFor(user: AuthUser): string {
  return user.role === 'supplier' ? '/supplier/orders' : '/dashboard';
}
