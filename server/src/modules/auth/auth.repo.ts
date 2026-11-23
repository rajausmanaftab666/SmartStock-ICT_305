import type { AuthUser } from '@shared';
import { queryOne, type Queryable } from '../../config/db';
import { pool } from '../../config/db';

/** The public shape plus the hash, which never leaves this module. */
export interface AuthUserWithHash extends AuthUser {
  password_hash: string;
}

const SELECT_AUTH_USER = `
  SELECT u.id,
         u.name,
         u.email,
         u.role,
         u.supplier_id,
         s.name AS supplier_name,
         u.status,
         u.password_hash
    FROM users u
    LEFT JOIN suppliers s ON s.id = u.supplier_id
`;

export function findByEmail(email: string): Promise<AuthUserWithHash | null> {
  return queryOne<AuthUserWithHash>(`${SELECT_AUTH_USER} WHERE LOWER(u.email) = LOWER($1)`, [email]);
}

export function findById(id: number): Promise<AuthUserWithHash | null> {
  return queryOne<AuthUserWithHash>(`${SELECT_AUTH_USER} WHERE u.id = $1`, [id]);
}

export async function updatePasswordHash(
  id: number,
  passwordHash: string,
  db: Queryable = pool
): Promise<void> {
  await db.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [id, passwordHash]);
}
