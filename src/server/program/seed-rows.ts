/**
 * Turns the domain program seed into flat DB rows for one user.
 * Pure (ids are injected), so it is unit-tested without a database.
 */
import { normalizeExerciseName } from "@domain/exercise-matching";
import { SEED_CHAINS, SEED_EXERCISES, SEED_PROGRAM, SEED_TEMPLATES } from "@domain/program.seed";
import type { ExerciseDef, ProgramDef, ProgressionChainDef, SessionTemplate, Weekday } from "@domain/types";

export interface SeedInput {
  chains: ProgressionChainDef[];
  exercises: ExerciseDef[];
  templates: SessionTemplate[];
  program: ProgramDef;
}

export const DEFAULT_SEED: SeedInput = {
  chains: SEED_CHAINS,
  exercises: SEED_EXERCISES,
  templates: SEED_TEMPLATES,
  program: SEED_PROGRAM,
};

export function buildSeedRows(userId: string, newId: () => string, input: SeedInput = DEFAULT_SEED) {
  const chainIds = new Map<string, string>();
  const stepIds = new Map<string, string>(); // `${chainSlug}:${step}` → id
  const exerciseIds = new Map<string, string>();
  const templateIds = new Map<string, string>();

  const chains = input.chains.map((c) => {
    const id = newId();
    chainIds.set(c.id, id);
    return { id, userId, name: c.name };
  });

  for (const ex of input.exercises) exerciseIds.set(ex.id, newId());

  // A step points at the exercise that performs it (e.g. planche "tuck" → Tuck planche)
  const stepExercise = new Map<string, string>();
  for (const ex of input.exercises) {
    if (ex.chain) stepExercise.set(`${ex.chain.chainId}:${ex.chain.step}`, exerciseIds.get(ex.id)!);
  }

  const steps = input.chains.flatMap((c) =>
    c.steps.map((label, order) => {
      const id = newId();
      const key = `${c.id}:${label}`;
      stepIds.set(key, id);
      return { id, chainId: chainIds.get(c.id)!, order, label, exerciseId: stepExercise.get(key) ?? null };
    }),
  );

  const exercises = input.exercises.map((ex) => ({
    id: exerciseIds.get(ex.id)!,
    userId,
    name: ex.name,
    normalizedName: normalizeExerciseName(ex.name),
    aliases: ex.aliases ?? [],
    kind: ex.kind,
    perSide: ex.perSide,
    allowsWeight: ex.allowsWeight,
    allowsAssistance: ex.allowsAssistance ?? false,
    progressionChainId: ex.chain ? (chainIds.get(ex.chain.chainId) ?? null) : null,
    notes: ex.notes ?? null,
  }));

  const templates = input.templates.map((t) => {
    const id = newId();
    templateIds.set(t.id, id);
    return { id, userId, name: t.name };
  });

  const parts: {
    id: string;
    templateId: string;
    order: number;
    name: string;
    kind: SessionTemplate["parts"][number]["kind"];
    goal: string | null;
    warmupKey: string | null;
  }[] = [];
  const planned: {
    id: string;
    partId: string;
    order: number;
    exerciseId: string;
    altExerciseId: string | null;
    sets: number;
    targetMin: number;
    targetMax: number | null;
    targetUnit: "reps" | "sec";
    workingTarget: number | null;
    maxSets: number | null;
    restSec: number | null;
    restMaxSec: number | null;
    notes: string | null;
    supersetGroup: string | null;
  }[] = [];

  for (const t of input.templates) {
    t.parts.forEach((part, partOrder) => {
      const partId = newId();
      parts.push({
        id: partId,
        templateId: templateIds.get(t.id)!,
        order: partOrder,
        name: part.name,
        kind: part.kind,
        goal: part.goal ?? null,
        warmupKey: part.warmupKey ?? null,
      });
      part.items.forEach((p, order) => {
        const exerciseId = exerciseIds.get(p.exerciseId);
        if (!exerciseId) throw new Error(`Seed references unknown exercise "${p.exerciseId}"`);
        const alt = p.altExerciseIds?.[0];
        planned.push({
          id: newId(),
          partId,
          order,
          exerciseId,
          altExerciseId: alt ? (exerciseIds.get(alt) ?? null) : null,
          sets: p.sets,
          targetMin: p.target.min,
          targetMax: p.target.max ?? null,
          targetUnit: p.target.unit,
          workingTarget: p.working ?? null,
          maxSets: p.maxSets ?? null,
          restSec: p.restSec ?? null,
          restMaxSec: p.restMaxSec ?? null,
          notes: p.notes ?? null,
          supersetGroup: p.supersetGroup ?? null,
        });
      });
    });
  }

  const programId = newId();
  const program = { id: programId, userId, name: input.program.name, active: true };
  const days = ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((weekday) => {
    const slug = input.program.week[weekday];
    return { id: newId(), programId, weekday, templateId: slug ? (templateIds.get(slug) ?? null) : null };
  });

  return { chains, steps, exercises, templates, parts, planned, program, days };
}
