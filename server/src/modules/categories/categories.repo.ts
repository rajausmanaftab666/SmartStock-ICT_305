import type { Category } from '@shared';
import { pool, type Queryable } from '../../config/db';

/**
 * Every category carries its product count: the list screen shows it, and it
 * is what BR12 is decided on.
 */
const SELECT_CATEGORY = `
  SELECT c.id,
         c.name,
         c.description,
         (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id) AS product_count
    FROM categories c
`;

export async function findAll(db: Queryable = pool): Promise<Category[]> {
  const result = await db.query<Category>(`${SELECT_CATEGORY} ORDER BY c.name`);
  return result.rows;
}

export async function findById(id: number, db: Queryable = pool): Promise<Category | null> {
  const result = await db.query<Category>(`${SELECT_CATEGORY} WHERE c.id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function insert(
  input: { name: string; description: string | null },
  db: Queryable = pool
): Promise<number> {
  const result = await db.query<{ id: number }>(
    `INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING id`,
    [input.name, input.description]
  );
  return result.rows[0].id;
}

export async function update(
  id: number,
  input: { name: string; description: string | null },
  db: Queryable = pool
): Promise<boolean> {
  const result = await db.query(
    `UPDATE categories SET name = $2, description = $3 WHERE id = $1`,
    [id, input.name, input.description]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function remove(id: number, db: Queryable = pool): Promise<boolean> {
  const result = await db.query(`DELETE FROM categories WHERE id = $1`, [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function countProductsUsing(id: number, db: Queryable = pool): Promise<number> {
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM products WHERE category_id = $1`,
    [id]
  );
  return result.rows[0].count;
}
