export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
}

export interface Ticket {
  ticket_id: string;
  subject: string;
  created_at: string | null;
  closed_at: string | null;
  customer_name: string | null;
  content: string | null;
  feature_component: string | null;
  reporter_name: string | null;
  canonical_status: string;
  priority: string | null;
  days_open: number | null;
}

export interface TicketStats {
  total: number;
  open_count: number;
  closed_count: number;
  by_feature_component: Record<string, number>;
  by_priority: Record<string, number>;
  by_reporter: Record<string, number>;
  median_resolution_time_hours: number | null;
  resolved_median_hours_by_priority: Record<string, number>;
  resolved_count_by_priority: Record<string, number>;
}

export interface TicketBucket {
  tickets: Ticket[];
  feature_components: string[];
  stats: TicketStats;
}

export type DashboardTab = "engineering" | "content";

// Same period vocabulary as Ticket-Hub's types.ts.
export type Period = "today" | "yesterday" | "week" | "month" | `custom:${string}:${string}`;
