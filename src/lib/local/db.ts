/**
 * Local-first store (IndexedDB via Dexie). A set confirmed at the gym is written here
 * first, then pushed to the server by the sync worker, so a bad connection never loses data.
 * Conflict policy: last-write-wins per session (single user, few devices).
 */
import Dexie, { type Table } from "dexie";
import type { LoggedSession } from "@domain/types";

export interface LocalSession extends LoggedSession {
  /** Client clock, ms. Used for last-write-wins. */
  updatedAt: number;
  deletedAt?: number;
  /** True when there are local changes not yet acknowledged by the server. */
  dirty: 0 | 1;
}

export interface SyncMeta {
  key: "lastPulledAt";
  value: number;
}

class SinewLocalDb extends Dexie {
  sessions!: Table<LocalSession, string>;
  meta!: Table<SyncMeta, string>;

  constructor() {
    super("sinew");
    this.version(1).stores({
      sessions: "id, date, dirty, updatedAt",
      meta: "key",
    });
  }
}

export const localDb = new SinewLocalDb();

export async function saveSessionLocally(session: LoggedSession): Promise<void> {
  await localDb.sessions.put({ ...session, updatedAt: Date.now(), dirty: 1 });
}

export async function pendingSessions(): Promise<LocalSession[]> {
  return localDb.sessions.where("dirty").equals(1).toArray();
}
