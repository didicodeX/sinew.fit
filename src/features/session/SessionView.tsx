"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatDuration,
  lastTimeByExercise,
  nextSet,
  reduceSession,
  restRemaining,
  sessionProgress,
  TRAINING_RULES,
  type SessionAction,
  type SetRef,
} from "@domain/index";
import { getSession, saveLocalSession, sessionsBefore, type LocalSession } from "@lib/local/db";
import { pushNow } from "@lib/local/sync";
import { keepScreenOn, restDoneAlert, unlockAudio } from "./device";
import { ExerciseCard, type LastTime } from "./ExerciseCard";
import { HoldTimer } from "./HoldTimer";
import { RestBar } from "./RestBar";
import { useNow } from "./useNow";

const PUSH_DEBOUNCE_MS = 3000;

export function SessionView({ id }: { id: string }) {
  const [session, setSession] = useState<LocalSession | null | undefined>(undefined);
  const [lastTimes, setLastTimes] = useState<Map<string, LastTime>>(new Map());
  const [holdRef, setHoldRef] = useState<SetRef | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const ref = useRef<LocalSession | null>(null);
  const pushTimer = useRef<number | undefined>(undefined);
  const alertedFor = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSession(id).then(async (s) => {
      if (cancelled) return;
      ref.current = s ?? null;
      setSession(s ?? null);
      if (s) {
        const history = await sessionsBefore(s.date);
        if (!cancelled) setLastTimes(lastTimeByExercise(history));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => keepScreenOn(), []);

  const dispatch = useCallback((action: SessionAction) => {
    const current = ref.current;
    if (!current) return;
    if (action.type === "confirmSet") unlockAudio();
    // The reducer spreads the session, so device-only fields (exerciseDefs…) carry over
    const next: LocalSession = { ...(reduceSession(current, action) as LocalSession), updatedAt: Date.now(), dirty: 1 };
    ref.current = next;
    setSession(next);
    // IndexedDB first: a set confirmed with no signal is never lost
    void saveLocalSession(next);
    window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => void pushNow(), PUSH_DEBOUNCE_MS);
  }, []);

  const now = useNow(Boolean(session?.rest) || Boolean(session && !session.endedAt), 250);

  // End-of-rest alert, once per rest
  useEffect(() => {
    const rest = session?.rest;
    if (!rest || alertedFor.current === rest.startedAt) return;
    if (restRemaining(rest, now) <= 0) {
      alertedFor.current = rest.startedAt;
      restDoneAlert();
    }
  }, [session?.rest, now]);

  const defs = useMemo(() => new Map((session?.exerciseDefs ?? []).map((e) => [e.id, e])), [session?.exerciseDefs]);

  if (session === undefined) return <div className="h-40" aria-busy />;
  if (session === null) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-muted">This session isn't on this device.</p>
        <Link href="/" className="text-accent">
          Back to Today
        </Link>
      </div>
    );
  }

  const progress = sessionProgress(session);
  const next = nextSet(session);
  const nextKey = next ? `${next.index}${next.side ?? ""}` : undefined;
  const startedMs = session.startedAt ? Date.parse(session.startedAt) : null;
  const endMs = session.endedAt ? Date.parse(session.endedAt) : now;
  const holdEntry = holdRef ? session.entries.find((e) => e.id === holdRef.entryId) : undefined;

  // Group consecutive entries by part (e.g. "Pull B" then "Core B")
  const parts: { name: string; entries: typeof session.entries }[] = [];
  for (const e of session.entries) {
    const name = e.partName ?? "";
    const last = parts.at(-1);
    if (last && last.name === name) last.entries.push(e);
    else parts.push({ name, entries: [e] });
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link href="/" className="text-sm text-muted">
            ‹ Today
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{session.title ?? "Session"}</h1>
          <p className="tabular text-sm text-muted">
            {progress.done}/{progress.total} sets
            {startedMs ? ` · ${formatDuration(Math.max(0, (endMs - startedMs) / 1000))}` : " · not started"}
            {session.endedAt ? " · finished" : ""}
          </p>
        </div>
        {!session.endedAt ? (
          <button
            type="button"
            onClick={() => setConfirmFinish(true)}
            className="h-11 rounded-xl border border-line px-4 font-semibold"
          >
            Finish
          </button>
        ) : null}
      </header>

      {confirmFinish ? (
        <div className="space-y-3 rounded-2xl border border-accent/50 bg-surface p-4">
          <p>
            {progress.done < progress.total
              ? `${progress.total - progress.done} sets not done. They won't be saved.`
              : "All sets done."}{" "}
            Finish the session?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                dispatch({ type: "finish", now: Date.now() });
                setConfirmFinish(false);
                void pushNow();
              }}
              className="h-12 flex-1 rounded-xl bg-accent font-semibold text-accent-fg"
            >
              Finish
            </button>
            <button type="button" onClick={() => setConfirmFinish(false)} className="h-12 flex-1 rounded-xl border border-line">
              Keep going
            </button>
          </div>
        </div>
      ) : null}

      <details className="rounded-2xl border border-line bg-surface">
        <summary className="px-4 py-3 text-sm text-muted">Rules</summary>
        <ul className="list-disc space-y-1 border-t border-line px-8 py-3 text-sm">
          {TRAINING_RULES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </details>

      {parts.map((part) => (
        <section key={part.name} className="space-y-3">
          {part.name ? <h2 className="pt-2 text-sm font-semibold uppercase tracking-wide text-muted">{part.name}</h2> : null}
          {part.entries.map((entry) => (
            <ExerciseCard
              key={entry.id}
              entry={entry}
              exercise={defs.get(entry.exerciseId)}
              lastTime={lastTimes.get(entry.exerciseId)}
              nextKey={next?.entryId === entry.id ? nextKey : undefined}
              dispatch={dispatch}
              onHold={setHoldRef}
            />
          ))}
        </section>
      ))}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Session notes</h2>
        <textarea
          defaultValue={session.sessionNotes ?? ""}
          onBlur={(e) => dispatch({ type: "sessionNotes", notes: e.target.value.trim() })}
          rows={3}
          placeholder="Overall remarks, what to change next time"
          className="w-full rounded-xl border border-line bg-surface p-3 text-base"
        />
      </section>

      {session.endedAt ? (
        <Link href="/" className="flex h-14 items-center justify-center rounded-xl bg-accent font-semibold text-accent-fg">
          Done
        </Link>
      ) : null}

      {session.rest ? (
        <RestBar
          rest={session.rest}
          now={now}
          onSkip={() => dispatch({ type: "skipRest" })}
          onAdjust={(deltaSec) => dispatch({ type: "adjustRest", deltaSec })}
        />
      ) : null}

      {holdRef && holdEntry ? (
        <HoldTimer
          title={defs.get(holdEntry.exerciseId)?.name ?? "Hold"}
          target={
            holdEntry.plannedTarget
              ? `${holdEntry.plannedTarget.min}${holdEntry.plannedTarget.max ? `–${holdEntry.plannedTarget.max}` : ""} s`
              : ""
          }
          onCancel={() => setHoldRef(null)}
          onDone={(seconds) => {
            dispatch({ type: "confirmSet", ref: holdRef, now: Date.now(), value: seconds });
            setHoldRef(null);
          }}
        />
      ) : null}
    </div>
  );
}
