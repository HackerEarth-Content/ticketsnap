import { useMemo } from "react";
import type { Ticket } from "../types";
import { PRIORITY_ORDER, priorityChip, priorityDisplay } from "../priority";
import { useQueryNumberParam, useQueryParam } from "../hooks/useQueryParam";
import { hubspotTicketUrl } from "../format";

const ALL = "all";
const PENDING = "Pending";
const CLOSED = "Closed";
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Every non-Closed HubSpot stage ("Pending in engineering", "Pending on
// teams", etc.) reads as one "Pending" bucket in this table.
function displayStatus(canonicalStatus: string): string {
  return canonicalStatus === CLOSED ? CLOSED : PENDING;
}

// slack_thread_url comes from HubSpot's "Slack Link" property -- reject
// anything but an https Slack link before it reaches an href (blocks
// javascript: URIs and similar).
function safeSlackUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
    const isSlackHost = host === "slack.com" || host.endsWith(".slack.com");
    return parsed.protocol === "https:" && isSlackHost ? url : null;
  } catch {
    return null;
  }
}

interface Props {
  tickets: Ticket[];
  featureComponents: string[];
  loading: boolean;
  activeFeatureComponent: string | null;
  onFeatureComponentChange: (fc: string | null) => void;
  priorityFilter: string | null;
  onPriorityFilterChange: (p: string | null) => void;
  reporterFilter: string | null;
  onReporterFilterChange: (r: string | null) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export function TicketTable({
  tickets,
  featureComponents,
  loading,
  activeFeatureComponent,
  onFeatureComponentChange,
  priorityFilter,
  onPriorityFilterChange,
  reporterFilter,
  onReporterFilterChange,
}: Props) {
  const [statusFilter, setStatusFilter] = useQueryParam("status", PENDING);
  const [perPage, setPerPage] = useQueryNumberParam("perPage", 25);
  const [page, setPage] = useQueryNumberParam("page", 1);

  const statusOptions = useMemo(
    () => Array.from(new Set(tickets.map((t) => displayStatus(t.canonical_status)))).sort(),
    [tickets]
  );
  const priorityOptions = useMemo(() => {
    const present = new Set(tickets.map((t) => t.priority ?? "Unknown"));
    const known = PRIORITY_ORDER.filter((p) => present.has(p));
    const other = Array.from(present).filter((p) => !PRIORITY_ORDER.includes(p)).sort();
    return [...known, ...other];
  }, [tickets]);
  const reporterOptions = useMemo(
    () => Array.from(new Set(tickets.map((t) => t.reporter_name ?? "Unknown"))).sort(),
    [tickets]
  );

  const filtered = useMemo(
    () =>
      tickets.filter(
        (t) =>
          (!activeFeatureComponent || t.feature_component === activeFeatureComponent) &&
          (statusFilter === ALL || displayStatus(t.canonical_status) === statusFilter) &&
          (!priorityFilter || (t.priority ?? "Unknown") === priorityFilter) &&
          (!reporterFilter || (t.reporter_name ?? "Unknown") === reporterFilter)
      ),
    [tickets, activeFeatureComponent, statusFilter, priorityFilter, reporterFilter]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  if (loading) {
    return <div className="loading-state">Loading tickets…</div>;
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Tickets</div>
          <div className="card-sub">
            {filtered.length} of {tickets.length} in this bucket
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
        <label className="field-label">
          <span>Product area</span>
          <select
            className="select"
            value={activeFeatureComponent ?? ALL}
            onChange={(e) => {
              onFeatureComponentChange(e.target.value === ALL ? null : e.target.value);
              setPage(1);
            }}
          >
            <option value={ALL}>All product areas</option>
            {featureComponents.map((fc) => (
              <option key={fc} value={fc}>
                {fc}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          <span>Status</span>
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value={ALL}>All statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          <span>Priority</span>
          <select
            className="select"
            value={priorityFilter ?? ALL}
            onChange={(e) => {
              onPriorityFilterChange(e.target.value === ALL ? null : e.target.value);
              setPage(1);
            }}
          >
            <option value={ALL}>All priorities</option>
            {priorityOptions.map((p) => (
              <option key={p} value={p}>
                {priorityDisplay(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          <span>Reporter</span>
          <select
            className="select"
            value={reporterFilter ?? ALL}
            onChange={(e) => {
              onReporterFilterChange(e.target.value === ALL ? null : e.target.value);
              setPage(1);
            }}
          >
            <option value={ALL}>All reporters</option>
            {reporterOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          <span>Per page</span>
          <select
            className="select"
            value={perPage}
            onChange={(e) => {
              setPerPage(Number(e.target.value));
              setPage(1);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </label>
      </div>

      {pageRows.length === 0 ? (
        <div className="empty-state">No tickets match the current filters.</div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Issue</th>
                <th>Date reported</th>
                <th>Closed date</th>
                <th>Reporter</th>
                <th>Product area</th>
                <th>Status</th>
                <th>Slack thread</th>
                <th>Priority</th>
                <th># days open</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((t) => (
                <tr key={t.ticket_id}>
                  <td className="name-cell" title={t.content ?? undefined}>
                    <a href={hubspotTicketUrl(t.ticket_id)} target="_blank" rel="noopener noreferrer">
                      {t.subject || t.ticket_id}
                    </a>
                    <div className="card-sub">#{t.ticket_id}</div>
                  </td>
                  <td>{formatDate(t.created_at)}</td>
                  <td>{formatDate(t.closed_at)}</td>
                  <td>{t.reporter_name ?? "—"}</td>
                  <td>{t.feature_component ?? "—"}</td>
                  <td>{displayStatus(t.canonical_status)}</td>
                  <td>
                    {safeSlackUrl(t.slack_thread_url) ? (
                      <a href={safeSlackUrl(t.slack_thread_url)!} target="_blank" rel="noopener noreferrer">
                        Slack issue
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <span className={`chip ${priorityChip(t.priority)}`}>{priorityDisplay(t.priority)}</span>
                  </td>
                  <td>{t.days_open ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        className="card-sub"
        style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", marginTop: 8 }}
      >
        <span>
          Page {currentPage} of {totalPages} &middot; {filtered.length} ticket{filtered.length === 1 ? "" : "s"}
        </span>
        <span style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="icon-btn"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            ← Prev
          </button>
          <button
            type="button"
            className="icon-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next →
          </button>
        </span>
      </div>
    </div>
  );
}
