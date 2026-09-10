// Same order the backend sorts by (pipeline/models.py's PRIORITY_ORDER) --
// most severe first, so "URGENT" always leads. Uppercase to match the raw
// hs_ticket_priority values HubSpot actually stores (verified live: LOW,
// MEDIUM, HIGH, URGENT) -- same casing Ticket-Hub's priority.ts uses.
export const PRIORITY_ORDER = ["URGENT", "HIGH", "MEDIUM", "LOW"];

// Priority -> chip severity class (App.css's .chip.*). Unrecognized values
// (including null/"Unknown") fall back to neutral.
export const PRIORITY_CHIP: Record<string, string> = {
  URGENT: "critical",
  HIGH: "serious",
  MEDIUM: "warning",
  LOW: "good",
};

export function priorityChip(p: string | null): string {
  return (p && PRIORITY_CHIP[p]) || "neutral";
}

// Support's P-level equivalent for each priority, shown alongside the name
// since that's the scale the team actually pages on (same convention as
// Ticket-Hub's priority.ts).
export const P_LABEL: Record<string, string> = {
  URGENT: "P0",
  HIGH: "P1",
  MEDIUM: "P2",
  LOW: "P3/P4",
};

export function priorityDisplay(p: string | null): string {
  if (!p) return "Unknown";
  return P_LABEL[p] ? `${p} (${P_LABEL[p]})` : p;
}
