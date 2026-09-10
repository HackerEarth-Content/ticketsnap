import { useState } from "react";
import type { CurrentUser, Period } from "../types";
import { formatRelativeTime, todayIstDate } from "../format";

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
  onSyncNow?: () => void;
  syncing?: boolean;
  lastSyncedAt?: string | null;
}

export function Header({
  period,
  onPeriodChange,
  theme,
  onToggleTheme,
  user,
  onLogout,
  onSyncNow,
  syncing = false,
  lastSyncedAt = null,
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
        {user && (
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
        )}
        {user && onSyncNow && (
          <div className="sync-group">
            {lastSyncedAt && <span className="sync-status">Synced {formatRelativeTime(lastSyncedAt)}</span>}
            <button
              className="icon-btn"
              onClick={onSyncNow}
              disabled={syncing}
              aria-label="Sync tickets now"
              title="Sync tickets now"
            >
              <span className={syncing ? "sync-icon spinning" : "sync-icon"}>⟳</span>
            </button>
          </div>
        )}
        <div className="toolbar-group">
          <button
            className="icon-btn"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>
          {user && (
            <div className="auth-chip">
              <span className="auth-chip-avatar">{(user.name ?? user.email)[0].toUpperCase()}</span>
              <span>{user.name ?? user.email}</span>
              <button className="signout-btn" onClick={onLogout}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
