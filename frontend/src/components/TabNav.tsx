import type { DashboardTab } from "../types";

// Oncall and Engineering Issues are the same query server-side (see
// api/dashboard_routes.py) -- one "Engineering" tab covers both.
// ponytail: Content tab disabled per request; the /content-requests API route
// still exists server-side, just nothing links to it here.
const TABS: { key: DashboardTab; label: string }[] = [{ key: "engineering", label: "Engineering" }];

interface Props {
  active: DashboardTab;
  onChange: (tab: DashboardTab) => void;
}

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
