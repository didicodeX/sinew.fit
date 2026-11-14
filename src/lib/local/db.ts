/**
 * Local-first store (IndexedDB via Dexie). A set confirmed at the gym is written here
 * first, then pushed to the server by the sync loop, so a bad connection never loses data.
 * Conflict policy: last-write-wins per session (single user, few devices).
 */
import Dexie, { type Table } from "dexie";
import type { ExerciseDef, IsoDate, LoggedSession } from "@domain/types";

export interface LocalSession extends LoggedSession {
  /** Client clock, ms. Used for last-write-wins. */
  updatedAt: number;
  deletedAt?: number;
  /** 1 while there are local changes not yet acknowledged by the server. */
  dirty: 0 | 1;
  /** Snapshot of the exercises used, so the session screen works fully offline. */
  exerciseDefs: ExerciseDef[];
}

class SinewLocalDb extends Dexie {
  sessions!: Table<LocalSession, string>;

  constructor() {
    super("sinew");
    this.version(1).stores({ sessions: "id, date, dirty, updatedAt", meta: "key" });
    this.version(2).stores({ sessions: "id, date, dirty, updatedAt", meta: null });
  }
}

export const localDb = new SinewLocalDb();

/** Write after every change. Returns the stored copy. */
export async function putSession(
  session: LoggedSession,
  exerciseDefs: ExerciseDef[],
  now = Date.now(),
): Promise<LocalSession> {
  const row: LocalSession = { ...session, exerciseDefs, updatedAt: now, dirty: 1 };
  await localDb.sessions.put(row);
  return row;
}

/** Store a row exactly as given (caller already set updatedAt/dirty). */
export async function saveLocalSession(row: LocalSession): Promise<void> {
  await localDb.sessions.put(row);
}

export function getSession(id: string): Promise<LocalSession | undefined> {
  return localDb.sessions.get(id);
}

/** Today's session on this device, finished or not (one per day). */
export async function sessionForDate(date: IsoDate): Promise<LocalSession | undefined> {
  const rows = await localDb.sessions.where("date").equals(date).toArray();
  return rows.filter((r) => !r.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

/** Sessions before `date`, newest first, for the "last time" hint. */
export async function sessionsBefore(date: IsoDate, limit = 60): Promise<LocalSession[]> {
  return localDb.sessions
    .where("date")
    .below(date)
    .reverse()
    .filter((r) => !r.deletedAt)
    .limit(limit)
    .toArray();
}

export function dirtySessions(): Promise<LocalSession[]> {
  return localDb.sessions.where("dirty").equals(1).toArray();
}

/** Clear the dirty flag only if nothing changed locally since the push started. */
export async function markSynced(id: string, pushedUpdatedAt: number): Promise<void> {
  await localDb.transaction("rw", localDb.sessions, async () => {
    const row = await localDb.sessions.get(id);
    if (row && row.updatedAt === pushedUpdatedAt) await localDb.sessions.update(id, { dirty: 0 });
  });
}
