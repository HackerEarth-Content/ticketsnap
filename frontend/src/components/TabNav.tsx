import type { DashboardTab } from "../types";

// Oncall and Engineering Issues are the same query server-side (see
// api/dashboard_routes.py) -- one "Engineering" tab covers both.
const TABS: { key: DashboardTab; label: string }[] = [
  { key: "engineering", label: "Engineering" },
  { key: "content", label: "Content" },
];

interface Props {
  active: DashboardTab;
  onChange: (tab: DashboardTab) => void;
}

/** The whole app is sign-in gated (see App.tsx), so there's no auth-gated
 * tab to drop from the nav anymore -- both tabs always render. */
export function TabNav({ active, onChange }: Props) {
  return (
    <nav className="tab-nav" role="tablist" aria-label="Ticket buckets">
      {TABS.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          className={`tab-nav-item ${active === t.key ? "active" : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
