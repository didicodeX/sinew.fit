import { describe, expect, it } from "vitest";
import { buildQuickSession } from "../quick-entry";
import { cleanPhotoRead, duplicateDates, groupPages, photoExerciseNames, photoToDraft, tidyValues } from "../photo-import";
import type { ExerciseDef } from "../types";

const EX: ExerciseDef[] = [
  { id: "pull", name: "Pull-ups", kind: "reps", perSide: false, allowsWeight: true },
  { id: "hang", name: "Dead hang", kind: "hold", perSide: false, allowsWeight: false },
];

const page1 = {
  sessions: [
    {
      date: "2026-10-22",
      dateText: "22/10",
      start: "12:40",
      end: "13:17",
      continuesPrevious: false,
      uncertainFields: ["end", "bogus"],
      exercises: [
        { name: "Pull ups", reps: "4, 4,4", unit: "reps", rest: "1:30", notes: "+10 kg", superset: "a", uncertainFields: ["reps"] },
        { name: "Dead hang", reps: "20 20 18", unit: "sec" },
        { name: "", reps: "" },
      ],
    },
  ],
};
const page2 = {
  sessions: [{ date: "", continuesPrevious: true, sessionNotes: "Good day", exercises: [{ name: "Squats", reps: "35-35-35", unit: "reps" }] }],
};

describe("cleanPhotoRead", () => {
  it("keeps known fields, tidies values and drops empty blocks", () => {
    const [s] = cleanPhotoRead(page1, 0);
    expect(s!.date).toBe("2026-10-22");
    expect(s!.uncertain).toEqual(["end"]);
    expect(s!.blocks).toHaveLength(2);
    expect(s!.blocks[0]).toMatchObject({ name: "Pull ups", reps: "4 4 4", superset: "A", uncertain: ["reps"], hold: false });
    expect(s!.blocks[1]!.hold).toBe(true);
    expect(s!.photos).toEqual([0]);
  });

  it("flags a missing or invalid date and survives junk", () => {
    const [s] = cleanPhotoRead({ sessions: [{ date: "2026-13-40", exercises: [{ name: "Dips", reps: "8" }] }] }, 2);
    expect(s!.date).toBe("");
    expect(s!.uncertain).toContain("date");
    expect(cleanPhotoRead(null, 0)).toEqual([]);
    expect(cleanPhotoRead({ sessions: "x" }, 0)).toEqual([]);
    expect(cleanPhotoRead({ sessions: [{ exercises: [] }] }, 0)).toEqual([]);
  });
});

describe("tidyValues", () => {
  it("normalises separators but leaves x for the parser to flag", () => {
    expect(tidyValues("5,5 , 5")).toBe("5 5 5");
    expect(tidyValues("35-35-35")).toBe("35 35 35");
    expect(tidyValues("3x5")).toBe("3x5");
    expect(tidyValues("1:20 1:10")).toBe("1:20 1:10");
  });
});

describe("groupPages", () => {
  it("joins a continuation page to the session before it", () => {
    const sessions = groupPages([...cleanPhotoRead(page1, 0), ...cleanPhotoRead(page2, 1)]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.blocks.map((b) => b.name)).toEqual(["Pull ups", "Dead hang", "Squats"]);
    expect(sessions[0]!.sessionNotes).toBe("Good day");
    expect(sessions[0]!.photos).toEqual([0, 1]);
    expect(sessions[0]!.uncertain).not.toContain("date");
  });

  it("keeps a first page that claims to continue", () => {
    expect(groupPages(cleanPhotoRead(page2, 0))).toHaveLength(1);
  });
});

describe("photoToDraft", () => {
  it("feeds the quick-entry builder (weights, holds, skipped blocks)", () => {
    const [s] = cleanPhotoRead(page1, 0);
    const ids: Record<string, string> = { "Pull ups": "pull", "Dead hang": "hang" };
    const draft = photoToDraft(s!, (n) => ids[n] ?? null);
    const r = buildQuickSession(draft, EX, (() => { let n = 0; return () => `id${++n}`; })());
    expect(r.blocking).toBe(false);
    expect(r.session.entries[0]!.sets.map((x) => [x.value, x.weightKg])).toEqual([[4, 10], [4, 10], [4, 10]]);
    expect(r.session.entries[1]!.sets.map((x) => x.unit)).toEqual(["sec", "sec", "sec"]);

    const skipped = buildQuickSession(photoToDraft(s!, (n) => (n === "Dead hang" ? null : ids[n] ?? null)), EX, () => "x");
    expect(skipped.session.entries).toHaveLength(1);
    expect(skipped.blocking).toBe(false);
  });
});

describe("helpers", () => {
  it("lists names once and finds repeated dates", () => {
    const a = cleanPhotoRead(page1, 0);
    const b = cleanPhotoRead(page1, 1);
    expect(photoExerciseNames([...a, ...b]).map((n) => [n.name, n.count])).toEqual([["Pull ups", 2], ["Dead hang", 2]]);
    expect(duplicateDates([...a, ...b])).toEqual(["2026-10-22"]);
  });
});
