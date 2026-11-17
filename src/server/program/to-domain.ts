/**
 * Maps DB rows (Prisma) to domain shapes, so UI and domain logic never depend on Prisma.
 * Pure: unit-tested with plain objects.
 */
import type { Prisma } from "@prisma/client";
import type {
  ExerciseDef,
  PlannedExercise,
  ProgramDef,
  ProgressionChainDef,
  SessionTemplate,
  WarmupKey,
  Weekday,
  WeekTemplate,
} from "@domain/types";

export const templateInclude = {
  parts: { orderBy: { order: "asc" }, include: { items: { orderBy: { order: "asc" } } } },
} satisfies Prisma.SessionTemplateInclude;

export const chainInclude = {
  steps: { orderBy: { order: "asc" } },
} satisfies Prisma.ProgressionChainInclude;

type TemplateRow = Prisma.SessionTemplateGetPayload<{ include: typeof templateInclude }>;
type ChainRow = Prisma.ProgressionChainGetPayload<{ include: typeof chainInclude }>;
type ExerciseRow = Prisma.ExerciseGetPayload<object>;
type ProgramRow = Prisma.ProgramGetPayload<{ include: { days: true } }>;

const WARMUP_KEYS = new Set<string>(["pull", "push", "legs", "core"]);
const opt = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

export function toChains(rows: ChainRow[]): ProgressionChainDef[] {
  return rows.map((c) => ({ id: c.id, name: c.name, steps: c.steps.map((s) => s.label) }));
}

export function toExercises(rows: ExerciseRow[], chains: ChainRow[]): ExerciseDef[] {
  // An exercise's position in a chain is the step that points at it
  const stepOf = new Map<string, { chainId: string; step: string }>();
  for (const c of chains) for (const s of c.steps) if (s.exerciseId) stepOf.set(s.exerciseId, { chainId: c.id, step: s.label });

  return rows.map((e) => ({
    id: e.id,
    name: e.name,
    kind: e.kind,
    perSide: e.perSide,
    allowsWeight: e.allowsWeight,
    allowsAssistance: e.allowsAssistance,
    aliases: e.aliases,
    ...(stepOf.get(e.id) ? { chain: stepOf.get(e.id) } : {}),
    notes: opt(e.notes),
    archived: e.archivedAt !== null,
  }));
}

export function toTemplates(rows: TemplateRow[]): SessionTemplate[] {
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    parts: t.parts.map((p) => ({
      name: p.name,
      kind: p.kind,
      goal: opt(p.goal),
      warmupKey: p.warmupKey && WARMUP_KEYS.has(p.warmupKey) ? (p.warmupKey as WarmupKey) : undefined,
      items: p.items.map(
        (i): PlannedExercise => ({
          id: i.id,
          exerciseId: i.exerciseId,
          sets: i.sets,
          target: { min: i.targetMin, max: opt(i.targetMax), unit: i.targetUnit },
          working: opt(i.workingTarget),
          maxSets: opt(i.maxSets),
          restSec: opt(i.restSec),
          restMaxSec: opt(i.restMaxSec),
          altExerciseIds: i.altExerciseId ? [i.altExerciseId] : undefined,
          notes: opt(i.notes),
          supersetGroup: opt(i.supersetGroup),
        }),
      ),
    })),
  }));
}

export function toProgram(row: ProgramRow): ProgramDef {
  const week = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null } as WeekTemplate;
  for (const d of row.days) {
    if (d.weekday >= 0 && d.weekday <= 6) week[d.weekday as Weekday] = d.templateId;
  }
  return { id: row.id, name: row.name, week };
}
