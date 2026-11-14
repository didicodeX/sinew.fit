import { describe, expect, it } from "vitest";
import { buildSeedRows } from "./seed-rows";

const counter = () => {
  let n = 0;
  return () => `id${n++}`;
};

describe("buildSeedRows", () => {
  const rows = buildSeedRows("u1", counter());

  it("owns every top-level row by the user", () => {
    for (const r of [...rows.chains, ...rows.exercises, ...rows.templates, rows.program]) expect(r.userId).toBe("u1");
  });

  it("produces unique ids", () => {
    const all = [
      ...rows.chains,
      ...rows.steps,
      ...rows.exercises,
      ...rows.templates,
      ...rows.parts,
      ...rows.planned,
      rows.program,
      ...rows.days,
    ].map((r) => r.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it("resolves every foreign key inside the batch", () => {
    const ids = (xs: { id: string }[]) => new Set(xs.map((x) => x.id));
    const ex = ids(rows.exercises);
    const parts = ids(rows.parts);
    const tpl = ids(rows.templates);
    const chains = ids(rows.chains);
    for (const p of rows.planned) {
      expect(ex).toContain(p.exerciseId);
      expect(parts).toContain(p.partId);
      if (p.altExerciseId) expect(ex).toContain(p.altExerciseId);
    }
    for (const p of rows.parts) expect(tpl).toContain(p.templateId);
    for (const s of rows.steps) {
      expect(chains).toContain(s.chainId);
      if (s.exerciseId) expect(ex).toContain(s.exerciseId);
    }
  });

  it("maps the week with Sunday as rest", () => {
    expect(rows.days).toHaveLength(7);
    expect(rows.days.filter((d) => d.templateId === null).map((d) => d.weekday)).toEqual([6]);
  });

  it("links chain steps to the exercise that performs them", () => {
    const tuckPlanche = rows.exercises.find((e) => e.name === "Tuck planche")!;
    const step = rows.steps.find((s) => s.exerciseId === tuckPlanche.id)!;
    expect(step.label).toBe("tuck");
  });
});
