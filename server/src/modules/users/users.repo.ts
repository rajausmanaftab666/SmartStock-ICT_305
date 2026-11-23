import type { EntityStatus, UserQuery, UserRecord } from '@shared';
import { pool, type Queryable } from '../../config/db';

const SELECT_USER = `
  SELECT u.id, u.name, u.email, u.role, u.supplier_id,
         s.name AS supplier_name, u.status, u.created_at
    FROM users u
    LEFT JOIN suppliers s ON s.id = u.supplier_id
`;

export async function list(
  query: UserQuery,
  db: Queryable = pool
): Promise<{ rows: UserRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.search) {
    values.push(`%${query.search}%`);
    conditions.push(`(u.name ILIKE $${values.length} OR u.email ILIKE $${values.length})`);
  }
  if (query.role) {
    values.push(query.role);
    conditions.push(`u.role = $${values.length}`);
  }
  if (query.status) {
    values.push(query.status);
    conditions.push(`u.status = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const totalResult = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM users u ${where}`,
    values
  );

  const rowsResult = await db.query<UserRecord>(
    `${SELECT_USER} ${where} ORDER BY u.name LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, query.limit, (query.page - 1) * query.limit]
  );

  return { rows: rowsResult.rows, total: totalResult.rows[0].count };
}

export async function findById(id: number, db: Queryable = pool): Promise<UserRecord | null> {
  const result = await db.query<UserRecord>(`${SELECT_USER} WHERE u.id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function insert(
  input: {
    name: string;
    email: string;
    passwordHash: string;
    role: string;
    supplierId: number | null;
    status: EntityStatus;
  },
  db: Queryable = pool
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO users (name, email, password_hash, role, supplier_id, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [input.name, input.email, input.passwordHash, input.role, input.supplierId, input.status]
  );
  return result.rows[0].id;
}

export async function update(
  id: number,
  input: {
    name: string;
    email: string;
    role: string;
    supplierId: number | null;
    status: EntityStatus;
  },
  db: Queryable = pool
): Promise<void> {
  await db.query(
    `UPDATE users SET name = $2, email = $3, role = $4, supplier_id = $5, status = $6 WHERE id = $1`,
    [id, input.name, input.email, input.role, input.supplierId, input.status]
  );
}

export async function updateStatus(
  id: number,
  status: EntityStatus,
  db: Queryable = pool
): Promise<void> {
  await db.query(`UPDATE users SET status = $2 WHERE id = $1`, [id, status]);
}

export async function supplierExists(id: number, db: Queryable = pool): Promise<boolean> {
  const result = await db.query(`SELECT 1 FROM suppliers WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}
