import { describe, expect, it } from "vitest";
import { matchExercise, normalizeExerciseName, searchExercises } from "../exercise-matching";
import { SEED_EXERCISES } from "../program.seed";
import type { ExerciseDef } from "../types";

describe("normalizeExerciseName", () => {
  it("merges spelling variants", () => {
    const variants = ["Pull ups", "Pull-ups", "pullups", "PULL-UP", "Pullup"];
    const n = new Set(variants.map(normalizeExerciseName));
    expect(n.size).toBe(1);
    expect([...n][0]).toBe("pull up");
  });
  it("keeps non-plural s words", () => {
    expect(normalizeExerciseName("Bench press")).toBe("bench press");
    expect(normalizeExerciseName("Calf raises")).toBe("calf raise");
    expect(normalizeExerciseName("Triceps extensions")).toBe("triceps extension");
  });
});

describe("matchExercise", () => {
  const lib: ExerciseDef[] = [
    ...SEED_EXERCISES,
    { id: "pull-ups", name: "Pull-ups", kind: "reps", perSide: false, allowsWeight: true },
  ];

  it("matches exact names and aliases automatically", () => {
    expect(matchExercise("pullups", lib)).toMatchObject({ kind: "exact", exercise: { id: "pull-ups" } });
    expect(matchExercise("RDL", lib)).toMatchObject({ kind: "exact", exercise: { id: "romanian-deadlift" } });
    expect(matchExercise("Australian rows", lib)).toMatchObject({ kind: "exact", via: "alias" });
    expect(matchExercise("dips", lib)).toMatchObject({ kind: "exact", exercise: { id: "parallel-bar-dips" } });
  });

  it("suggests close names instead of guessing", () => {
    expect(matchExercise("Strict pullup", SEED_EXERCISES)).toMatchObject({
      kind: "exact",
      exercise: { id: "strict-pull-ups" },
    });
    const s = matchExercise("Tuck front levers hold", SEED_EXERCISES);
    expect(s.kind).toBe("suggest");
    if (s.kind === "suggest") expect(s.candidates[0]?.exercise.id).toBe("tuck-front-lever");
  });

  it("returns none for unrelated names", () => {
    expect(matchExercise("Zumba", SEED_EXERCISES).kind).toBe("none");
  });
});

describe("searchExercises (picker)", () => {
  it("lists recents first when the query is empty", () => {
    const { results } = searchExercises("", SEED_EXERCISES, ["l-sit", "hip-thrust"]);
    expect(results.slice(0, 2).map((e) => e.id)).toEqual(["l-sit", "hip-thrust"]);
  });
  it("filters by prefix and offers create for new names", () => {
    const r = searchExercises("pis", SEED_EXERCISES);
    expect(r.results[0]?.id).toBe("pistol-squat");
    expect(r.canCreate).toBe(true);
    expect(searchExercises("Pistol squats", SEED_EXERCISES).canCreate).toBe(false);
  });
  it("puts archived exercises after active ones", () => {
    const lib: ExerciseDef[] = [
      { id: "a", name: "Ring dips", kind: "reps", perSide: false, allowsWeight: false, archived: true },
      { id: "b", name: "Ring rows", kind: "reps", perSide: false, allowsWeight: false },
    ];
    expect(searchExercises("ring", lib).results.map((e) => e.id)).toEqual(["b", "a"]);
  });
});
