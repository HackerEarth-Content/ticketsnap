import type { TicketStats } from "../types";
import { BarListCard } from "./BarListCard";

// Fixed categorical order -- validated for CVD-safe adjacency, never cycled
// or reassigned by value (same convention as Ticket-Hub's ModuleDistributionCard).
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
  activeFeatureComponent: string | null;
  onSelect: (label: string) => void;
}

export function FeatureComponentBreakdownCard({ stats, loading, activeFeatureComponent, onSelect }: Props) {
  const entries = Object.entries(stats?.by_feature_component ?? {}).sort((a, b) => b[1] - a[1]);
  const items = entries.map(([label, value], i) => ({
    label,
    value,
    color: i < CATEGORICAL_SLOTS.length ? CATEGORICAL_SLOTS[i] : NEUTRAL_COLOR,
  }));

  return (
    <BarListCard
      title="Issues by product area"
      sub="Click a bar to filter the ticket list below"
      items={items}
      loading={loading}
      emptyLabel="No tickets in this bucket yet."
      onItemClick={onSelect}
      activeLabel={activeFeatureComponent}
      maxHeight={280}
    />
  );
}
