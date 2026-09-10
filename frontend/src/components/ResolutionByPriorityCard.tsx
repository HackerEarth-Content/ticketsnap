import type { TicketStats } from "../types";
import { BarList } from "./BarList";
import { formatHours } from "../format";
import { PRIORITY_ORDER, priorityDisplay } from "../priority";

// Ordinal ramp -- the point is severity order, not the sorted value.
// Ordered to match PRIORITY_ORDER (Urgent first), most-intense hue first.
const ORDINAL_RAMP = ["var(--ord-5)", "var(--ord-4)", "var(--ord-2)", "var(--ord-1)"];

// Below this many resolved tickets, a median is just 1-2 raw values -- one
// old backlog ticket closing alongside a same-day one can swing it by days.
// Flag it instead of presenting it as a stable trend.
const LOW_SAMPLE_THRESHOLD = 5;

interface Props {
  stats: TicketStats | null;
  loading: boolean;
}

/** Median resolution time by priority for the active tab's bucket --
 * replaces the SLA panel, since ticketsnap has no synced HubSpot SLA field
 * to measure compliance against (see api/dashboard_routes.py). */
export function ResolutionByPriorityCard({ stats, loading }: Props) {
  const byPriority = stats?.resolved_median_hours_by_priority ?? {};
  const countByPriority = stats?.resolved_count_by_priority ?? {};
  const items = PRIORITY_ORDER.filter((p) => p in byPriority).map((p, i) => ({
    label: p,
    displayLabel: priorityDisplay(p),
    value: byPriority[p],
    color: ORDINAL_RAMP[i],
    displayValue: formatHours(byPriority[p]),
  }));

  const lowSample = items.filter((i) => (countByPriority[i.label] ?? 0) < LOW_SAMPLE_THRESHOLD);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Median resolution time, by priority</div>
          <div className="card-sub">Ordered by severity, not by value</div>
        </div>
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 120, width: "100%" }} />
      ) : items.length === 0 ? (
        <div className="card-sub">No resolved tickets with a known priority in this period.</div>
      ) : (
        <>
          <BarList items={items} />
          {lowSample.length > 0 && (
            <div className="card-sub" style={{ marginTop: 12 }}>
              Note: {lowSample.map((i) => `${i.displayLabel} (${countByPriority[i.label] ?? 0} resolved)`).join(", ")}{" "}
              — too few tickets this period for the median to be a reliable signal.
            </div>
          )}
        </>
      )}
    </div>
  );
}
