import type { TicketStats } from "../types";
import { formatHours, formatNumber } from "../format";
import { StatTile, StatTileSkeleton } from "./StatTile";

interface Props {
  stats: TicketStats | null;
  loading: boolean;
}

/** Headline numbers for the active tab -- total/open/closed plus the overall
 * median resolution time, same at-a-glance stat-strip pattern Ticket-Hub
 * uses for its overview and Slack-issues cards. */
export function OverviewCard({ stats, loading }: Props) {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <div>
          <div className="card-title">Issues at a glance</div>
          <div className="card-sub">All tickets in this bucket for the selected period</div>
        </div>
      </div>
      <div className="stat-strip">
        {loading || !stats ? (
          Array.from({ length: 4 }).map((_, i) => <StatTileSkeleton key={i} />)
        ) : (
          <>
            <StatTile label="Total issues" value={formatNumber(stats.total)} />
            <StatTile label="Open" value={formatNumber(stats.open_count)} />
            <StatTile label="Closed" value={formatNumber(stats.closed_count)} />
            <StatTile
              label="Median resolution"
              value={formatHours(stats.median_resolution_time_hours)}
              foot="across resolved tickets"
            />
          </>
        )}
      </div>
    </div>
  );
}
