"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  autoMapColumns,
  buildImportedSessions,
  FIELD_LABELS,
  IMPORT_FIELDS,
  mappingProblems,
  matchExercise,
  normalizeExerciseName,
  parseCsv,
  parseImportRows,
  type ColumnMapping,
  type DateOrder,
  type ExerciseDef,
  type ImportField,
} from "@domain/index";
import { readTable } from "@lib/import/read-file";
import { pullSessions } from "@lib/local/sync";
import {
  finishBatch,
  findExistingDates,
  importChunk,
  resolveExercises,
  startBatch,
  undoBatch,
  type Resolution,
} from "@/server/import/actions";

type Step = "file" | "columns" | "exercises" | "preview" | "done";
type Choice = { kind: "map"; exerciseId: string } | { kind: "create"; name: string; hold: boolean } | { kind: "skip" };

const select = "h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm";
const primary = "h-12 w-full rounded-xl bg-accent font-semibold text-bg disabled:opacity-40";
const CHUNK = 25;

export function ImportWizard({ exercises }: { exercises: ExerciseDef[] }) {
  const [step, setStep] = useState<Step>("file");
  const [fileName, setFileName] = useState("");
  const [table, setTable] = useState<string[][]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [dateOrder, setDateOrder] = useState<DateOrder>("dmy");
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [existing, setExisting] = useState<string[]>([]);
  const [policy, setPolicy] = useState<"skip" | "replace">("skip");
  const [progress, setProgress] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ saved: number; skipped: number; sets: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const headers = table[0] ?? [];
  const dataRows = useMemo(() => table.slice(1), [table]);
  const parsed = useMemo(() => parseImportRows(dataRows, mapping, { dateOrder }), [dataRows, mapping, dateOrder]);

  // Unique exercise names, merged by normalised form ("Pull ups" = "pull-ups")
  const names = useMemo(() => {
    const m = new Map<string, { name: string; count: number; hold: boolean }>();
    for (const s of parsed.sessions)
      for (const b of s.blocks) {
        const key = normalizeExerciseName(b.sourceName);
        const cur = m.get(key) ?? { name: b.sourceName, count: 0, hold: false };
        cur.count++;
        if (b.unit === "sec") cur.hold = true;
        m.set(key, cur);
      }
    return [...m.entries()].map(([key, v]) => ({ key, ...v }));
  }, [parsed]);

  async function onFile(file: File) {
    setError(null);
    try {
      const rows = await readTable(file);
      if (rows.length < 2) return setError("The file has no data rows.");
      setFileName(file.name);
      setTable(rows);
      setMapping(autoMapColumns(rows[0]!));
      setStep("columns");
    } catch {
      setError("Could not read this file. Use .csv or .xlsx.");
    }
  }

  function toMatching() {
    const next: Record<string, Choice> = {};
    for (const n of names) {
      const m = matchExercise(n.name, exercises);
      if (m.kind === "exact") next[n.key] = { kind: "map", exerciseId: m.exercise.id };
      else if (m.kind === "suggest") next[n.key] = { kind: "map", exerciseId: m.candidates[0]!.exercise.id };
      else next[n.key] = { kind: "create", name: n.name, hold: n.hold };
    }
    setChoices(next);
    setStep("exercises");
  }

  // Sessions that would be written, given the current choices (exercise ids of "create" are not known yet)
  const previewBuilt = useMemo(() => {
    const placeholders = exercises.concat(
      Object.entries(choices).flatMap(([key, c]) =>
        c.kind === "create"
          ? [{ id: `new:${key}`, name: c.name, kind: c.hold ? ("hold" as const) : ("reps" as const), perSide: false, allowsWeight: false }]
          : [],
      ),
    );
    const idOf = (name: string) => {
      const c = choices[normalizeExerciseName(name)];
      return !c || c.kind === "skip" ? null : c.kind === "map" ? c.exerciseId : `new:${normalizeExerciseName(name)}`;
    };
    return buildImportedSessions(parsed.sessions, idOf, placeholders, () => crypto.randomUUID());
  }, [parsed, choices, exercises]);

  useEffect(() => {
    if (step !== "preview") return;
    let cancelled = false;
    void findExistingDates(previewBuilt.map((b) => b.session.date)).then((d) => !cancelled && setExisting(d));
    return () => {
      cancelled = true;
    };
  }, [step, previewBuilt]);

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      // 1. Create / alias exercises
      const resolutions: Resolution[] = names.flatMap((n): Resolution[] => {
        const c = choices[n.key];
        if (!c || c.kind === "skip") return [];
        return c.kind === "map"
          ? [{ action: "map", key: n.key, sourceName: n.name, exerciseId: c.exerciseId }]
          : [{ action: "create", key: n.key, sourceName: n.name, name: c.name, kind: c.hold ? "hold" : "reps" }];
      });
      const res = await resolveExercises(resolutions);
      if (!res.ok) throw new Error(res.error);
      const known = exercises.concat(
        Object.entries(choices).flatMap(([key, c]) =>
          c.kind === "create" && res.ids[key]
            ? [{ id: res.ids[key]!, name: c.name, kind: c.hold ? ("hold" as const) : ("reps" as const), perSide: false, allowsWeight: false }]
            : [],
        ),
      );
      const built = buildImportedSessions(
        parsed.sessions,
        (name) => res.ids[normalizeExerciseName(name)] ?? null,
        known,
        () => crypto.randomUUID(),
      );

      // 2. One batch, written in chunks
      const batch = await startBatch(fileName);
      setBatchId(batch.id);
      const now = Date.now();
      let saved = 0;
      let skipped = 0;
      for (let i = 0; i < built.length; i += CHUNK) {
        setProgress(`Saving ${Math.min(i + CHUNK, built.length)} of ${built.length} sessions…`);
        const chunk = built.slice(i, i + CHUNK).map((b) => ({ ...b.session, updatedAt: now }));
        const r = await importChunk(batch.id, chunk, policy);
        if (!r.ok) throw new Error(r.error);
        saved += r.saved;
        skipped += r.skipped;
      }
      await finishBatch(batch.id);
      await pullSessions({ full: true });
      setOutcome({ saved, skipped, sets: built.reduce((n, b) => n + b.setCount, 0) });
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
      setStep("file");
      setError("Import undone. Nothing from this file is left.");
    } else setError(r.error ?? "Could not undo.");
  }

  const problems = mappingProblems(mapping);
  const errorRows = parsed.warnings.filter((w) => w.level === "error");
  const dates = previewBuilt.map((b) => b.session.date).sort();
  const sets = previewBuilt.reduce((n, b) => n + b.setCount, 0);
  const clash = new Set(previewBuilt.map((b) => b.session.date).filter((d) => existing.includes(d)));

  return (
    <div className="space-y-4 pb-24">
      <Link href="/import" className="text-sm text-accent">← Import</Link>
      <h1 className="text-3xl font-bold tracking-tight">Import a spreadsheet</h1>
      {error ? <p className="rounded-xl border border-line bg-surface p-3 text-sm text-amber-500">{error}</p> : null}

      {step === "file" ? (
        <div className="space-y-3">
          <label className="block rounded-2xl border border-dashed border-line bg-surface p-6 text-center">
            <span className="font-semibold">Choose a .csv or .xlsx file</span>
            <input type="file" accept=".csv,.tsv,.txt,.xlsx,text/csv" className="mt-3 block w-full text-sm"
              onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])} />
          </label>
          <PasteBox onText={(text) => {
            const rows = parseCsv(text);
            if (rows.length < 2) return setError("Paste a header row and at least one data row.");
            setFileName("pasted data");
            setTable(rows);
            setMapping(autoMapColumns(rows[0]!));
            setError(null);
            setStep("columns");
          }} />
          <p className="text-sm text-muted">
            Not sure about the format? Download the{" "}
            <a className="text-accent underline" href="/sinew-import-template.csv" download>template</a>, the{" "}
            <a className="text-accent underline" href="/sinew-import-example.csv" download>example (one row per exercise)</a> or the{" "}
            <a className="text-accent underline" href="/sinew-import-example-per-set.csv" download>example (one row per set)</a>.
          </p>
        </div>
      ) : null}

      {step === "columns" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            {fileName}: {dataRows.length} rows. Check which column holds what.
          </p>
          <div className="space-y-2">
            {IMPORT_FIELDS.map((f) => (
              <label key={f} className="block text-sm text-muted">
                {FIELD_LABELS[f]}
                <select className={select} value={mapping[f] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMapping((m) => {
                      const next = { ...m } as ColumnMapping;
                      if (v === "") delete next[f as ImportField];
                      else next[f as ImportField] = Number(v);
                      return next;
                    });
                  }}>
                  <option value="">— not in the file —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <label className="block text-sm text-muted">
            Dates like 03/04/2026 mean
            <select className={select} value={dateOrder} onChange={(e) => setDateOrder(e.target.value as DateOrder)}>
              <option value="dmy">3 April (day first)</option>
              <option value="mdy">4 March (month first)</option>
            </select>
          </label>
          {problems.map((p) => <p key={p} className="text-sm text-amber-500">{p}</p>)}
          {!problems.length ? (
            <p className="text-sm text-muted">
              Reads as {parsed.sessions.length} sessions
              {errorRows.length ? `, ${errorRows.length} rows will be skipped` : ""}.
            </p>
          ) : null}
          <button type="button" className={primary} disabled={problems.length > 0 || parsed.sessions.length === 0} onClick={toMatching}>
            Next: exercises
          </button>
        </div>
      ) : null}

      {step === "exercises" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Match the names in the file to your exercises. Choices are remembered as aliases for the next import.
          </p>
          <ul className="space-y-2">
            {names.map((n) => {
              const c = choices[n.key];
              const exact = matchExercise(n.name, exercises).kind === "exact";
              const value = !c ? "" : c.kind === "map" ? c.exerciseId : c.kind === "create" ? "__new" : "__skip";
              return (
                <li key={n.key} className="space-y-2 rounded-2xl border border-line bg-surface p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{n.name}</span>
                    <span className="tabular text-sm text-muted">{n.count}×{exact ? " · matched" : ""}</span>
                  </div>
                  <select className={select} value={value}
                    onChange={(e) => {
                      const v = e.target.value;
                      setChoices((cs) => ({
                        ...cs,
                        [n.key]: v === "__new" ? { kind: "create", name: n.name, hold: n.hold } : v === "__skip" ? { kind: "skip" } : { kind: "map", exerciseId: v },
                      }));
                    }}>
                    <option value="__new">Create new exercise “{n.name}”</option>
                    <option value="__skip">Skip this exercise</option>
                    {exercises.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}{e.archived ? " (retired)" : ""}</option>
                    ))}
                  </select>
                  {c?.kind === "create" ? (
                    <div className="flex items-center gap-2">
                      <input className={select} value={c.name} onChange={(e) => setChoices((cs) => ({ ...cs, [n.key]: { ...c, name: e.target.value } }))} />
                      <label className="flex shrink-0 items-center gap-1 text-sm">
                        <input type="checkbox" checked={c.hold} onChange={(e) => setChoices((cs) => ({ ...cs, [n.key]: { ...c, hold: e.target.checked } }))} />
                        Hold
                      </label>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="flex gap-2">
            <button type="button" className="h-12 rounded-xl border border-line px-4" onClick={() => setStep("columns")}>Back</button>
            <button type="button" className={primary} disabled={Object.values(choices).some((c) => c.kind === "create" && !c.name.trim())} onClick={() => setStep("preview")}>
              Next: preview
            </button>
          </div>
        </div>
      ) : null}

      {step === "preview" ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-lg font-semibold">
              {previewBuilt.length} sessions · {sets} sets
            </p>
            {dates.length ? <p className="tabular text-sm text-muted">{dates[0]} → {dates[dates.length - 1]}</p> : null}
            <p className="text-sm text-muted">
              {Object.values(choices).filter((c) => c.kind === "create").length} new exercises ·{" "}
              {Object.values(choices).filter((c) => c.kind === "skip").length} skipped
            </p>
          </div>

          {clash.size ? (
            <div className="space-y-2 rounded-2xl border border-amber-500 p-3">
              <p className="text-sm">{clash.size} of these dates already have a session.</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={policy === "skip"} onChange={() => setPolicy("skip")} /> Skip those dates (keep what is there)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={policy === "replace"} onChange={() => setPolicy("replace")} /> Replace them (undo brings them back)
              </label>
            </div>
          ) : null}

          {parsed.warnings.length ? (
            <details className="rounded-2xl border border-line bg-surface">
              <summary className="px-4 py-3 text-sm">
                {errorRows.length} rows skipped · {parsed.warnings.length - errorRows.length} warnings
              </summary>
              <ul className="space-y-1 border-t border-line px-4 py-3 text-sm">
                {parsed.warnings.slice(0, 60).map((w, i) => (
                  <li key={i} className={w.level === "error" ? "text-red-500" : "text-amber-500"}>
                    {w.line ? `Line ${w.line}: ` : ""}{w.message}
                  </li>
                ))}
                {parsed.warnings.length > 60 ? <li className="text-muted">…and {parsed.warnings.length - 60} more</li> : null}
              </ul>
            </details>
          ) : null}

          {progress ? <p className="text-sm text-muted">{progress}</p> : null}
          <div className="flex gap-2">
            <button type="button" disabled={busy} className="h-12 rounded-xl border border-line px-4" onClick={() => setStep("exercises")}>Back</button>
            <button type="button" className={primary} disabled={busy || previewBuilt.length === 0} onClick={() => void commit()}>
              {busy ? "Importing…" : `Import ${previewBuilt.length} sessions`}
            </button>
          </div>
          {!busy && batchId && error ? (
            <button type="button" className="h-11 rounded-xl border border-line px-4 text-sm text-red-500" onClick={() => void undo()}>
              Undo the partial import
            </button>
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

function PasteBox({ onText }: { onText: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <details className="rounded-2xl border border-line bg-surface">
      <summary className="px-4 py-3 text-sm">Or paste rows (with the header line)</summary>
      <div className="space-y-2 border-t border-line p-3">
        <textarea className="w-full rounded-xl border border-line bg-bg p-3 font-mono text-sm" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
        <button type="button" className="h-11 rounded-xl border border-line px-4 text-sm" disabled={!text.trim()} onClick={() => onText(text)}>
          Use pasted data
        </button>
      </div>
    </details>
  );
}
