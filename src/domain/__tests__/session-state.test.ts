import { describe, expect, it } from "vitest";
import { SEED_EXERCISES, SEED_TEMPLATES } from "../program.seed";
import { generateSession } from "../session";
import { nextSet, reduceSession, restAfter, restRemaining, sessionProgress } from "../session-state";
import type { LoggedSession } from "../types";

const T0 = Date.UTC(2027, 1, 4, 18, 0, 0);
const sec = (s: number) => T0 + s * 1000;

function pullB(): LoggedSession {
  let n = 0;
  const tpl = SEED_TEMPLATES.find((t) => t.id === "pull-b-core-b")!;
  return generateSession(tpl, SEED_EXERCISES, { date: "2027-02-04", sessionId: "s", newId: () => `e${n++}` });
}

describe("reduceSession", () => {
  it("confirms a set as planned in one tap and starts the planned rest", () => {
    const s = reduceSession(pullB(), { type: "confirmSet", ref: { entryId: "e0", index: 0 }, now: T0 });
    const set = s.entries[0]!.sets[0]!;
    expect(set).toMatchObject({ done: true, value: 8 });
    expect(s.startedAt).toBe(new Date(T0).toISOString());
    expect(s.rest).toEqual({ startedAt: T0, durationSec: 180, entryId: "e0" });
    expect(restRemaining(s.rest!, sec(60))).toBe(120);
  });

  it("adjusts with +/- and clamps at zero", () => {
    let s = reduceSession(pullB(), { type: "adjustValue", ref: { entryId: "e1", index: 0 }, delta: 2 });
    expect(s.entries[1]!.sets[0]!.value).toBe(8);
    s = reduceSession(s, { type: "adjustValue", ref: { entryId: "e1", index: 0 }, delta: -50 });
    expect(s.entries[1]!.sets[0]!.value).toBe(0);
  });

  it("measures real rest within an exercise and the break between exercises", () => {
    let s = pullB();
    s = reduceSession(s, { type: "confirmSet", ref: { entryId: "e0", index: 0 }, now: sec(0) });
    s = reduceSession(s, { type: "confirmSet", ref: { entryId: "e0", index: 1 }, now: sec(200) });
    expect(s.entries[0]!.sets[1]!.restActualSec).toBe(200);
    s = reduceSession(s, { type: "confirmSet", ref: { entryId: "e1", index: 0 }, now: sec(500) });
    expect(s.entries[0]!.breakAfterSec).toBe(300);
    expect(s.entries[1]!.sets[0]!.restActualSec).toBeUndefined();
  });

  it("ignores gaps that are too long to be rest", () => {
    let s = reduceSession(pullB(), { type: "confirmSet", ref: { entryId: "e0", index: 0 }, now: sec(0) });
    s = reduceSession(s, { type: "confirmSet", ref: { entryId: "e0", index: 1 }, now: sec(3600) });
    expect(s.entries[0]!.sets[1]!.restActualSec).toBeUndefined();
  });

  it("records a hold value when confirming from the hold timer", () => {
    const s = reduceSession(pullB(), { type: "confirmSet", ref: { entryId: "e0", index: 0 }, now: T0, value: 11 });
    expect(s.entries[0]!.sets[0]!.value).toBe(11);
  });

  it("undo makes a set editable again", () => {
    let s = reduceSession(pullB(), { type: "confirmSet", ref: { entryId: "e0", index: 0 }, now: T0 });
    s = reduceSession(s, { type: "undoSet", ref: { entryId: "e0", index: 0 } });
    expect(s.entries[0]!.sets[0]!.done).toBe(false);
  });

  it("adds and removes sets, copying the last one", () => {
    let s = reduceSession(pullB(), { type: "setValue", ref: { entryId: "e1", index: 2 }, value: 9 });
    s = reduceSession(s, { type: "addSet", entryId: "e1" });
    expect(s.entries[1]!.sets).toHaveLength(4);
    expect(s.entries[1]!.sets[3]).toMatchObject({ index: 3, value: 9, done: false });
    s = reduceSession(s, { type: "removeLastSet", entryId: "e1" });
    s = reduceSession(s, { type: "removeLastSet", entryId: "e1" });
    expect(s.entries[1]!.sets).toHaveLength(2);
  });

  it("stores notes and finishes without a running timer", () => {
    let s = reduceSession(pullB(), { type: "confirmSet", ref: { entryId: "e0", index: 0 }, now: T0 });
    s = reduceSession(s, { type: "entryNotes", entryId: "e0", notes: "Getting stronger" });
    s = reduceSession(s, { type: "sessionNotes", notes: "Good day" });
    s = reduceSession(s, { type: "finish", now: sec(3000) });
    expect(s.entries[0]!.notes).toBe("Getting stronger");
    expect(s.sessionNotes).toBe("Good day");
    expect(s.endedAt).toBe(new Date(sec(3000)).toISOString());
    expect(s.rest).toBeUndefined();
  });

  it("skips and adjusts rest", () => {
    let s = reduceSession(pullB(), { type: "confirmSet", ref: { entryId: "e0", index: 0 }, now: T0 });
    s = reduceSession(s, { type: "adjustRest", deltaSec: 15 });
    expect(s.rest!.durationSec).toBe(195);
    s = reduceSession(s, { type: "skipRest" });
    expect(s.rest).toBeUndefined();
  });
});

describe("rest rules", () => {
  it("waits for both sides of a per-side set", () => {
    let n = 0;
    const tpl = SEED_TEMPLATES.find((t) => t.id === "push-a-legs-a")!;
    let s = generateSession(tpl, SEED_EXERCISES, { date: "2027-02-01", sessionId: "s", newId: () => `e${n++}` });
    const pistol = s.entries.find((e) => e.exerciseId === "pistol-squat")!;
    s = reduceSession(s, { type: "confirmSet", ref: { entryId: pistol.id, index: 0, side: "L" }, now: T0 });
    expect(s.rest).toBeUndefined();
    s = reduceSession(s, { type: "confirmSet", ref: { entryId: pistol.id, index: 0, side: "R" }, now: sec(40) });
    expect(s.rest?.durationSec).toBe(120);
  });

  it("rests only after the last exercise of a superset round", () => {
    const s = pullB();
    s.entries[0]!.supersetGroup = "0:A";
    s.entries[1]!.supersetGroup = "0:A";
    const a = reduceSession(s, { type: "confirmSet", ref: { entryId: "e0", index: 0 }, now: T0 });
    expect(a.rest).toBeUndefined();
    const b = reduceSession(a, { type: "confirmSet", ref: { entryId: "e1", index: 0 }, now: sec(30) });
    expect(b.rest).toBeDefined();
  });

  it("never rests after the last set of the session", () => {
    let s = pullB();
    for (const e of s.entries) for (const x of e.sets) x.done = true;
    const last = s.entries.at(-1)!;
    last.sets.at(-1)!.done = false;
    s = reduceSession(s, { type: "confirmSet", ref: { entryId: last.id, index: last.sets.at(-1)!.index }, now: T0 });
    expect(s.rest).toBeUndefined();
    expect(restAfter(s, last.id, 0)).toBeNull();
  });
});

describe("progress helpers", () => {
  it("finds the next set and counts progress", () => {
    let s = pullB();
    expect(nextSet(s)).toEqual({ entryId: "e0", index: 0 });
    s = reduceSession(s, { type: "confirmSet", ref: { entryId: "e0", index: 0 }, now: T0 });
    expect(nextSet(s)).toEqual({ entryId: "e0", index: 1 });
    expect(sessionProgress(s)).toEqual({ done: 1, total: 27 });
  });
});
