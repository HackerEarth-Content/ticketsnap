export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatPercent(pct: number | null): string {
  return pct === null ? "—" : `${pct.toFixed(1)}%`;
}

export function formatHours(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

// ponytail: same HubSpot portal as Ticket-Hub (both read HackerEarth's
// Support ticket pipeline) -- portal ID is static per-portal, not worth a
// config layer.
const HUBSPOT_PORTAL_ID = 2586902;

/** Direct link to a ticket's record in HubSpot -- 0-5 is HubSpot's object
 * type ID for tickets. */
export function hubspotTicketUrl(ticketId: string): string {
  return `https://app.hubspot.com/contacts/${HUBSPOT_PORTAL_ID}/record/0-5/${ticketId}`;
}

/** Today's calendar date in IST, as YYYY-MM-DD -- matches the backend's
 * period boundaries (resolve_period), which also key off IST. */
export function todayIstDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
