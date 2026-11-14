/**
 * Background push of local sessions to the server. Safe to call often: runs are
 * de-duplicated, failures just leave rows dirty for the next attempt.
 */
import { dirtySessions, markSynced, type LocalSession } from "./db";

const BATCH = 10;
let running: Promise<void> | null = null;

/** Strip device-only fields before sending. */
function toPayload(s: LocalSession) {
  const { dirty: _d, exerciseDefs: _x, rest: _r, lastSet: _l, ...rest } = s;
  return rest;
}

async function pushOnce(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const rows = await dirtySessions();
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await fetch("/api/sync/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessions: batch.map(toPayload) }),
    });
    if (!res.ok) return; // 401 (signed out) or server error: retry later
    const { results } = (await res.json()) as { results: { id: string; status: string }[] };
    for (const r of results) {
      const pushed = batch.find((b) => b.id === r.id);
      // "stale": the server has a newer copy; it wins under last-write-wins
      if (pushed && (r.status === "saved" || r.status === "stale")) await markSynced(r.id, pushed.updatedAt);
      if (r.status === "rejected") console.warn("[sync] session rejected", r);
    }
  }
}

export function pushNow(): Promise<void> {
  if (!running) {
    running = pushOnce()
      .catch(() => {
        // Network error: rows stay dirty
      })
      .finally(() => {
        running = null;
      });
  }
  return running;
}

/** Push on reconnect, when the app is backgrounded, and every 30 s. Returns a cleanup. */
export function startSyncLoop(): () => void {
  const onVisibility = () => {
    if (document.visibilityState === "hidden") void pushNow();
  };
  const onOnline = () => void pushNow();
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisibility);
  const timer = window.setInterval(() => void pushNow(), 30_000);
  void pushNow();
  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisibility);
    window.clearInterval(timer);
  };
}
