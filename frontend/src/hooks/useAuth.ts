import { useCallback, useEffect, useState } from "react";
import { authApi } from "../api";
import type { CurrentUser } from "../types";

interface State {
  user: CurrentUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

export function useAuth(): State {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.me().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  return { user, loading, logout };
}
