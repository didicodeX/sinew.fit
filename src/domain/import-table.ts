/**
 * Spreadsheet / CSV import, pure part (brief §6.2-6.3): CSV parsing, header auto-mapping,
 * and grouping rows into sessions. Both layouts are supported:
 *  - row per exercise ("5 5 5" in one cell), closest to the notebook
 *  - row per set (set number + value)
 * Exercise names stay unresolved here; matching happens in the wizard.
 */
import { isValidIsoDate } from "./dates";
import { clockDurationMinutes, extractWeightKg, parseClockTime, parseRest, parseValueList } from "./parse";
import { clockToIso } from "./quick-entry";
import type { ExerciseDef, IsoDate, LoggedEntry, LoggedSession } from "./types";

// ─── CSV ────────────────────────────────────────────────────────────────────

function detectDelimiter(firstLine: string): string {
  const count = (c: string) => firstLine.split(c).length - 1;
  const best = [",", ";", "\t"].map((c) => [c, count(c)] as const).sort((a, b) => b[1] - a[1])[0]!;
  return best[1] > 0 ? best[0] : ",";
}

/** RFC 4180-ish: quoted cells, doubled quotes, CRLF, BOM. Delimiter is detected from the header line. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const delimiter = detectDelimiter(src.split(/\r?\n/, 1)[0] ?? "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// ─── Column mapping ─────────────────────────────────────────────────────────

export const IMPORT_FIELDS = [
  "date",
  "start",
  "end",
  "exercise",
  "reps",
  "setNumber",
  "value",
  "unit",
  "weightKg",
  "rest",
  "breakAfter",
  "notes",
  "sessionNotes",
  "superset",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const FIELD_LABELS: Record<ImportField, string> = {
  date: "Date",
  start: "Start time",
  end: "End time",
  exercise: "Exercise",
  reps: "Reps / seconds (one cell, e.g. 5 5 5)",
  setNumber: "Set number",
  value: "Value (one set)",
  unit: "Unit (reps / sec)",
  weightKg: "Weight (kg)",
  rest: "Rest",
  breakAfter: "Break",
  notes: "Exercise notes",
  sessionNotes: "Session notes",
  superset: "Superset",
};

/** Header (lowercased, letters and digits only) → field. */
const HEADER_ALIASES: Record<string, ImportField> = {
  date: "date",
  day: "date",
  start: "start",
  starttime: "start",
  end: "end",
  endtime: "end",
  exercise: "exercise",
  exercisename: "exercise",
  movement: "exercise",
  name: "exercise",
  reps: "reps",
  repsperset: "reps",
  values: "reps",
  setnumber: "setNumber",
  setno: "setNumber",
  set: "setNumber",
  setindex: "setNumber",
  value: "value",
  count: "value",
  unit: "unit",
  weightkg: "weightKg",
  weight: "weightKg",
  load: "weightKg",
  kg: "weightKg",
  rest: "rest",
  restinterval: "rest",
  restsec: "rest",
  restseconds: "rest",
  break: "breakAfter",
  breakafter: "breakAfter",
  notes: "notes",
  note: "notes",
  comment: "notes",
  comments: "notes",
  sessionnotes: "sessionNotes",
  sessionnote: "sessionNotes",
  superset: "superset",
  ss: "superset",
};

/** Field → column index. Missing fields are simply absent. */
export type ColumnMapping = Partial<Record<ImportField, number>>;

const headerKey = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  headers.forEach((h, i) => {
    const field = HEADER_ALIASES[headerKey(h)];
    if (field && mapping[field] === undefined) mapping[field] = i;
  });
  return mapping;
}

export type ImportLayout = "per-exercise" | "per-set";

export function detectLayout(mapping: ColumnMapping): ImportLayout {
  return mapping.value !== undefined && mapping.reps === undefined ? "per-set" : "per-exercise";
}

/** What is missing before the file can be read (empty = ready). */
export function mappingProblems(mapping: ColumnMapping): string[] {
  const out: string[] = [];
  if (mapping.date === undefined) out.push("Choose the date column");
  if (mapping.exercise === undefined) out.push("Choose the exercise column");
  if (mapping.reps === undefined && mapping.value === undefined) out.push("Choose the reps column (or the value column)");
  return out;
}

// ─── Dates ──────────────────────────────────────────────────────────────────

export type DateOrder = "dmy" | "mdy";

/** `2026-10-22`, `22/10/2026`, `22-10-2026`, `22.10.26`. Returns null when it is not a real date. */
export function parseImportDate(raw: string, order: DateOrder = "dmy"): IsoDate | null {
  const s = raw.trim();
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(s);
  let y: number, m: number, d: number;
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else {
    const loc = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s);
    if (!loc) return null;
    const [a, b] = [Number(loc[1]), Number(loc[2])];
    [d, m] = order === "dmy" ? [a, b] : [b, a];
    y = loc[3]!.length === 2 ? 2000 + Number(loc[3]) : Number(loc[3]);
  }
  const out = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return isValidIsoDate(out) ? out : null;
}

// ─── Rows → sessions ────────────────────────────────────────────────────────

export interface ParsedSet {
  value: number;
  weightKg?: number;
  restSec?: number;
}

export interface ParsedBlock {
  sourceName: string;
  sets: ParsedSet[];
  /** Only when the file says so; otherwise inferred from the exercise. */
  unit?: "reps" | "sec";
  restSec?: number;
  restMaxSec?: number;
  breakSec?: number;
  notes?: string;
  superset?: string;
  /** 1-based line in the file, for warnings. */
  line: number;
}

export interface ParsedSession {
  date: IsoDate;
  start?: string;
  end?: string;
  sessionNotes?: string;
  blocks: ParsedBlock[];
}

export interface ImportWarning {
  line?: number;
  message: string;
  /** "error" rows were skipped; "warn" rows were kept. */
  level: "error" | "warn";
}

export interface ParsedImport {
  layout: ImportLayout;
  sessions: ParsedSession[];
  warnings: ImportWarning[];
  rowsRead: number;
}

const cellAt = (row: string[], i: number | undefined) => (i === undefined ? "" : (row[i] ?? "").trim());

function parseUnit(raw: string): "reps" | "sec" | undefined {
  const s = raw.toLowerCase();
  if (/^(sec|secs|s|second|seconds)$/.test(s)) return "sec";
  if (/^(rep|reps)$/.test(s)) return "reps";
  return undefined;
}

function parseWeight(raw: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw.replace(",", ".").replace(/kg/i, "").trim());
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Read data rows (header row already removed) into sessions. Rows that cannot be read are
 * skipped with an "error" warning; suspicious but readable ones keep a "warn".
 */
export function parseImportRows(
  dataRows: string[][],
  mapping: ColumnMapping,
  opts: { dateOrder?: DateOrder; firstLine?: number } = {},
): ParsedImport {
  const layout = detectLayout(mapping);
  const dateOrder = opts.dateOrder ?? "dmy";
  const firstLine = opts.firstLine ?? 2;
  const warnings: ImportWarning[] = [];
  const sessions = new Map<string, ParsedSession>();
  let lastDate: IsoDate | null = null;
  let lastStart = "";

  dataRows.forEach((row, idx) => {
    const line = firstLine + idx;
    const err = (message: string) => warnings.push({ line, message, level: "error" });
    const warn = (message: string) => warnings.push({ line, message, level: "warn" });

    const name = cellAt(row, mapping.exercise);
    if (!name) return err("No exercise name");

    // A blank date repeats the previous row's date (common in hand-made sheets)
    const rawDate = cellAt(row, mapping.date);
    const date = rawDate ? parseImportDate(rawDate, dateOrder) : lastDate;
    if (!date) return err(rawDate ? `Date "${rawDate}" not understood` : "No date");
    lastDate = date;

    const start = cellAt(row, mapping.start) || (rawDate ? "" : lastStart);
    lastStart = start;
    const end = cellAt(row, mapping.end);
    if (start && parseClockTime(start) === null) warn(`Start "${start}" is not a time`);
    if (end && parseClockTime(end) === null) warn(`End "${end}" is not a time`);

    const unitCell = cellAt(row, mapping.unit);
    const unit = parseUnit(unitCell);
    if (unitCell && !unit) warn(`Unit "${unitCell}" not understood (use reps or sec)`);

    let sets: ParsedSet[];
    if (layout === "per-exercise") {
      const parsed = parseValueList(cellAt(row, mapping.reps), unit ?? "reps");
      const bad = parsed.warnings.filter((w) => w.code === "unparseable" || w.code === "empty");
      if (bad.length) return err(bad[0]!.message === "No values" ? "No reps" : bad[0]!.message);
      for (const w of parsed.warnings) if (w.code !== "unparseable" && w.code !== "empty") warn(w.message);
      const weight = parseWeight(cellAt(row, mapping.weightKg));
      sets = parsed.values.map((value) => ({ value, ...(weight !== undefined ? { weightKg: weight } : {}) }));
    } else {
      const parsed = parseValueList(cellAt(row, mapping.value), unit ?? "reps");
      if (parsed.values.length !== 1) return err(`Expected one value, got "${cellAt(row, mapping.value)}"`);
      for (const w of parsed.warnings) warn(w.message);
      const weight = parseWeight(cellAt(row, mapping.weightKg));
      const rest = cellAt(row, mapping.rest) ? parseRest(cellAt(row, mapping.rest)) : null;
      sets = [
        {
          value: parsed.values[0]!,
          ...(weight !== undefined ? { weightKg: weight } : {}),
          ...(rest ? { restSec: rest.sec } : {}),
        },
      ];
    }

    const key = `${date}|${start}`;
    let session = sessions.get(key);
    if (!session) {
      session = { date, blocks: [] };
      sessions.set(key, session);
    }
    if (start && !session.start) session.start = start;
    if (end && !session.end) session.end = end;
    const sNotes = cellAt(row, mapping.sessionNotes);
    if (sNotes && !session.sessionNotes) session.sessionNotes = sNotes;

    if (layout === "per-set") {
      // Consecutive rows of the same exercise are one block (sets sorted by set number if given)
      const last = session.blocks[session.blocks.length - 1];
      if (last && last.sourceName === name) {
        last.sets.push(...sets);
        return;
      }
    } else if (session.blocks.some((b) => b.sourceName.toLowerCase() === name.toLowerCase())) {
      warn(`"${name}" appears twice on ${date}`);
    }

    const rest = layout === "per-exercise" && cellAt(row, mapping.rest) ? parseRest(cellAt(row, mapping.rest)) : null;
    if (layout === "per-exercise" && cellAt(row, mapping.rest) && !rest) warn(`Rest "${cellAt(row, mapping.rest)}" not understood`);
    const brk = cellAt(row, mapping.breakAfter) ? parseRest(cellAt(row, mapping.breakAfter)) : null;
    if (cellAt(row, mapping.breakAfter) && !brk) warn(`Break "${cellAt(row, mapping.breakAfter)}" not understood`);

    session.blocks.push({
      sourceName: name,
      sets,
      unit,
      restSec: rest?.sec,
      restMaxSec: rest?.maxSec,
      breakSec: brk?.sec,
      notes: cellAt(row, mapping.notes) || undefined,
      superset: cellAt(row, mapping.superset).slice(0, 4).toUpperCase() || undefined,
      line,
    });
  });

  // Whole-session checks
  const out = [...sessions.values()];
  for (const s of out) {
    if (s.start && s.end) {
      const a = parseClockTime(s.start);
      const b = parseClockTime(s.end);
      if (a !== null && b !== null && b < a) warnings.push({ message: `${s.date}: end is before start`, level: "warn" });
    }
    for (const b of s.blocks) {
      if (b.sets.length > 20) warnings.push({ line: b.line, message: `${b.sourceName}: ${b.sets.length} sets looks implausible`, level: "warn" });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? ""));
  return { layout, sessions: out, warnings, rowsRead: dataRows.length };
}

// ─── Parsed sessions → logged sessions ──────────────────────────────────────

export interface BuiltImport {
  session: LoggedSession;
  setCount: number;
}

/**
 * Turn parsed sessions into logged ones. `resolve` maps a source name to a library exercise id,
 * or null to skip that exercise. Sessions left with no exercise are dropped.
 */
export function buildImportedSessions(
  parsed: ParsedSession[],
  resolve: (sourceName: string) => string | null,
  exercises: ExerciseDef[],
  newId: () => string,
): BuiltImport[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const out: BuiltImport[] = [];
  for (const p of parsed) {
    const entries: LoggedEntry[] = [];
    let setCount = 0;
    for (const b of p.blocks) {
      const exId = resolve(b.sourceName);
      const ex = exId ? byId.get(exId) : undefined;
      if (!ex) continue;
      const unit = b.unit ?? (ex.kind === "hold" ? "sec" : "reps");
      const noteWeight = ex.allowsWeight ? extractWeightKg(b.notes ?? "") : null;
      const firstRest = b.restSec ?? b.sets.find((s) => s.restSec !== undefined)?.restSec;
      entries.push({
        id: newId(),
        exerciseId: ex.id,
        order: entries.length,
        supersetGroup: b.superset,
        restSec: firstRest,
        breakAfterSec: b.breakSec,
        notes: b.notes?.slice(0, 2000),
        sets: b.sets.slice(0, 100).map((s, index) => {
          const weight = s.weightKg ?? noteWeight ?? undefined;
          return {
            index,
            value: Math.min(Math.max(Math.round(s.value), 0), 999),
            unit,
            ...(weight !== undefined && Math.abs(weight) <= 500 ? { weightKg: weight } : {}),
            done: true,
          };
        }),
      });
      setCount += Math.min(b.sets.length, 100);
    }
    if (entries.length === 0) continue;
    const timesOk = p.start && p.end && clockDurationMinutes(p.start, p.end) !== null;
    out.push({
      setCount,
      session: {
        id: newId(),
        date: p.date,
        startedAt: timesOk ? clockToIso(p.date, p.start!) : undefined,
        endedAt: timesOk ? clockToIso(p.date, p.end!) : undefined,
        sessionNotes: p.sessionNotes?.slice(0, 5000),
        isDeload: false,
        source: "import",
        entries: entries.slice(0, 60),
      },
    });
  }
  return out;
}
