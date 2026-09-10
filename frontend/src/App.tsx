import { useEffect, useState } from "react";
import "./theme.css";
import "./App.css";
import { Header } from "./components/Header";
import { TabNav } from "./components/TabNav";
import { SectionHeading } from "./components/SectionHeading";
import { OverviewCard } from "./components/OverviewCard";
import { FeatureComponentBreakdownCard } from "./components/FeatureComponentBreakdownCard";
import { ReporterBreakdownCard } from "./components/ReporterBreakdownCard";
import { PriorityPieChart } from "./components/PriorityPieChart";
import { ResolutionByPriorityCard } from "./components/ResolutionByPriorityCard";
import { TicketTable } from "./components/TicketTable";
import { api, ApiError } from "./api";
import { useAuth } from "./hooks/useAuth";
import { useQueryParam } from "./hooks/useQueryParam";
import { useTheme } from "./hooks/useTheme";
import type { DashboardTab, Period, TicketBucket } from "./types";

const TAB_TITLE: Record<DashboardTab, string> = {
  engineering: "Engineering",
  content: "Content",
};
const TAB_COLOR: Record<DashboardTab, string> = {
  engineering: "var(--accent-blue)",
  content: "var(--accent-magenta)",
};
const KNOWN_PERIODS = ["today", "yesterday", "week", "month"];

// Populated by main.py's OAuth exception handlers (?authError=<key>) when
// the /api/auth/google/callback redirect fails -- either a disallowed
// account or a Google-side error (e.g. the People API not being enabled).
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  not_allowed: "That Google account isn't allowed to sign in here.",
  oauth_failed:
    "Sign-in with Google failed on our end. Please try again in a moment, or contact an admin if this keeps happening.",
};

function isDashboardTab(value: string): value is DashboardTab {
  return value === "engineering" || value === "content";
}

function isPeriod(value: string): value is Period {
  return KNOWN_PERIODS.includes(value) || /^custom:\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function App() {
  const [tabParam, setTabParam] = useQueryParam("tab", "engineering");
  const tab: DashboardTab = isDashboardTab(tabParam) ? tabParam : "engineering";
  const [periodParam, setPeriodParam] = useQueryParam("period", "week");
  const period: Period = isPeriod(periodParam) ? periodParam : "week";
  const [theme, toggleTheme] = useTheme();
  const { user, loading: authLoading, logout } = useAuth();
  const [authErrorParam, setAuthErrorParam] = useQueryParam("authError", "", "");
  // Captured once on mount (not re-derived from authErrorParam) so clearing
  // the URL param below doesn't also blank the message the user is reading.
  const [authErrorMessage] = useState<string | null>(() =>
    authErrorParam ? AUTH_ERROR_MESSAGES[authErrorParam] ?? "Sign-in failed. Please try again." : null
  );

  // Clear the flag from the URL once read, so a later refresh/share of this
  // link doesn't keep re-showing a stale error.
  useEffect(() => {
    if (authErrorParam) setAuthErrorParam("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [bucket, setBucket] = useState<TicketBucket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fcParam, setFcParam] = useQueryParam("fc", "", "");
  const activeFeatureComponent = fcParam || null;
  const [priorityParam, setPriorityParam] = useQueryParam("priority", "", "");
  const priorityFilter = priorityParam || null;
  const [reporterParam, setReporterParam] = useQueryParam("reporter", "", "");
  const reporterFilter = reporterParam || null;

  // The whole app is gated behind sign-in -- nothing to fetch until we know
  // who's signed in.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFcParam("");
    setPriorityParam("");
    setReporterParam("");

    const fetchBucket = tab === "engineering" ? api.oncall(period) : api.contentRequests(period);

    fetchBucket
      .then((data) => {
        if (!cancelled) setBucket(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Something went wrong");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, period, user]);

  if (authLoading) {
    return <div className="loading-state">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="wrap">
        <Header
          period={period}
          onPeriodChange={setPeriodParam}
          theme={theme}
          onToggleTheme={toggleTheme}
          user={user}
          onLogout={logout}
          showSignIn={false}
        />
        <div className="signin-gate">
          <img
            className="signin-gate-mark"
            src={theme === "dark" ? "/hackerearth_logo_light.png" : "/hackerearth_logo.png"}
            alt=""
          />
          <h2>Sign in to view TicketSnap</h2>
          <p>Use your HackerEarth Google account to see engineering and content tickets.</p>
          {authErrorMessage && <div className="error-banner signin-gate-error">{authErrorMessage}</div>}
          <a className="signin-btn signin-btn-large" href="/api/auth/google/login">
            <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62Z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18Z"
              />
              <path
                fill="#FBBC05"
                d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33Z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
              />
            </svg>
            Sign in with Google
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <Header
        period={period}
        onPeriodChange={setPeriodParam}
        theme={theme}
        onToggleTheme={toggleTheme}
        user={user}
        onLogout={logout}
      />

      <TabNav active={tab} onChange={setTabParam} />

      <main className="content">
        {error && (
          <div className="error-banner">
            Couldn't load tickets. Try refreshing the page, or ping #eng-oncall if this keeps happening.
            {import.meta.env.DEV && (
              <div className="card-sub" style={{ marginTop: 4 }}>
                {error}
              </div>
            )}
          </div>
        )}

        <SectionHeading title={TAB_TITLE[tab]} color={TAB_COLOR[tab]} />

        <OverviewCard stats={bucket?.stats ?? null} loading={loading} />

        <div className={tab === "engineering" ? "grid cols-2" : undefined} style={{ marginBottom: 14 }}>
          {tab === "engineering" && (
            <FeatureComponentBreakdownCard
              stats={bucket?.stats ?? null}
              loading={loading}
              activeFeatureComponent={activeFeatureComponent}
              onSelect={(label) => setFcParam(activeFeatureComponent === label ? "" : label)}
            />
          )}
          <ReporterBreakdownCard
            stats={bucket?.stats ?? null}
            loading={loading}
            activeReporter={reporterFilter}
            onSelect={(label) => setReporterParam(reporterFilter === label ? "" : label)}
          />
        </div>

        <div className="grid cols-2" style={{ marginBottom: 14 }}>
          <PriorityPieChart
            stats={bucket?.stats ?? null}
            loading={loading}
            activePriority={priorityFilter}
            onSliceClick={(priority) => setPriorityParam(priorityFilter === priority ? "" : priority)}
          />
          <ResolutionByPriorityCard stats={bucket?.stats ?? null} loading={loading} />
        </div>

        <TicketTable
          tickets={bucket?.tickets ?? []}
          featureComponents={bucket?.feature_components ?? []}
          loading={loading}
          activeFeatureComponent={activeFeatureComponent}
          onFeatureComponentChange={(fc) => setFcParam(fc ?? "")}
          priorityFilter={priorityFilter}
          onPriorityFilterChange={(p) => setPriorityParam(p ?? "")}
          reporterFilter={reporterFilter}
          onReporterFilterChange={(r) => setReporterParam(r ?? "")}
        />
      </main>

      <footer className="note">
        <span>Source: HubSpot Support (Slack-reported tickets)</span>
      </footer>
    </div>
  );
}
