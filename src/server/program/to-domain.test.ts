import { describe, expect, it } from "vitest";
import { SEED_EXERCISES, SEED_PROGRAM, SEED_TEMPLATES } from "@domain/program.seed";
import { buildSeedRows } from "./seed-rows";
import { toChains, toExercises, toProgram, toTemplates } from "./to-domain";

/** Simulates what Prisma returns after the seed rows are written. */
function asDbRows() {
  let n = 0;
  const rows = buildSeedRows("u1", () => `id${n++}`);
  const now = new Date();
  const chains = rows.chains.map((c) => ({
    ...c,
    createdAt: now,
    steps: rows.steps.filter((s) => s.chainId === c.id).sort((a, b) => a.order - b.order),
  }));
  const exercises = rows.exercises.map((e) => ({
    ...e,
    archivedAt: null,
    archivedReason: null,
    replacedById: null,
    createdAt: now,
    updatedAt: now,
  }));
  const templates = rows.templates.map((t) => ({
    ...t,
    createdAt: now,
    updatedAt: now,
    parts: rows.parts
      .filter((p) => p.templateId === t.id)
      .sort((a, b) => a.order - b.order)
      .map((p) => ({ ...p, items: rows.planned.filter((i) => i.partId === p.id).sort((a, b) => a.order - b.order) })),
  }));
  const program = { ...rows.program, createdAt: now, updatedAt: now, days: rows.days };
  return { rows, chains, exercises, templates, program };
}

describe("DB → domain mapping", () => {
  const db = asDbRows();
  const exercises = toExercises(db.exercises, db.chains);
  const templates = toTemplates(db.templates);
  const program = toProgram(db.program);
  const slugOf = new Map(db.rows.exercises.map((e, i) => [e.id, SEED_EXERCISES[i]!.id]));
  const templateSlug = new Map(db.rows.templates.map((t, i) => [t.id, SEED_TEMPLATES[i]!.id]));

  it("round-trips templates exactly (modulo ids)", () => {
    const restored = templates.map((t) => ({
      ...t,
      id: templateSlug.get(t.id),
      parts: t.parts.map(({ id: _pid, ...p }) => ({
        ...p,
        items: p.items.map(({ id: _id, ...i }) => ({
          ...i,
          exerciseId: slugOf.get(i.exerciseId),
          altExerciseIds: i.altExerciseIds?.map((a) => slugOf.get(a)),
        })),
      })),
    }));
    expect(JSON.parse(JSON.stringify(restored))).toEqual(JSON.parse(JSON.stringify(SEED_TEMPLATES)));
  });

  it("round-trips the week", () => {
    for (const d of [0, 1, 2, 3, 4, 5, 6] as const) {
      const id = program.week[d];
      expect(id ? templateSlug.get(id) : null).toBe(SEED_PROGRAM.week[d]);
    }
  });

  it("restores chain positions on exercises", () => {
    const chains = toChains(db.chains);
    const tfl = exercises.find((e) => e.name === "Tuck front lever")!;
    const chain = chains.find((c) => c.id === tfl.chain?.chainId)!;
    expect(chain.name).toBe("Front lever");
    expect(tfl.chain?.step).toBe("tuck");
    expect(exercises.every((e) => e.archived === false)).toBe(true);
  });
});
