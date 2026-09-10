import { useCallback, useState } from "react";

function currentParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

function writeParam(key: string, value: string | null) {
  const params = currentParams();
  if (value === null) params.delete(key);
  else params.set(key, value);
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

/** Mirrors a piece of filter/tab state into a URL query param (via
 * replaceState -- no extra history entries) so a filtered view survives
 * refresh and can be shared as a link, e.g. pasted into Slack.
 * `emptyValue` is the value that removes the param entirely from the URL
 * (usually the "all"/default option), keeping the URL clean at defaults. */
export function useQueryParam(
  key: string,
  defaultValue: string,
  emptyValue: string = defaultValue
): [string, (v: string) => void] {
  const [value, setValue] = useState(() => currentParams().get(key) ?? defaultValue);

  const set = useCallback(
    (next: string) => {
      setValue(next);
      writeParam(key, next === emptyValue ? null : next);
    },
    [key, emptyValue]
  );

  return [value, set];
}

export function useQueryNumberParam(key: string, defaultValue: number): [number, (v: number) => void] {
  const [value, setValue] = useState(() => {
    const raw = currentParams().get(key);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : defaultValue;
  });

  const set = useCallback(
    (next: number) => {
      setValue(next);
      writeParam(key, next === defaultValue ? null : String(next));
    },
    [key, defaultValue]
  );

  return [value, set];
}
