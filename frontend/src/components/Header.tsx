import { useState } from "react";
import type { CurrentUser, Period } from "../types";
import { todayIstDate } from "../format";

const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

function parseCustomRange(period: Period): [string, string] | null {
  if (!period.startsWith("custom:")) return null;
  const [, start, end] = period.split(":");
  return [start, end];
}

interface Props {
  period: Period;
  onPeriodChange: (p: Period) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  user: CurrentUser | null;
  onLogout: () => void;
  /** The full-page sign-in gate already shows the primary CTA -- suppress
   * this duplicate one in the toolbar so signed-out visitors don't see two
   * different-looking "sign in" affordances on the same screen. */
  showSignIn?: boolean;
}

export function Header({
  period,
  onPeriodChange,
  theme,
  onToggleTheme,
  user,
  onLogout,
  showSignIn = true,
}: Props) {
  const customRange = parseCustomRange(period);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(customRange?.[0] ?? "");
  const [draftEnd, setDraftEnd] = useState(customRange?.[1] ?? "");

  function applyCustomRange() {
    if (!draftStart || !draftEnd) return;
    onPeriodChange(`custom:${draftStart}:${draftEnd}`);
    setPickerOpen(false);
  }

  return (
    <header className="top">
      <div className="brand">
        <img
          className="mark"
          src={theme === "dark" ? "/hackerearth_logo_light.png" : "/hackerearth_logo.png"}
          alt="TicketSnap"
        />
        <h1>TicketSnap</h1>
      </div>
      <div className="toolbar">
        <div className="period-group-wrap">
          <div className="period-group" role="group" aria-label="Date range">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                className={period === p.key ? "active" : ""}
                onClick={() => {
                  onPeriodChange(p.key);
                  setPickerOpen(false);
                }}
                aria-pressed={period === p.key}
              >
                {p.label}
              </button>
            ))}
            <button
              className={customRange ? "active" : ""}
              onClick={() => setPickerOpen((o) => !o)}
              aria-pressed={!!customRange}
              aria-expanded={pickerOpen}
            >
              {customRange ? `${customRange[0]} → ${customRange[1]}` : "Custom"}
            </button>
          </div>
          {pickerOpen && (
            <div className="custom-range-picker">
              <input
                type="date"
                value={draftStart}
                max={draftEnd || todayIstDate()}
                onChange={(e) => setDraftStart(e.target.value)}
                aria-label="Range start date"
              />
              <span>to</span>
              <input
                type="date"
                value={draftEnd}
                min={draftStart}
                max={todayIstDate()}
                onChange={(e) => setDraftEnd(e.target.value)}
                aria-label="Range end date"
              />
              <button className="apply-btn" onClick={applyCustomRange} disabled={!draftStart || !draftEnd}>
                Apply
              </button>
            </div>
          )}
        </div>
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? "🌙" : "☀️"}
        </button>
        {user ? (
          <div className="auth-chip">
            <span className="auth-chip-avatar">{(user.name ?? user.email)[0].toUpperCase()}</span>
            <span>{user.name ?? user.email}</span>
            <button className="signout-btn" onClick={onLogout}>
              Sign out
            </button>
          </div>
        ) : (
          showSignIn && (
            <a className="signin-btn" href="/api/auth/google/login">
              <svg width="15" height="15" viewBox="0 0 18 18" aria-hidden="true">
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
              Sign in
            </a>
          )
        )}
      </div>
    </header>
  );
}
