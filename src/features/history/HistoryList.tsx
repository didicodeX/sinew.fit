"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WEEKDAY_NAMES, weekdayOf } from "@domain/index";
import { localDb, type LocalSession } from "@lib/local/db";
import { pullSessions } from "@lib/local/sync";

async function loadAll(): Promise<LocalSession[]> {
  const rows = await localDb.sessions.orderBy("date").reverse().toArray();
  return rows.filter((r) => !r.deletedAt);
}

export function doneSets(s: LocalSession): number {
  return s.entries.reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0);
}

export function HistoryList() {
  const [sessions, setSessions] = useState<LocalSession[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadAll().then((r) => !cancelled && setSessions(r));
    // Pick up sessions logged on other devices, then refresh if anything arrived
    void pullSessions()
      .then(async (n) => {
        if (n > 0 && !cancelled) setSessions(await loadAll());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!sessions) return <div className="h-40" aria-busy />;

  const logged = sessions.filter((s) => doneSets(s) > 0);
  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <h1 className="text-3xl font-bold tracking-tight">History</h1>
        <Link href="/import" className="h-10 rounded-xl bg-accent px-4 text-base font-semibold leading-10 text-bg">
          Add past
        </Link>
      </header>
      {logged.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-4 text-muted">
          No sessions yet. Your first one will show up here.
        </p>
      ) : (
        <ul className="space-y-2">
          {logged.map((s) => (
            <li key={s.id}>
              <Link
                href={`/history?id=${encodeURIComponent(s.id)}`}
                className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4"
              >
                <span>
                  <span className="block text-sm text-muted">
                    {WEEKDAY_NAMES[weekdayOf(s.date)]} · <span className="tabular">{s.date}</span>
                    {s.isDeload ? " · deload" : ""}
                  </span>
                  <span className="block font-semibold">{s.title ?? "Session"}</span>
                </span>
                <span className="tabular text-sm text-muted">{doneSets(s)} sets</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
