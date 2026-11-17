/**
 * Domain types for Sinew. Pure TypeScript: no React, Next, Prisma or browser APIs.
 * A future native client (watchOS) mirrors these shapes against the same API.
 */

export type ExerciseKind = "reps" | "hold";
export type TargetUnit = "reps" | "sec";
export type PartKind = "pull" | "push" | "legs" | "core" | "other";
export type Side = "L" | "R";
export type Discomfort = "none" | "mild" | "pain";

/** ISO calendar date, `YYYY-MM-DD`. Sessions live on local calendar days. */
export type IsoDate = string;

/** 0 = Monday … 6 = Sunday (training-week order, not JS `getDay()`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ExerciseDef {
  id: string;
  name: string;
  kind: ExerciseKind;
  perSide: boolean;
  allowsWeight: boolean;
  allowsAssistance?: boolean;
  aliases?: string[];
  /** Position in a progression chain, e.g. { chainId: "planche", step: "tuck" } */
  chain?: { chainId: string; step: string };
  notes?: string;
  archived?: boolean;
}

export interface ProgressionChainDef {
  id: string;
  name: string;
  steps: string[];
}

export interface Target {
  /** Bottom of the program range (reps or seconds per set). */
  min: number;
  /** Top of the program range; absent for a fixed target like "3 × 3". */
  max?: number;
  unit: TargetUnit;
}

export interface PlannedExercise {
  /** DB id of the planned row (absent on seed data). Needed to edit targets. */
  id?: string;
  exerciseId: string;
  sets: number;
  target: Target;
  /**
   * Current per-set goal inside the range. Progression moves this up to `target.max`,
   * then adds a set and resets it to `target.min`. Defaults to `target.min`.
   */
  working?: number;
  /** Cap for set progression. Defaults to DEFAULT_MAX_SETS. */
  maxSets?: number;
  restSec?: number;
  /** Upper bound when the program gives a rest range ("2–3 min"). */
  restMaxSec?: number;
  altExerciseIds?: string[];
  notes?: string;
  supersetGroup?: string;
}

export interface TemplatePart {
  /** DB id (absent on seed data). Needed to add exercises. */
  id?: string;
  name: string;
  kind: PartKind;
  goal?: string;
  warmupKey?: WarmupKey;
  items: PlannedExercise[];
}

export interface SessionTemplate {
  id: string;
  name: string;
  parts: TemplatePart[];
}

export type WeekTemplate = Record<Weekday, string | null>;

export interface ProgramDef {
  id: string;
  name: string;
  week: WeekTemplate;
}

export type WarmupKey = "pull" | "push" | "legs" | "core";

export interface Warmup {
  key: WarmupKey;
  name: string;
  minutes?: number;
  steps: string[];
}

// ─── Logged data ─────────────────────────────────────────────────────────────

export interface Assistance {
  type: "band" | "machine";
  label?: string;
  kg?: number;
}

export interface LoggedSet {
  index: number;
  value: number;
  unit: TargetUnit;
  side?: Side;
  weightKg?: number;
  assistance?: Assistance;
  rir?: number;
  clean?: boolean;
  restActualSec?: number;
  note?: string;
  /** False while the set is only prefilled and not yet confirmed. */
  done: boolean;
}

export interface LoggedEntry {
  id: string;
  exerciseId: string;
  order: number;
  partName?: string;
  supersetGroup?: string;
  plannedSets?: number;
  plannedTarget?: Target;
  plannedWorking?: number;
  restSec?: number;
  breakAfterSec?: number;
  notes?: string;
  discomfort?: Discomfort;
  sets: LoggedSet[];
}

export interface LoggedSession {
  id: string;
  date: IsoDate;
  startedAt?: string;
  endedAt?: string;
  templateId?: string;
  title?: string;
  sessionNotes?: string;
  isDeload: boolean;
  source: "app" | "import";
  entries: LoggedEntry[];
  /** Live-session state (device only, not synced): the running rest timer. */
  rest?: RestTimer;
  /** Epoch ms of the last confirmed set, used to measure real rest and breaks. */
  lastSet?: { at: number; entryId: string };
}

export interface RestTimer {
  /** Epoch ms when the rest started. */
  startedAt: number;
  durationSec: number;
  /** Entry whose set started this rest. */
  entryId: string;
}
