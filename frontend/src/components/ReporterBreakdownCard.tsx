import type { TicketStats } from "../types";
import { BarListCard } from "./BarListCard";

// Fixed categorical order -- validated for CVD-safe adjacency, never cycled
// or reassigned by value (same convention as FeatureComponentBreakdownCard).
const CATEGORICAL_SLOTS = [
  "var(--accent-blue)",
  "var(--accent-aqua)",
  "var(--accent-yellow)",
  "var(--accent-green)",
  "var(--accent-indigo)",
  "var(--accent-red)",
  "var(--accent-magenta)",
  "var(--accent-orange)",
];
const NEUTRAL_COLOR = "var(--ink-3)";

interface Props {
  stats: TicketStats | null;
  loading: boolean;
  activeReporter: string | null;
  onSelect: (label: string) => void;
}

/** Who reported each ticket -- parsed from the Slack ticket description's
 * "Reported By:" line (see pipeline/models.py's extract_reported_by). Shown
 * on every tab; alongside the product-area breakdown on Engineering, alone
 * on Content (content requests aren't meaningfully split by product area). */
export function ReporterBreakdownCard({ stats, loading, activeReporter, onSelect }: Props) {
  const entries = Object.entries(stats?.by_reporter ?? {}).sort((a, b) => b[1] - a[1]);
  const items = entries.map(([label, value], i) => ({
    label,
    value,
    color: i < CATEGORICAL_SLOTS.length ? CATEGORICAL_SLOTS[i] : NEUTRAL_COLOR,
  }));

  return (
    <BarListCard
      title="Issues by reporter"
      sub="Click a bar to filter the ticket list below"
      items={items}
      loading={loading}
      emptyLabel="No tickets in this bucket yet."
      onItemClick={onSelect}
      activeLabel={activeReporter}
      maxHeight={280}
    />
  );
}
