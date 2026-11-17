import { describe, expect, it } from "vitest";
import { buildQuickSession, draftFromSession, emptyBlock, type QuickDraft } from "../quick-entry";
import type { ExerciseDef } from "../types";

const EX: ExerciseDef[] = [
  { id: "pull", name: "Pull-ups", kind: "reps", perSide: false, allowsWeight: true },
  { id: "hang", name: "Dead hang", kind: "hold", perSide: false, allowsWeight: false },
];
let n = 0;
const id = () => `id${++n}`;
const draft = (over: Partial<QuickDraft> = {}): QuickDraft => ({
  date: "2026-10-22",
  start: "12:40",
  end: "13:17",
  title: "",
  sessionNotes: "",
  blocks: [{ ...emptyBlock("pull"), reps: "4 4 4", rest: "1:30", notes: "+10 kg, weak", superset: "a" }],
  ...over,
});

describe("buildQuickSession", () => {
  it("creates one set per value with rest, superset and load", () => {
    const r = buildQuickSession(draft(), EX, id);
    expect(r.blocking).toBe(false);
    const e = r.session.entries[0]!;
    expect(e.sets.map((s) => s.value)).toEqual([4, 4, 4]);
    expect(e.sets.every((s) => s.done && s.weightKg === 10)).toBe(true);
    expect(e.restSec).toBe(90);
    expect(e.supersetGroup).toBe("A");
    expect(e.notes).toBe("+10 kg, weak");
    expect(r.session.source).toBe("import");
    expect(r.session.startedAt && r.session.endedAt).toBeTruthy();
  });

  it("uses seconds for holds", () => {
    const r = buildQuickSession(draft({ blocks: [{ ...emptyBlock("hang"), reps: "20,20,18" }] }), EX, id);
    expect(r.session.entries[0]!.sets.map((s) => [s.value, s.unit])).toEqual([[20, "sec"], [20, "sec"], [18, "sec"]]);
  });

  it("blocks unreadable values and empty sessions", () => {
    expect(buildQuickSession(draft({ blocks: [{ ...emptyBlock("pull"), reps: "4 abc" }] }), EX, id).blocking).toBe(true);
    const empty = buildQuickSession(draft({ blocks: [emptyBlock()] }), EX, id);
    expect(empty.blocking).toBe(true);
    expect(empty.warnings.get(-1)).toBeTruthy();
  });

  it("warns when the end is before the start and drops the times", () => {
    const r = buildQuickSession(draft({ start: "13:00", end: "12:00" }), EX, id);
    expect(r.warnings.get(-1)).toContain("End is before start");
    expect(r.session.startedAt).toBeUndefined();
  });

  it("round-trips through draftFromSession", () => {
    const first = buildQuickSession(draft(), EX, id).session;
    const again = buildQuickSession(draftFromSession(first, "2026-10-29"), EX, id);
    expect(again.session.date).toBe("2026-10-29");
    expect(again.session.entries[0]!.sets.map((s) => s.value)).toEqual([4, 4, 4]);
    expect(again.session.entries[0]!.restSec).toBe(90);
  });
});
