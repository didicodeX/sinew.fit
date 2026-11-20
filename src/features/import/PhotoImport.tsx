"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildQuickSession,
  duplicateDates,
  groupPages,
  isValidIsoDate,
  matchExercise,
  mergeInto,
  normalizeExerciseName,
  photoExerciseNames,
  photoToDraft,
  todayIn,
  type ExerciseDef,
  type PhotoBlock,
  type PhotoSession,
} from "@domain/index";
import { CameraIcon, LinkIcon, TrashIcon } from "@shared/components/icons";
import { shrinkPhoto } from "@lib/import/shrink-photo";
import { pullSessions } from "@lib/local/sync";
import { finishBatch, findExistingDates, importChunk, resolveExercises, startBatch, undoBatch, type Resolution } from "@/server/import/actions";
import { readNotebookPhoto } from "@/server/import/photo";

type Step = "pick" | "reading" | "review" | "done";
type Choice = { kind: "map"; exerciseId: string } | { kind: "create" } | { kind: "skip" };
type Photo = { file: File; url: string };
type Failure = { index: number; error: string };

const field = "h-11 w-full rounded-xl border bg-bg px-3 text-sm";
const primary = "h-12 w-full rounded-xl bg-accent font-semibold text-bg disabled:opacity-40";
const MAX_PHOTOS = 30;
const CHUNK = 25;

/** Amber border on fields the reader was unsure about, so the eye goes there first. */
const border = (unsure: boolean) => (unsure ? "border-amber-500" : "border-line");

const emptyPhotoBlock = (): PhotoBlock => ({ name: "", reps: "", hold: false, rest: "", breakAfter: "", notes: "", superset: "", uncertain: [] });

export function PhotoImport({ exercises, enabled }: { exercises: ExerciseDef[]; enabled: boolean }) {
  const [step, setStep] = useState<Step>("pick");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sessions, setSessions] = useState<PhotoSession[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [current, setCurrent] = useState(0);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existing, setExisting] = useState<string[]>([]);
  const [policy, setPolicy] = useState<"skip" | "replace">("skip");
  const [busy, setBusy] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ saved: number; skipped: number } | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  // Free the previews when leaving the screen (not on every change: kept photos still use them)
  const photosRef = useRef<Photo[]>([]);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  // ─── Exercise matching (automatic when the name is known, otherwise "create") ───
  const names = useMemo(() => photoExerciseNames(sessions), [sessions]);
  const autoChoices = useMemo(() => {
    const out: Record<string, Choice> = {};
    for (const n of names) {
      const m = matchExercise(n.name, exercises);
      out[n.key] =
        m.kind === "exact" ? { kind: "map", exerciseId: m.exercise.id }
        : m.kind === "suggest" ? { kind: "map", exerciseId: m.candidates[0]!.exercise.id }
        : { kind: "create" };
    }
    return out;
  }, [names, exercises]);
  const auto = useCallback((key: string, _name: string): Choice => autoChoices[key] ?? { kind: "create" }, [autoChoices]);
  const choiceFor = (name: string): Choice => {
    const key = normalizeExerciseName(name);
    return choices[key] ?? auto(key, name);
  };

  const placeholders = useMemo(
    () =>
      exercises.concat(
        names.flatMap((n) =>
          (choices[n.key] ?? auto(n.key, n.name)).kind === "create"
            ? [{ id: `new:${n.key}`, name: n.name, kind: n.hold ? ("hold" as const) : ("reps" as const), perSide: false, allowsWeight: false }]
            : [],
        ),
      ),
    [exercises, names, choices, auto],
  );
  const idOf = (name: string): string | null => {
    const key = normalizeExerciseName(name);
    if (!key) return null;
    const c = choices[key] ?? auto(key, name);
    return c.kind === "skip" ? null : c.kind === "map" ? c.exerciseId : `new:${key}`;
  };

  const results = sessions.map((s) => buildQuickSession(photoToDraft(s, idOf), placeholders, () => crypto.randomUUID()));
  const dupDates = duplicateDates(sessions);
  const sessionProblem = (i: number): string | null => {
    const s = sessions[i]!;
    if (!isValidIsoDate(s.date)) return "Add the date";
    if (s.date > todayIn()) return "The date is in the future";
    if (dupDates.includes(s.date)) return "Another photo has the same date";
    if (s.blocks.some((b) => !normalizeExerciseName(b.name) && b.reps.trim())) return "An exercise has no name";
    if (results[i]!.blocking) return "Fix the values marked below";
    return null;
  };
  const allChecked = sessions.length > 0 && sessions.every((_, i) => checked.has(i));
  const readyToImport = allChecked && sessions.every((_, i) => !sessionProblem(i));

  const datesKey = sessions.map((s) => s.date).join(",");
  useEffect(() => {
    if (!allChecked) return;
    let cancelled = false;
    const dates = datesKey.split(",").filter(isValidIsoDate);
    void findExistingDates(dates).then((d) => !cancelled && setExisting(d));
    return () => {
      cancelled = true;
    };
  }, [allChecked, datesKey]);

  // ─── Reading ───
  function addPhotos(list: FileList | null) {
    if (!list) return;
    const room = MAX_PHOTOS - photos.length;
    const next = [...list].filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)).slice(0, room);
    if (list.length > room) setError(`Up to ${MAX_PHOTOS} photos at a time.`);
    setPhotos((p) => [...p, ...next.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  }

  async function readOne(index: number): Promise<PhotoSession[] | Failure> {
    const form = new FormData();
    const small = await shrinkPhoto(photos[index]!.file);
    if (small.size > 4 * 1024 * 1024 || !/^image\/(jpeg|png|webp|heic|heif)$/.test(small.type)) {
      return { index, error: "This photo could not be prepared on this device (format or size). Try a JPEG, or a screenshot of it." };
    }
    form.set("photo", small);
    form.set("index", String(index));
    form.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone);
    try {
      const r = await readNotebookPhoto(form);
      return r.ok ? r.sessions : { index, error: r.error };
    } catch (e) {
      const why = e instanceof Error && e.message ? ` (${e.message.slice(0, 120)})` : "";
      return { index, error: `Upload failed${why}. Check the connection and retry.` };
    }
  }

  async function readAll(indexes: number[]) {
    setStep("reading");
    setError(null);
    const read: PhotoSession[] = [];
    const failed: Failure[] = [];
    for (const [n, i] of indexes.entries()) {
      setProgress(`Reading photo ${n + 1} of ${indexes.length}…`);
      const r = await readOne(i);
      if (Array.isArray(r)) read.push(...r);
      else failed.push(r);
    }
    setProgress(null);
    // Keep photo order, so page 2 follows page 1 and joins it
    setSessions((prev) => groupPages([...prev, ...read].sort((a, b) => a.photos[0]! - b.photos[0]!)));
    setFailures((prev) => [...prev.filter((f) => !indexes.includes(f.index)), ...failed]);
    setChecked(new Set());
    setCurrent(0);
    setStep("review");
  }

  // ─── Editing ───
  const setSession = (i: number, patch: Partial<PhotoSession>) => {
    setSessions((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    setChecked((c) => {
      const n = new Set(c);
      n.delete(i);
      return n;
    });
  };
  const setBlock = (i: number, b: number, patch: Partial<PhotoBlock>) =>
    setSession(i, { blocks: sessions[i]!.blocks.map((x, j) => (j === b ? { ...x, ...patch, uncertain: x.uncertain.filter((f) => !(f in patch)) } : x)) });

  function joinWithPrevious(i: number) {
    if (i === 0) return;
    setSessions((ss) => [...ss.slice(0, i - 1), mergeInto(ss[i - 1]!, ss[i]!), ...ss.slice(i + 1)]);
    setChecked(new Set());
    setCurrent(i - 1);
  }
  function removeSession(i: number) {
    setSessions((ss) => ss.filter((_, j) => j !== i));
    setChecked((c) => new Set([...c].filter((j) => j !== i).map((j) => (j > i ? j - 1 : j))));
    setCurrent((c) => Math.max(0, Math.min(c, sessions.length - 2)));
  }
  function typeByHand(f: Failure) {
    const blank: PhotoSession = {
      date: "", dateText: "", start: "", end: "", sessionNotes: "", continuesPrevious: false,
      uncertain: [], blocks: [emptyPhotoBlock()], photos: [f.index],
    };
    setSessions((ss) => [...ss, blank].sort((a, b) => a.photos[0]! - b.photos[0]!));
    setFailures((fs) => fs.filter((x) => x.index !== f.index));
    setChecked(new Set());
  }
  function confirmCurrent() {
    const next = new Set(checked).add(current);
    setChecked(next);
    const todo = sessions.findIndex((_, i) => !next.has(i));
    if (todo !== -1) setCurrent(todo);
  }

  // ─── Saving: one batch, same pipeline as the spreadsheet import ───
  async function commit() {
    setBusy(true);
    setError(null);
    try {
      const resolutions: Resolution[] = names.flatMap((n): Resolution[] => {
        const c = choices[n.key] ?? auto(n.key, n.name);
        if (c.kind === "skip") return [];
        return c.kind === "map"
          ? [{ action: "map", key: n.key, sourceName: n.name, exerciseId: c.exerciseId }]
          : [{ action: "create", key: n.key, sourceName: n.name, name: n.name, kind: n.hold ? "hold" : "reps" }];
      });
      const res = await resolveExercises(resolutions);
      if (!res.ok) throw new Error(res.error);
      const known = exercises.concat(
        names.flatMap((n) =>
          (choices[n.key] ?? auto(n.key, n.name)).kind === "create" && res.ids[n.key]
            ? [{ id: res.ids[n.key]!, name: n.name, kind: n.hold ? ("hold" as const) : ("reps" as const), perSide: false, allowsWeight: false }]
            : [],
        ),
      );
      const now = Date.now();
      const built = sessions.map((s) => ({
        ...buildQuickSession(photoToDraft(s, (name) => res.ids[normalizeExerciseName(name)] ?? null), known, () => crypto.randomUUID()).session,
        updatedAt: now,
      }));

      const batch = await startBatch(`${photos.length} notebook photo${photos.length === 1 ? "" : "s"}`, "photo");
      setBatchId(batch.id);
      let saved = 0;
      let skipped = 0;
      for (let i = 0; i < built.length; i += CHUNK) {
        setProgress(`Saving ${Math.min(i + CHUNK, built.length)} of ${built.length} sessions…`);
        const r = await importChunk(batch.id, built.slice(i, i + CHUNK), policy);
        if (!r.ok) throw new Error(r.error);
        saved += r.saved;
        skipped += r.skipped;
      }
      await finishBatch(batch.id);
      await pullSessions({ full: true });
      setOutcome({ saved, skipped });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function undo() {
    if (!batchId) return;
    setBusy(true);
    const r = await undoBatch(batchId);
    await pullSessions({ full: true });
    setBusy(false);
    if (r.ok) {
      setOutcome(null);
      setBatchId(null);
      setStep("review");
      setChecked(new Set());
      setError("Import undone. The sessions are still here if you want to fix and import again.");
    } else setError(r.error ?? "Could not undo.");
  }

  const s = sessions[current];
  const result = results[current];
  const clash = sessions.filter((x) => existing.includes(x.date)).length;
  const sets = results.reduce((n, r) => n + r.session.entries.reduce((m, e) => m + e.sets.length, 0), 0);

  return (
    <div className="space-y-4 pb-24">
      <Link href="/import" className="text-sm text-accent">← Import</Link>
      <h1 className="text-3xl font-bold tracking-tight">Import notebook photos</h1>
      {error ? <p className="rounded-xl border border-line bg-surface p-3 text-sm text-amber-500">{error}</p> : null}

      {!enabled ? (
        <p className="rounded-2xl border border-amber-500 p-4 text-sm">
          Photo reading is not switched on for this server yet (missing Gemini key). Spreadsheet import and quick entry still work.
        </p>
      ) : null}

      {step === "pick" ? (
        <div className="space-y-3">
          <label className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-surface p-6 text-center">
            <CameraIcon width={32} height={32} className="text-accent" />
            <span className="font-semibold">Take or choose photos</span>
            <span className="text-sm text-muted">One photo per session (both pages) works best. Pages of the same session are joined.</span>
            <input type="file" accept="image/*" multiple className="sr-only" disabled={!enabled}
              onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
          </label>
          {photos.length ? (
            <ul className="grid grid-cols-4 gap-2">
              {photos.map((p, i) => (
                <li key={p.url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a picked file */}
                  <img src={p.url} alt={`Photo ${i + 1}`} className="aspect-[3/4] w-full rounded-xl object-cover" />
                  <button type="button" aria-label={`Remove photo ${i + 1}`}
                    className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-bg/80 text-red-500"
                    onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}>
                    <TrashIcon width={16} height={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="text-sm text-muted">The photos are only read, not kept. You check every session before anything is saved.</p>
          <button type="button" className={primary} disabled={!enabled || photos.length === 0}
            onClick={() => void readAll(photos.map((_, i) => i))}>
            Read {photos.length || ""} photo{photos.length === 1 ? "" : "s"}
          </button>
        </div>
      ) : null}

      {step === "reading" ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-6 text-center">
          <CameraIcon width={32} height={32} className="animate-pulse text-accent" />
          <p className="font-semibold">{progress}</p>
          <p className="text-sm text-muted">About 5 to 15 seconds per photo. Keep this screen open.</p>
        </div>
      ) : null}

      {step === "review" ? (
        <div className="space-y-3">
          {failures.length ? (
            <div className="space-y-2 rounded-2xl border border-amber-500 p-3">
              {failures.map((f) => (
                <div key={f.index} className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                  <img src={photos[f.index]?.url} alt="" className="size-12 rounded-lg object-cover" />
                  <p className="min-w-0 flex-1 text-sm">Photo {f.index + 1}: {f.error}</p>
                  <button type="button" className="h-10 rounded-xl border border-line px-3 text-sm" onClick={() => void readAll([f.index])}>Retry</button>
                  <button type="button" className="h-10 rounded-xl border border-line px-3 text-sm" onClick={() => typeByHand(f)}>Type it</button>
                </div>
              ))}
            </div>
          ) : null}

          {sessions.length ? (
            <nav className="flex gap-1 overflow-x-auto pb-1" aria-label="Sessions">
              {sessions.map((x, i) => (
                <button key={i} type="button" onClick={() => setCurrent(i)}
                  className={`tabular h-9 shrink-0 rounded-full border px-3 text-sm ${i === current ? "border-accent text-accent" : "border-line"} ${checked.has(i) ? "bg-surface" : ""}`}>
                  {checked.has(i) ? "✓ " : ""}{x.date ? x.date.slice(5) : `#${i + 1}`}
                </button>
              ))}
            </nav>
          ) : null}

          {s && result ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Session {current + 1} of {sessions.length} · {checked.size} checked. Amber = hard to read, check it against the photo.
              </p>
              <div className="flex gap-2 overflow-x-auto">
                {s.photos.map((p) => (
                  <button key={p} type="button" className="shrink-0" onClick={() => setZoom(zoom === photos[p]?.url ? null : photos[p]?.url ?? null)}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                    <img src={photos[p]?.url} alt={`Photo ${p + 1}`} className="h-28 rounded-xl object-cover" />
                  </button>
                ))}
              </div>
              {zoom ? (
                <div className="max-h-[70vh] overflow-auto rounded-xl border border-line" onClick={() => setZoom(null)}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                  <img src={zoom} alt="Photo, full size" className="max-w-none" style={{ width: "200%" }} />
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <label className="col-span-2 text-sm text-muted">
                  Date{s.dateText ? ` (written “${s.dateText}”)` : ""}
                  <input type="date" max={todayIn()} className={`${field} ${border(s.uncertain.includes("date") || !s.date)}`} value={s.date}
                    onChange={(e) => setSession(current, { date: e.target.value, uncertain: s.uncertain.filter((f) => f !== "date") })} />
                </label>
                <label className="text-sm text-muted">
                  Start
                  <input className={`${field} ${border(s.uncertain.includes("start"))}`} inputMode="numeric" placeholder="12:40" value={s.start}
                    onChange={(e) => setSession(current, { start: e.target.value, uncertain: s.uncertain.filter((f) => f !== "start") })} />
                </label>
                <label className="text-sm text-muted">
                  End
                  <input className={`${field} ${border(s.uncertain.includes("end"))}`} inputMode="numeric" placeholder="13:17" value={s.end}
                    onChange={(e) => setSession(current, { end: e.target.value, uncertain: s.uncertain.filter((f) => f !== "end") })} />
                </label>
              </div>
              {(result.warnings.get(-1) ?? []).map((w) => <p key={w} className="text-sm text-amber-500">{w}</p>)}

              <ol className="space-y-3">
                {s.blocks.map((b, bi) => {
                  const c = choiceFor(b.name);
                  const key = normalizeExerciseName(b.name);
                  const value = c.kind === "map" ? c.exerciseId : c.kind === "create" ? "__new" : "__skip";
                  const ex = c.kind === "map" ? exercises.find((e) => e.id === c.exerciseId) : undefined;
                  const unsure = (f: PhotoBlock["uncertain"][number]) => border(b.uncertain.includes(f));
                  return (
                    <li key={bi} className={`space-y-2 rounded-2xl border border-line bg-surface p-3 ${c.kind === "skip" ? "opacity-50" : ""}`}>
                      <div className="flex items-center gap-2">
                        <input className={`${field} ${unsure("name")} font-semibold`} placeholder="Exercise as written" value={b.name}
                          onChange={(e) => setBlock(current, bi, { name: e.target.value })} />
                        <button type="button" aria-label="Remove exercise" className="grid size-11 shrink-0 place-items-center rounded-xl text-red-500"
                          onClick={() => setSession(current, { blocks: s.blocks.filter((_, j) => j !== bi) })}>
                          <TrashIcon />
                        </button>
                      </div>
                      {key ? (
                        <select className={`${field} border-line`} value={value} aria-label="Save as"
                          onChange={(e) => {
                            const v = e.target.value;
                            setChoices((cs) => ({ ...cs, [key]: v === "__new" ? { kind: "create" } : v === "__skip" ? { kind: "skip" } : { kind: "map", exerciseId: v } }));
                          }}>
                          <option value="__new">New exercise “{b.name.trim()}”</option>
                          <option value="__skip">Skip this exercise</option>
                          {exercises.map((e) => <option key={e.id} value={e.id}>= {e.name}{e.archived ? " (retired)" : ""}</option>)}
                        </select>
                      ) : null}
                      <input className={`${field} ${unsure("reps")}`} placeholder={(ex?.kind ?? (b.hold ? "hold" : "reps")) === "hold" ? "Seconds per set: 20 20 18" : "Reps per set: 5 5 5"}
                        value={b.reps} onChange={(e) => setBlock(current, bi, { reps: e.target.value })} />
                      <div className="grid grid-cols-3 gap-2">
                        <input className={`${field} ${unsure("rest")}`} placeholder="Rest 1:30" value={b.rest} onChange={(e) => setBlock(current, bi, { rest: e.target.value })} />
                        <input className={`${field} ${unsure("breakAfter")}`} placeholder="Break" value={b.breakAfter} onChange={(e) => setBlock(current, bi, { breakAfter: e.target.value })} />
                        <input className={`${field} ${unsure("superset")}`} placeholder="Superset" maxLength={4} value={b.superset} onChange={(e) => setBlock(current, bi, { superset: e.target.value })} />
                      </div>
                      <input className={`${field} ${unsure("notes")}`} placeholder="Notes" value={b.notes} onChange={(e) => setBlock(current, bi, { notes: e.target.value })} />
                      {c.kind === "create" ? (
                        <label className="flex items-center gap-2 text-sm text-muted">
                          <input type="checkbox" checked={b.hold} onChange={(e) => setBlock(current, bi, { hold: e.target.checked })} /> Hold (values are seconds)
                        </label>
                      ) : null}
                      {(result.warnings.get(bi) ?? []).filter((w) => w !== "Pick an exercise").map((w) => <p key={w} className="text-sm text-amber-500">{w}</p>)}
                    </li>
                  );
                })}
              </ol>
              <button type="button" className="h-11 rounded-xl border border-line px-4 text-sm"
                onClick={() => setSession(current, { blocks: [...s.blocks, emptyPhotoBlock()] })}>
                + Add exercise
              </button>
              <textarea className={`w-full rounded-xl border bg-bg p-3 text-sm ${border(s.uncertain.includes("sessionNotes"))}`} rows={3} placeholder="Session notes"
                value={s.sessionNotes} onChange={(e) => setSession(current, { sessionNotes: e.target.value, uncertain: s.uncertain.filter((f) => f !== "sessionNotes") })} />

              <div className="flex gap-2">
                {current > 0 ? (
                  <button type="button" className="flex h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm" onClick={() => joinWithPrevious(current)}>
                    <LinkIcon width={16} height={16} /> Join with previous
                  </button>
                ) : null}
                <button type="button" className="flex h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm text-red-500" onClick={() => removeSession(current)}>
                  <TrashIcon width={16} height={16} /> Drop session
                </button>
              </div>

              {sessionProblem(current) ? <p className="text-sm text-amber-500">{sessionProblem(current)}</p> : null}
              {!checked.has(current) ? (
                <button type="button" className={primary} disabled={Boolean(sessionProblem(current))} onClick={confirmCurrent}>
                  ✓ Looks right{sessions.length > 1 && checked.size < sessions.length - 1 ? ", next" : ""}
                </button>
              ) : null}
            </div>
          ) : sessions.length === 0 && !failures.length ? (
            <p className="text-sm text-muted">No sessions left. Go back to pick photos again.</p>
          ) : null}

          {allChecked ? (
            <div className="space-y-3 rounded-2xl border border-accent p-4">
              <p className="text-lg font-semibold">{sessions.length} sessions · {sets} sets ready</p>
              <p className="text-sm text-muted">
                {names.filter((n) => (choices[n.key] ?? auto(n.key, n.name)).kind === "create").length} new exercises. Names you matched are remembered for next time.
              </p>
              {clash ? (
                <div className="space-y-2 rounded-xl border border-amber-500 p-3">
                  <p className="text-sm">{clash} of these dates already have a session.</p>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" checked={policy === "skip"} onChange={() => setPolicy("skip")} /> Skip those dates (keep what is there)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="radio" checked={policy === "replace"} onChange={() => setPolicy("replace")} /> Replace them (undo brings them back)
                  </label>
                </div>
              ) : null}
              {progress ? <p className="text-sm text-muted">{progress}</p> : null}
              <button type="button" className={primary} disabled={busy || !readyToImport} onClick={() => void commit()}>
                {busy ? "Importing…" : `Import ${sessions.length} sessions`}
              </button>
              {!busy && batchId && error ? (
                <button type="button" className="h-11 rounded-xl border border-line px-4 text-sm text-red-500" onClick={() => void undo()}>
                  Undo the partial import
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {step === "done" && outcome ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-lg font-semibold">Imported {outcome.saved} sessions</p>
            {outcome.skipped ? <p className="text-sm text-muted">{outcome.skipped} skipped (a session already existed).</p> : null}
          </div>
          <Link href="/history" className={`${primary} flex items-center justify-center`}>View history</Link>
          <button type="button" disabled={busy} className="h-11 w-full rounded-xl border border-line text-sm text-red-500" onClick={() => void undo()}>
            Undo this import
          </button>
        </div>
      ) : null}
    </div>
  );
}
