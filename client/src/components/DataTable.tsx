import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  /** Sortable columns send `sort` and `direction` to the API. */
  sortable?: boolean;
  width?: string;
  render: (row: T) => ReactNode;
}

export interface SortState {
  key: string;
  direction: 'asc' | 'desc';
}

export interface TabOption {
  value: string;
  label: string;
}

interface DataTableProps<T> {
  title?: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;

  /** Paging, sorting and filtering are the server's job — never a client slice. */
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;

  loading?: boolean;
  onRowClick?: (row: T) => void;
  /** Rows that should carry the low-stock tint. */
  rowTinted?: (row: T) => boolean;

  search?: { value: string; onChange: (value: string) => void; placeholder?: string };
  filters?: ReactNode;
  tabs?: { value: string; options: TabOption[]; onChange: (value: string) => void };

  empty?: { title: string; text: string };
  /** Plural noun for the footer, e.g. "suppliers". */
  unit?: string;
}

export function DataTable<T>({
  title,
  columns,
  rows,
  rowKey,
  total,
  page,
  limit,
  onPageChange,
  sort,
  onSortChange,
  loading = false,
  onRowClick,
  rowTinted,
  search,
  filters,
  tabs,
  empty,
  unit = 'rows',
}: DataTableProps<T>) {
  const hasToolbar = Boolean(title || search || filters || tabs);
  const isEmpty = !loading && rows.length === 0;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const lastPage = Math.max(1, Math.ceil(total / limit));

  function toggleSort(column: Column<T>) {
    if (!column.sortable || !onSortChange) return;
    const isCurrent = sort?.key === column.key;
    onSortChange({
      key: column.key,
      direction: isCurrent && sort?.direction === 'asc' ? 'desc' : 'asc',
    });
  }

  return (
    <div className="table-card">
      {hasToolbar && (
        <div className="table-card__toolbar">
          {title && <span className="card-title table-card__title">{title}</span>}

          {search && (
            <input
              className="input input--sm table-card__search"
              type="search"
              value={search.value}
              placeholder={search.placeholder ?? 'Search…'}
              onChange={(event) => search.onChange(event.target.value)}
              aria-label={search.placeholder ?? 'Search'}
            />
          )}

          {filters}

          <span className="spacer" />

          {tabs && (
            <div className="table-card__tabs">
              {tabs.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`pill${tabs.value === option.value ? ' pill--active' : ''}`}
                  onClick={() => tabs.onChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="table-card__scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => {
                const isSorted = sort?.key === column.key;
                return (
                  <th
                    key={column.key}
                    style={{ textAlign: column.align ?? 'left', width: column.width }}
                    className={column.sortable ? 'is-sortable' : undefined}
                    aria-sort={
                      isSorted ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                    onClick={() => toggleSort(column)}
                  >
                    {column.label}
                    {isSorted && <span aria-hidden="true">{sort?.direction === 'asc' ? ' ↑' : ' ↓'}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows columns={columns.length} />}

            {!loading &&
              rows.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  className={`${onRowClick ? 'is-clickable' : ''}${rowTinted?.(row) ? ' is-tinted' : ''}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key} style={{ textAlign: column.align ?? 'left' }}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {isEmpty && (
        <div className="empty">
          <span className="empty__glyph" aria-hidden="true">
            —
          </span>
          <span className="empty__title">{empty?.title ?? 'Nothing here yet'}</span>
          <span className="empty__text">{empty?.text ?? ''}</span>
        </div>
      )}

      <div className="table-card__footer">
        <span className="table-card__count">
          {loading
            ? 'Loading…'
            : total === 0
              ? `No ${unit}`
              : `Showing ${from}–${to} of ${total} ${unit} · ${limit} per page`}
        </span>
        <button
          type="button"
          className="btn btn--secondary btn--xs"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--xs"
          disabled={page >= lastPage || loading}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

/** Placeholder rows while a page of data is in flight. */
export function SkeletonRows({ columns, count = 6 }: { columns: number; count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, rowIndex) => (
        <tr key={rowIndex}>
          {Array.from({ length: columns }, (_, cellIndex) => (
            <td key={cellIndex}>
              <span className="skeleton" style={{ width: cellIndex === 0 ? '70%' : '45%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Cell renderers
// ---------------------------------------------------------------------------

interface CellTextProps {
  value: ReactNode;
  /** Small monospace line under the value — SKUs, references. */
  sub?: ReactNode;
  strong?: boolean;
  tone?: 'default' | 'muted' | 'danger' | 'success';
  mono?: boolean;
  wrap?: boolean;
}

const TONE_COLOUR: Record<NonNullable<CellTextProps['tone']>, string> = {
  default: 'var(--text)',
  muted: 'var(--muted)',
  danger: 'var(--danger-fg)',
  success: 'var(--success-fg)',
};

export function CellText({
  value,
  sub,
  strong = false,
  tone = 'default',
  mono = false,
  wrap = false,
}: CellTextProps) {
  return (
    <div className="cell">
      <span
        className={mono ? 'mono' : undefined}
        style={{
          fontWeight: strong ? 500 : 400,
          color: TONE_COLOUR[tone],
          whiteSpace: wrap ? 'normal' : 'nowrap',
        }}
      >
        {value}
      </span>
      {sub && <span className="cell__sub mono">{sub}</span>}
    </div>
  );
}

export function CellNumber({
  value,
  strong = false,
  tone = 'default',
}: {
  value: ReactNode;
  strong?: boolean;
  tone?: NonNullable<CellTextProps['tone']>;
}) {
  return (
    <span
      className="num"
      style={{ fontWeight: strong ? 600 : 400, color: TONE_COLOUR[tone], display: 'block' }}
    >
      {value}
    </span>
  );
}

export function CellActions({ children }: { children: ReactNode }) {
  return (
    <div
      className="cell__actions"
      // Row-level click handlers must not fire when an action is pressed.
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}
