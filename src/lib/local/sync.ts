/**
 * Background push of local sessions to the server. Safe to call often: runs are
 * de-duplicated, failures just leave rows dirty for the next attempt.
 */
import { dirtySessions, getSession, markSynced, saveLocalSession, type LocalSession } from "./db";

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

const PULL_KEY = "sinew.lastPull";

/**
 * Bring in sessions saved from other devices. Unsynced local edits are never overwritten. Resolves to the number of sessions stored.
 */
export async function pullSessions(opts: { full?: boolean } = {}): Promise<number> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  const since = opts.full ? 0 : Number(localStorage.getItem(PULL_KEY) ?? 0);
  const res = await fetch(`/api/sync/sessions?since=${since}`);
  if (!res.ok) return 0;
  const { sessions } = (await res.json()) as { sessions: (Omit<LocalSession, "dirty">)[] };
  let stored = 0;
  let newest = since;
  for (const s of sessions) {
    newest = Math.max(newest, s.updatedAt);
    const local = await getSession(s.id);
    // Never overwrite unsynced local edits. Otherwise the server copy wins when it differs: a synced
    // local row means the server already has our last edit, so a different copy is a newer one
    // (an undone import, a restore), whatever the device clock says.
    if (local && (local.dirty === 1 || (local.updatedAt === s.updatedAt && !!local.deletedAt === !!s.deletedAt))) continue;
    await saveLocalSession({ ...s, dirty: 0 });
    stored++;
  }
  localStorage.setItem(PULL_KEY, String(Math.max(newest, Number(localStorage.getItem(PULL_KEY) ?? 0))));
  return stored;
}
