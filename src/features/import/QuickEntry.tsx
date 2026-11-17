"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  buildQuickSession,
  draftFromSession,
  emptyBlock,
  isValidIsoDate,
  todayIn,
  type ExerciseDef,
  type IsoDate,
  type QuickBlock,
  type QuickDraft,
} from "@domain/index";
import { ExercisePicker } from "@features/program/ExercisePicker";
import { putSession, saveLocalSession, sessionForDate, sessionsBefore } from "@lib/local/db";
import { pushNow } from "@lib/local/sync";

const input = "h-12 w-full rounded-xl border border-line bg-bg px-3";
const small = "h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm";

/**
 * Notebook-style backfill form (brief §6.1 #4). Typing "5 5 5" makes three sets.
 * Saves into the local store like any session, so it syncs and shows in History.
 */
export function QuickEntry({ exercises }: { exercises: ExerciseDef[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<QuickDraft>(() => ({
    date: todayIn(),
    start: "",
    end: "",
    title: "",
    sessionNotes: "",
    blocks: [emptyBlock()],
  }));
  const [extraDates, setExtraDates] = useState<IsoDate[]>([]);
  const [pendingDate, setPendingDate] = useState("");
  const [picking, setPicking] = useState<number | null>(null);
  const [conflicts, setConflicts] = useState<IsoDate[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const result = useMemo(() => buildQuickSession(draft, exercises, () => crypto.randomUUID()), [draft, exercises]);

  const setBlock = (i: number, patch: Partial<QuickBlock>) =>
    setDraft((d) => ({ ...d, blocks: d.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));

  async function duplicatePrevious() {
    const [prev] = await sessionsBefore(draft.date, 1);
    if (!prev) return setMessage("No earlier session on this device.");
    setDraft((d) => ({ ...draft, ...draftFromSession(prev, d.date), start: d.start, end: d.end }));
    setMessage(`Copied the session of ${prev.date}. Change only what differs.`);
  }

  async function save(replace: boolean) {
    setSaving(true);
    try {
      const dates = [draft.date, ...extraDates.filter((d) => d !== draft.date)];
      const existing = await Promise.all(dates.map((d) => sessionForDate(d)));
      const clash = dates.filter((_, i) => existing[i]);
      if (clash.length && !replace) {
        setConflicts(clash);
        return;
      }
      const now = Date.now();
      for (const old of existing) {
        // Replace = soft-delete the old one (synced like any edit)
        if (old) await saveLocalSession({ ...old, deletedAt: now, updatedAt: now, dirty: 1 });
      }
      const used = new Set(result.session.entries.map((e) => e.exerciseId));
      const defs = exercises.filter((e) => used.has(e.id));
      for (const date of dates) {
        const built = buildQuickSession({ ...draft, date }, exercises, () => crypto.randomUUID());
        await putSession(built.session, defs);
      }
      void pushNow();
      router.push("/history");
    } finally {
      setSaving(false);
    }
  }

  const sessionWarnings = result.warnings.get(-1) ?? [];

  return (
    <div className="space-y-4 pb-24">
      <Link href="/history" className="text-sm text-accent">← History</Link>
      <h1 className="text-3xl font-bold tracking-tight">Add past session</h1>

      <div className="grid grid-cols-3 gap-2">
        <label className="col-span-3 text-sm text-muted">
          Date
          <input type="date" className={input} value={draft.date} max={todayIn()}
            onChange={(e) => isValidIsoDate(e.target.value) && setDraft({ ...draft, date: e.target.value })} />
        </label>
        <label className="text-sm text-muted">
          Start
          <input className={input} inputMode="numeric" placeholder="12:40" value={draft.start}
            onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
        </label>
        <label className="text-sm text-muted">
          End
          <input className={input} inputMode="numeric" placeholder="13:17" value={draft.end}
            onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
        </label>
        <label className="text-sm text-muted">
          Title
          <input className={input} placeholder="Pull A" value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </label>
      </div>

      <button type="button" onClick={() => void duplicatePrevious()} className="h-11 rounded-xl border border-line px-4 text-sm">
        Duplicate previous session
      </button>

      <ol className="space-y-3">
        {draft.blocks.map((b, i) => {
          const ex = byId.get(b.exerciseId);
          const warns = result.warnings.get(i) ?? [];
          return (
            <li key={i} className="space-y-2 rounded-2xl border border-line bg-surface p-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPicking(picking === i ? null : i)}
                  className="h-11 min-w-0 flex-1 truncate rounded-xl border border-line px-3 text-left font-semibold">
                  {ex?.name ?? "Pick exercise"}
                </button>
                <button type="button" aria-label="Remove exercise" className="size-11 rounded-xl text-red-500"
                  onClick={() => setDraft((d) => ({ ...d, blocks: d.blocks.filter((_, j) => j !== i) }))}>
                  ✕
                </button>
              </div>
              {picking === i ? (
                <ExercisePicker exercises={exercises} includeArchived
                  onPick={(id) => { setBlock(i, { exerciseId: id }); setPicking(null); }} />
              ) : null}
              <input className={small} inputMode="text" placeholder={ex?.kind === "hold" ? "Seconds per set: 20 20 18" : "Reps per set: 5 5 5"}
                value={b.reps} onChange={(e) => setBlock(i, { reps: e.target.value })} />
              <div className="grid grid-cols-3 gap-2">
                <input className={small} placeholder="Rest 1:30" value={b.rest} onChange={(e) => setBlock(i, { rest: e.target.value })} />
                <input className={small} placeholder="Break" value={b.breakAfter} onChange={(e) => setBlock(i, { breakAfter: e.target.value })} />
                <input className={small} placeholder="Superset A" maxLength={4} value={b.superset} onChange={(e) => setBlock(i, { superset: e.target.value })} />
              </div>
              <input className={small} placeholder="Notes" value={b.notes} onChange={(e) => setBlock(i, { notes: e.target.value })} />
              {warns.map((w) => (
                <p key={w} className="text-sm text-amber-500">{w}</p>
              ))}
            </li>
          );
        })}
      </ol>
      <button type="button" className="h-11 rounded-xl border border-line px-4 text-sm"
        onClick={() => setDraft((d) => ({ ...d, blocks: [...d.blocks, emptyBlock()] }))}>
        + Add exercise
      </button>

      <textarea className="w-full rounded-xl border border-line bg-bg p-3" rows={3} placeholder="Session notes"
        value={draft.sessionNotes} onChange={(e) => setDraft({ ...draft, sessionNotes: e.target.value })} />

      <div className="space-y-2 rounded-2xl border border-line bg-surface p-3">
        <p className="text-sm text-muted">Same session on other dates (a repeated week)</p>
        <div className="flex gap-2">
          <input type="date" className={small} max={todayIn()} value={pendingDate} onChange={(e) => setPendingDate(e.target.value)} />
          <button type="button" className="h-11 rounded-xl border border-line px-4 text-sm"
            disabled={!isValidIsoDate(pendingDate) || pendingDate === draft.date || extraDates.includes(pendingDate)}
            onClick={() => { setExtraDates([...extraDates, pendingDate].sort()); setPendingDate(""); }}>
            Add
          </button>
        </div>
        {extraDates.length ? (
          <ul className="flex flex-wrap gap-2">
            {extraDates.map((d) => (
              <li key={d}>
                <button type="button" className="tabular rounded-full border border-line px-3 py-1 text-sm"
                  onClick={() => setExtraDates(extraDates.filter((x) => x !== d))}>
                  {d} ✕
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {sessionWarnings.map((w) => (
        <p key={w} className="text-sm text-amber-500">{w}</p>
      ))}
      {message ? <p className="text-sm text-muted">{message}</p> : null}

      {conflicts ? (
        <div className="space-y-2 rounded-2xl border border-amber-500 p-3">
          <p className="text-sm">A session already exists on {conflicts.join(", ")}. Replace it?</p>
          <div className="flex gap-2">
            <button type="button" disabled={saving} className="h-11 flex-1 rounded-xl bg-accent font-semibold text-bg"
              onClick={() => { setConflicts(null); void save(true); }}>
              Replace
            </button>
            <button type="button" className="h-11 rounded-xl border border-line px-4" onClick={() => setConflicts(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" disabled={saving || result.blocking}
          className="h-12 w-full rounded-xl bg-accent font-semibold text-bg disabled:opacity-40"
          onClick={() => void save(false)}>
          Save{extraDates.length ? ` on ${1 + extraDates.length} dates` : ""}
        </button>
      )}
    </div>
  );
}
