import { describe, expect, it } from "vitest";
import { SEED_CHAINS, SEED_EXERCISES } from "../program.seed";
import { formatSetsCompact, lastTimeByExercise, suggestProgression } from "../progression";
import type { LoggedEntry, LoggedSet, PlannedExercise } from "../types";

const sets = (values: number[], extra: Partial<LoggedSet> = {}): LoggedSet[] =>
  values.map((value, index) => ({ index, value, unit: "reps", done: true, clean: true, rir: 2, ...extra }));
const entry = (s: LoggedSet[], exerciseId = "x"): LoggedEntry => ({ id: "e", exerciseId, order: 0, sets: s });

const planned: PlannedExercise = { exerciseId: "x", sets: 3, target: { min: 5, max: 6, unit: "reps" } };

describe("suggestProgression (reps first, then sets)", () => {
  it("adds a rep when every set was clean with reserve", () => {
    const s = suggestProgression(planned, [entry(sets([5, 5, 5]))]);
    expect(s).toMatchObject({ kind: "more_reps", to: { sets: 3, working: 6 } });
  });

  it("adds a set and resets reps at the top of the range (5×3 → 6×3 → 5×4)", () => {
    const s = suggestProgression({ ...planned, working: 6 }, [entry(sets([6, 6, 6]))]);
    expect(s).toMatchObject({ kind: "more_sets", to: { sets: 4, working: 5 } });
  });

  it("holds when a set was not clean, short, or too close to failure", () => {
    expect(suggestProgression(planned, [entry(sets([5, 5, 4]))]).kind).toBe("none");
    expect(suggestProgression(planned, [entry(sets([5, 5, 5], { clean: false }))]).kind).toBe("none");
    expect(suggestProgression(planned, [entry(sets([5, 5, 5], { rir: 0 }))]).kind).toBe("none");
    expect(suggestProgression(planned, [entry(sets([5, 5]))]).kind).toBe("none");
  });

  it("never progresses in a deload week", () => {
    expect(suggestProgression(planned, [entry(sets([5, 5, 5]))], { isDeloadWeek: true }).kind).toBe("none");
  });

  it("steps holds by 2 s", () => {
    const hold: PlannedExercise = { exerciseId: "tuck-front-lever", sets: 4, target: { min: 8, max: 12, unit: "sec" } };
    const s = suggestProgression(hold, [entry(sets([8, 8, 9, 8], { unit: "sec" }))]);
    expect(s).toMatchObject({ kind: "more_reps", to: { working: 10 } });
  });

  it("suggests the next variation after two sessions at the top of the range", () => {
    const tfl = SEED_EXERCISES.find((e) => e.id === "tuck-front-lever")!;
    const hold: PlannedExercise = {
      exerciseId: tfl.id,
      sets: 4,
      target: { min: 8, max: 12, unit: "sec" },
      working: 12,
    };
    const top = entry(sets([12, 12, 12, 12], { unit: "sec" }));
    const one = suggestProgression(hold, [top], { exercise: tfl, chains: SEED_CHAINS });
    expect(one.kind).toBe("more_sets");
    const two = suggestProgression(hold, [top, top], { exercise: tfl, chains: SEED_CHAINS });
    expect(two).toMatchObject({ kind: "next_variation", fromStep: "tuck", toStep: "advanced tuck" });
  });

  it("uses the weaker side for per-side exercises", () => {
    const sided: LoggedSet[] = [...sets([5, 5, 5], { side: "L" }), ...sets([5, 4, 5], { side: "R" })];
    expect(suggestProgression(planned, [entry(sided)]).kind).toBe("none");
  });
});

describe("last time", () => {
  it("finds the most recent done entry per exercise", () => {
    const m = lastTimeByExercise([
      { date: "2027-02-01", entries: [entry(sets([4, 4, 4]), "a")] },
      { date: "2027-02-08", entries: [entry(sets([5, 5, 4]), "a")] },
      { date: "2027-02-10", entries: [entry(sets([5]).map((s) => ({ ...s, done: false })), "a")] },
    ]);
    expect(m.get("a")?.date).toBe("2027-02-08");
    expect(formatSetsCompact(m.get("a")!.entry.sets)).toBe("5 5 4");
  });
  it("formats per-side and weighted sets", () => {
    expect(formatSetsCompact([...sets([6, 6], { side: "L" }), ...sets([6, 5], { side: "R" })])).toBe("L 6 6 / R 6 5");
    expect(formatSetsCompact(sets([8, 8], { weightKg: 20 }))).toBe("8@20kg 8@20kg");
  });
});
