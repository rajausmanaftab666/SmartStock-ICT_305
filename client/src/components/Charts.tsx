import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_COLOURS } from './statusTone';

/**
 * Chart primitives, bound to the approved palette in §2.
 *
 * A note on colour, because it was checked rather than eyeballed: running the
 * palette through a CVD validator flags `approved` (#0C5CAB) against `shipped`
 * (#7f56d9) at ΔE 7.8 under protanopia — separable for normal vision (15.1) but
 * inside the band where colour alone is not enough. Several fills are also
 * under 3:1 against a white surface.
 *
 * Rather than change a signed-off palette, every chart here carries secondary
 * encoding so colour is never the only channel:
 *   - the donut leaves a 2px surface gap between segments and prints a legend
 *     with the count beside each label;
 *   - bars carry their value as text above the mark;
 *   - the movement trend has two well-separated hues (ΔE 34.9, passes cleanly)
 *     plus a legend;
 *   - every chart sits above or beside the same data as a table.
 */

const AXIS_STYLE = { fontSize: 11, fill: 'var(--muted)' };
const GRID_COLOUR = 'var(--divider)';

function TooltipCard({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string; payload?: unknown }>;
  label?: string | number;
  formatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label !== undefined && <span className="chart-tooltip__label">{label}</span>}
      {payload.map((entry, index) => (
        <span className="chart-tooltip__row" key={index}>
          <span className="chart-tooltip__swatch" style={{ background: entry.color }} />
          <span className="chart-tooltip__name">{entry.name}</span>
          <span className="chart-tooltip__value">
            {formatter ? formatter(Number(entry.value)) : entry.value}
          </span>
        </span>
      ))}
    </div>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  colour: string;
}

/** Orders by status. The legend is the direct label — required, not decorative. */
export function DonutPanel({
  title,
  slices,
  totalLabel,
}: {
  title: string;
  slices: DonutSlice[];
  totalLabel: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className="card card--pad chart-card">
      <span className="card-title">{title}</span>
      <div className="donut">
        <div className="donut__figure">
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="label"
                innerRadius={44}
                outerRadius={70}
                // A 2px surface gap separates adjacent slices geometrically, so
                // the weak approved/shipped hue pair is never colour-alone.
                paddingAngle={2}
                stroke="var(--surface)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {slices.map((slice) => (
                  <Cell key={slice.label} fill={slice.colour} />
                ))}
              </Pie>
              <Tooltip content={<TooltipCard />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut__centre">
            <span className="donut__total">{total}</span>
            <span className="donut__caption">{totalLabel}</span>
          </div>
        </div>

        <ul className="donut__legend">
          {slices.map((slice) => (
            <li key={slice.label}>
              <span className="donut__swatch" style={{ background: slice.colour }} />
              <span className="donut__label">{slice.label}</span>
              <span className="donut__value">{slice.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export interface BarPoint {
  label: string;
  value: number;
}

/** One measure, one hue — identity comes from the axis, not from colour. */
export function BarPanel({
  title,
  note,
  points,
  colour = CHART_COLOURS.primary,
  format,
}: {
  title: string;
  note?: string;
  points: BarPoint[];
  colour?: string;
  format?: (value: number) => string;
}) {
  return (
    <div className="card card--pad chart-card">
      <div className="chart-card__head">
        <span className="card-title">{title}</span>
        {note && <span className="chart-card__note">{note}</span>}
      </div>
      {points.length === 0 ? (
        <span className="field__hint">Nothing to chart in this range.</span>
      ) : (
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={points} margin={{ top: 18, right: 8, bottom: 4, left: 0 }} barCategoryGap="28%">
            <CartesianGrid stroke={GRID_COLOUR} vertical={false} />
            <XAxis dataKey="label" tick={AXIS_STYLE} tickLine={false} axisLine={{ stroke: GRID_COLOUR }} />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={48} />
            <Tooltip cursor={{ fill: 'var(--surface-3)' }} content={<TooltipCard formatter={format} />} />
            <Bar
              dataKey="value"
              name="Value"
              fill={colour}
              radius={[4, 4, 0, 0]}
              maxBarSize={52}
              isAnimationActive={false}
              label={{
                position: 'top',
                fontSize: 11,
                fill: 'var(--text-2)',
                formatter: (value: number) => (format ? format(value) : String(value)),
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export interface TrendPoint {
  label: string;
  in_qty: number;
  out_qty: number;
}

/**
 * Stock in against stock out. Both series are unit counts on one axis — never
 * a second y-scale.
 */
export function TrendPanel({
  title,
  note,
  points,
}: {
  title: string;
  note?: string;
  points: TrendPoint[];
}) {
  return (
    <div className="card card--pad chart-card">
      <div className="chart-card__head">
        <span className="card-title">{title}</span>
        {note && <span className="chart-card__note">{note}</span>}
      </div>

      <div className="chart-legend">
        <span>
          <span className="chart-legend__swatch" style={{ background: CHART_COLOURS.primary }} />
          Stock in
        </span>
        <span>
          <span className="chart-legend__swatch" style={{ background: CHART_COLOURS.warning }} />
          Stock out
        </span>
      </div>

      {points.length === 0 ? (
        <span className="field__hint">No movements in this range.</span>
      ) : (
        <ResponsiveContainer width="100%" height={190}>
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={GRID_COLOUR} vertical={false} />
            <XAxis
              dataKey="label"
              tick={AXIS_STYLE}
              tickLine={false}
              axisLine={{ stroke: GRID_COLOUR }}
              minTickGap={24}
              tickFormatter={(value: string) => value.slice(5)}
            />
            <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} width={40} />
            <Tooltip content={<TooltipCard />} />
            <Line
              type="monotone"
              dataKey="in_qty"
              name="Stock in"
              stroke={CHART_COLOURS.primary}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="out_qty"
              name="Stock out"
              stroke={CHART_COLOURS.warning}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--surface)' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
