import type { AppSettings } from '@shared';
import type { Queryable } from '../../config/db';
import * as repo from './settings.repo';
import { SETTING_DEFAULTS, type SettingsInput } from './settings.schema';

/**
 * Reads the key/value settings table into the typed object the rest of the app
 * uses. A key missing from the table falls back to its §3.2 default rather than
 * leaving the company name or currency symbol blank.
 */
/** S5 General tab. Administrator only; values are stored back as text. */
export async function updateSettings(
  input: SettingsInput,
  userId: number
): Promise<AppSettings> {
  await repo.upsertMany(
    [
      ['company_name', input.company_name],
      ['currency_symbol', input.currency_symbol],
      ['default_min_stock_level', String(input.default_min_stock_level)],
      ['po_number_prefix', input.po_number_prefix],
      ['low_stock_banner_enabled', String(input.low_stock_banner_enabled)],
    ],
    userId
  );
  return getSettings();
}

export async function getSettings(db?: Queryable): Promise<AppSettings> {
  const rows = await repo.findAll(db);
  const raw: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const row of rows) raw[row.setting_key] = row.setting_value;

  return {
    company_name: raw.company_name,
    currency_symbol: raw.currency_symbol,
    default_min_stock_level: Number.parseInt(raw.default_min_stock_level, 10) || 0,
    po_number_prefix: raw.po_number_prefix,
    low_stock_banner_enabled: raw.low_stock_banner_enabled === 'true',
  };
}
