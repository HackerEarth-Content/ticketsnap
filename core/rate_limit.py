"""Per-IP sliding-window rate limiter for a handful of sensitive routes
(OAuth login redirect, manual ticket sync trigger).

ponytail: in-memory + single-process -- fine for this app's one uvicorn
worker; resets on restart and won't share state if this ever scales to
multiple replicas behind a load balancer. Swap for Redis if that happens.
"""

from __future__ import annotations

import time
from collections import defaultdict

from fastapi import HTTPException, Request

_hits: dict[str, list[float]] = defaultdict(list)


def rate_limit(max_requests: int, window_seconds: float):
    async def _check(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        key = f"{request.url.path}:{client_ip}"
        now = time.monotonic()
        window = _hits[key]
        while window and window[0] <= now - window_seconds:
            window.pop(0)
        if len(window) >= max_requests:
            raise HTTPException(status_code=429, detail="Too many requests")
        window.append(now)

    return _check
