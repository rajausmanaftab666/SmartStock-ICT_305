import { pool, type Queryable } from '../../config/db';

export interface SettingRow {
  setting_key: string;
  setting_value: string;
}

export async function findAll(db: Queryable = pool): Promise<SettingRow[]> {
  const result = await db.query<SettingRow>(
    `SELECT setting_key, setting_value FROM settings ORDER BY setting_key`
  );
  return result.rows;
}

export async function upsertMany(
  entries: Array<[string, string]>,
  userId: number,
  db: Queryable = pool
): Promise<void> {
  for (const [key, value] of entries) {
    await db.query(
      `INSERT INTO settings (setting_key, setting_value, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = EXCLUDED.setting_value,
                     updated_by = EXCLUDED.updated_by,
                     updated_at = NOW()`,
      [key, value, userId]
    );
  }
}
