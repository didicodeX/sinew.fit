import { describe, expect, it } from "vitest";
import { SEED_EXERCISES, SEED_PROGRAM, SEED_TEMPLATES } from "../program.seed";
import { deloadSets, formatRest, formatTarget, generateSession, isDeloadWeek, templateForDate } from "../session";

const ids = () => {
  let n = 0;
  return () => `e${n++}`;
};

describe("templateForDate", () => {
  it("maps weekdays to the weekly template", () => {
    expect(templateForDate("2027-02-01", SEED_PROGRAM, SEED_TEMPLATES)?.id).toBe("push-a-legs-a");
    expect(templateForDate("2027-02-04", SEED_PROGRAM, SEED_TEMPLATES)?.id).toBe("pull-b-core-b");
    expect(templateForDate("2027-02-07", SEED_PROGRAM, SEED_TEMPLATES)).toBeNull();
  });
});

describe("generateSession", () => {
  const pullB = SEED_TEMPLATES.find((t) => t.id === "pull-b-core-b")!;

  it("prefills every set from the template, in order", () => {
    const s = generateSession(pullB, SEED_EXERCISES, { date: "2027-02-04", sessionId: "s1", newId: ids() });
    expect(s.entries.map((e) => e.exerciseId)).toEqual([
      "tuck-front-lever",
      "strict-pull-ups",
      "inverted-rows-elevated",
      "face-pulls",
      "l-sit",
      "negative-dragon-flag-bent",
      "compression-lifts",
      "hollow-body-rocks",
    ]);
    const tfl = s.entries[0]!;
    expect(tfl.sets).toHaveLength(4);
    expect(tfl.sets.every((x) => x.value === 8 && x.unit === "sec" && !x.done)).toBe(true);
    expect(tfl.restSec).toBe(180);
    expect(tfl.partName).toMatch(/^Pull B/);
  });

  it("creates L/R sets for per-side exercises", () => {
    const legsA = SEED_TEMPLATES.find((t) => t.id === "push-a-legs-a")!;
    const s = generateSession(legsA, SEED_EXERCISES, { date: "2027-02-01", sessionId: "s", newId: ids() });
    const pistol = s.entries.find((e) => e.exerciseId === "pistol-squat")!;
    expect(pistol.sets).toHaveLength(8);
    expect(pistol.sets.filter((x) => x.side === "L")).toHaveLength(4);
  });

  it("copies planned targets so later edits never rewrite history", () => {
    const tpl = structuredClone(pullB);
    const s = generateSession(tpl, SEED_EXERCISES, { date: "2027-02-04", sessionId: "s", newId: ids() });
    tpl.parts[0]!.items[0]!.target.min = 99;
    expect(s.entries[0]!.plannedTarget?.min).toBe(8);
  });

  it("applies deload: −1 set on 3+ set exercises", () => {
    const s = generateSession(pullB, SEED_EXERCISES, {
      date: "2027-02-04",
      sessionId: "s",
      newId: ids(),
      isDeload: true,
    });
    expect(s.isDeload).toBe(true);
    expect(s.entries[0]!.plannedSets).toBe(3);
    expect(s.entries[0]!.sets).toHaveLength(3);
    expect(deloadSets(2)).toBe(2);
  });
});

describe("isDeloadWeek", () => {
  const settings = { enabled: true, everyWeeks: 4, anchorWeek: "2027-02-01" };
  it("flags every 4th week", () => {
    expect(isDeloadWeek("2027-02-01", settings)).toBe(false);
    expect(isDeloadWeek("2027-02-22", settings)).toBe(true); // week 4
    expect(isDeloadWeek("2027-02-28", settings)).toBe(true);
    expect(isDeloadWeek("2027-03-01", settings)).toBe(false);
    expect(isDeloadWeek("2027-03-22", settings)).toBe(true); // week 8
  });
  it("can be turned off", () => {
    expect(isDeloadWeek("2027-02-22", { ...settings, enabled: false })).toBe(false);
  });
});

describe("formatting", () => {
  it("formats targets and rest", () => {
    expect(formatTarget({ sets: 4, target: { min: 10, max: 15, unit: "sec" } })).toBe("4 × 10–15 s");
    expect(formatTarget({ sets: 3, target: { min: 3, unit: "reps" } })).toBe("3 × 3");
    expect(formatRest(120, 180)).toBe("2–3 min");
    expect(formatRest(90)).toBe("90 s");
    expect(formatRest(180)).toBe("3 min");
  });
});
