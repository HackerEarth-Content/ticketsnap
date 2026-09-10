import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } from "recharts";
import type { TicketStats } from "../types";
import { PRIORITY_ORDER, priorityDisplay } from "../priority";

// Ordinal ramp, most-intense hue first -- ordered to match PRIORITY_ORDER
// (Urgent first), same convention as Ticket-Hub's SlackPriorityPieChart.
const ORDINAL_RAMP = ["var(--ord-5)", "var(--ord-4)", "var(--ord-2)", "var(--ord-1)"];

interface Slice {
  name: string;
  displayName: string;
  count: number;
  color: string;
}

function buildSlices(data: Record<string, number>): Slice[] {
  const known = PRIORITY_ORDER.filter((p) => data[p]).map((p, i) => ({
    name: p,
    displayName: priorityDisplay(p),
    count: data[p],
    color: ORDINAL_RAMP[i],
  }));
  const rest = Object.keys(data).filter((p) => !PRIORITY_ORDER.includes(p));
  if (rest.length === 0) return known;
  return [
    ...known,
    {
      name: "Unknown",
      displayName: "Unknown",
      count: rest.reduce((sum, p) => sum + data[p], 0),
      color: "var(--ink-3)",
    },
  ];
}

function SliceTooltip({ active, payload }: { active?: boolean; payload?: { payload: Slice }[] }) {
  if (!active || !payload?.length) return null;
  const slice = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="tt-title">{slice.displayName}</div>
      <div className="tt-row">
        <span className="tt-sw" style={{ background: slice.color }} />
        <strong style={{ color: "var(--ink)" }}>{slice.count}</strong>&nbsp;issues
      </div>
    </div>
  );
}

interface ActiveSliceProps {
  cx: number;
  cy: number;
  innerRadius: number;
  outerRadius: number;
  startAngle: number;
  endAngle: number;
  fill: string;
}

function renderActiveSlice(props: unknown) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props as ActiveSliceProps;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 5}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={4}
      />
    </g>
  );
}

interface Props {
  stats: TicketStats | null;
  loading: boolean;
  activePriority: string | null;
  onSliceClick: (priority: string) => void;
}

/** Distribution of tickets by priority for the active tab's bucket. Slices
 * and legend rows are clickable-to-filter, same as
 * FeatureComponentBreakdownCard's bars -- both charts drill into the same
 * ticket table below, so both should offer the same affordance. */
export function PriorityPieChart({ stats, loading, activePriority, onSliceClick }: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | undefined>(undefined);
  const slices = buildSlices(stats?.by_priority ?? {});
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  const activeIndex = hoverIndex ?? (activePriority ? slices.findIndex((s) => s.name === activePriority) : undefined);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Issues by priority</div>
          <div className="card-sub">Click a slice to filter the ticket list below</div>
        </div>
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 220, width: "100%" }} />
      ) : slices.length === 0 ? (
        <div className="card-sub">No tickets in this bucket yet.</div>
      ) : (
        <>
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={86}
                  paddingAngle={slices.length > 1 ? 2 : 0}
                  cornerRadius={4}
                  isAnimationActive={false}
                  activeIndex={activeIndex}
                  activeShape={renderActiveSlice}
                  onMouseEnter={(_, i) => setHoverIndex(i)}
                  onMouseLeave={() => setHoverIndex(undefined)}
                  onClick={(slice: Slice) => onSliceClick(slice.name)}
                  style={{ cursor: "pointer" }}
                >
                  {slices.map((s) => (
                    <Cell key={s.name} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<SliceTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="pie-legend">
            {slices.map((s, i) => (
              <div
                className={`pie-legend-row ${activeIndex === i ? "active" : ""}`}
                key={s.name}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(undefined)}
                onClick={() => onSliceClick(s.name)}
                style={{ cursor: "pointer" }}
              >
                <span className="sw" style={{ background: s.color }} />
                <span className="pie-legend-name">{s.displayName}</span>
                <span className="pie-legend-count">{s.count}</span>
                <span className="pie-legend-pct">{total ? Math.round((s.count / total) * 100) : 0}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
