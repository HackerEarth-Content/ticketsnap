import type { CurrentUser, Period, TicketBucket } from "./types";

const BASE = "/dashboard";

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!res.ok) {
    throw new ApiError(`GET ${path} failed: ${res.status} ${res.statusText}`, res.status);
  }
  return res.json() as Promise<T>;
}

async function post<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "POST", credentials: "include" });
  if (!res.ok) {
    throw new ApiError(`POST ${path} failed: ${res.status} ${res.statusText}`, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // "Engineering" tab hits the same bucket the backend's /engineering-issues
  // route serves -- both are the oncall query, gated behind sign-in (see
  // api/dashboard_routes.py); no separate call needed.
  oncall: (period: Period) => get<TicketBucket>(`/oncall?period=${encodeURIComponent(period)}`),
  // Overrides the backend's 10-minute scheduled sync -- runs it immediately.
  syncNow: () => post<{ pulled: number; since_ms: number }>("/sync"),
  syncStatus: () => get<{ last_synced_at: string | null }>("/sync-status"),
};

export { ApiError };

/** Separate from `api` -- these hit /api/auth and /api/users, not /dashboard. */
export const authApi = {
  me: async (): Promise<CurrentUser | null> => {
    const res = await fetch("/api/users/me", { credentials: "include" });
    return res.ok ? ((await res.json()) as CurrentUser) : null;
  },
  logout: () => fetch("/api/auth/logout", { method: "POST", credentials: "include" }),
};
