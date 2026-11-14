import { describe, expect, it } from "vitest";
import { SEED_CHAINS, SEED_EXERCISES, SEED_PROGRAM, SEED_TEMPLATES } from "../program.seed";
import { normalizeExerciseName } from "../exercise-matching";

describe("program seed", () => {
  const exIds = new Set(SEED_EXERCISES.map((e) => e.id));

  it("references only known exercises", () => {
    for (const t of SEED_TEMPLATES)
      for (const part of t.parts)
        for (const p of part.items) {
          expect(exIds, `${t.id} → ${p.exerciseId}`).toContain(p.exerciseId);
          for (const alt of p.altExerciseIds ?? []) expect(exIds).toContain(alt);
        }
  });

  it("has unique exercise ids and normalised names", () => {
    expect(exIds.size).toBe(SEED_EXERCISES.length);
    const names = SEED_EXERCISES.map((e) => normalizeExerciseName(e.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it("chain steps exist on their chain", () => {
    for (const e of SEED_EXERCISES) {
      if (!e.chain) continue;
      const chain = SEED_CHAINS.find((c) => c.id === e.chain!.chainId);
      expect(chain, e.id).toBeDefined();
      expect(chain!.steps).toContain(e.chain.step);
    }
  });

  it("maps Monday–Saturday to sessions and Sunday to rest", () => {
    const ids = new Set(SEED_TEMPLATES.map((t) => t.id));
    for (const d of [0, 1, 2, 3, 4, 5] as const) expect(ids).toContain(SEED_PROGRAM.week[d]);
    expect(SEED_PROGRAM.week[6]).toBeNull();
  });

  it("uses seconds for holds and reps otherwise", () => {
    const byId = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
    for (const t of SEED_TEMPLATES)
      for (const part of t.parts)
        for (const p of part.items) {
          const kind = byId.get(p.exerciseId)!.kind;
          expect(p.target.unit, p.exerciseId).toBe(kind === "hold" ? "sec" : "reps");
        }
  });

  it("encodes Pull A as in the brief", () => {
    const pullA = SEED_TEMPLATES.find((t) => t.id === "pull-a-core-a")!.parts[0]!;
    expect(pullA.items.map((i) => [i.exerciseId, i.sets, i.target.min, i.target.max])).toEqual([
      ["high-pull-ups", 4, 3, 5],
      ["band-assisted-muscle-up", 3, 3, 5],
      ["tuck-front-lever", 4, 8, 12],
      ["front-lever-rows", 3, 6, 10],
    ]);
  });
});
