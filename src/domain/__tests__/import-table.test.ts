import { describe, expect, it } from "vitest";
import { buildImportedSessions, autoMapColumns, detectLayout, mappingProblems, parseCsv, parseImportDate, parseImportRows } from "../import-table";

const PER_EXERCISE = `date,start,end,exercise,reps,rest,break,notes,session_notes,superset
2026-10-22,12:40,13:17,Squats,"35 35 35",1:35,0:00,"Getting easier, consider increasing reps",,
2026-10-22,12:40,13:17,Pull-ups,"4 4 4",1:30,,"Weak, keep trying",,A
2026-10-22,12:40,13:17,Chin-ups,"4",,,"Final rep just about",Good session,
2026-10-24,,,Squats,"30 30",,,,,
`;

function read(text: string) {
  const [header, ...rows] = parseCsv(text);
  const mapping = autoMapColumns(header!);
  return { mapping, ...parseImportRows(rows, mapping) };
}

describe("parseCsv", () => {
  it("handles quotes, commas in cells, CRLF and BOM", () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n');
    expect(rows).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
  });
  it("detects semicolons and tabs", () => {
    expect(parseCsv("a;b\n1;2")[1]).toEqual(["1", "2"]);
    expect(parseCsv("a\tb\n1\t2")[1]).toEqual(["1", "2"]);
  });
});

describe("mapping", () => {
  it("maps the brief's header and finds the layout", () => {
    const m = autoMapColumns(parseCsv(PER_EXERCISE)[0]!);
    expect(mappingProblems(m)).toEqual([]);
    expect(detectLayout(m)).toBe("per-exercise");
    expect(m.sessionNotes).toBe(8);
  });
  it("detects the per-set layout", () => {
    const m = autoMapColumns(["Date", "Exercise", "Set number", "Value", "Unit", "Weight kg", "Rest sec", "Note"]);
    expect(detectLayout(m)).toBe("per-set");
    expect(mappingProblems(m)).toEqual([]);
  });
  it("reports what is missing", () => {
    expect(mappingProblems(autoMapColumns(["foo", "bar"]))).toHaveLength(3);
  });
});

describe("parseImportDate", () => {
  it("reads ISO and day-first dates, rejects impossible ones", () => {
    expect(parseImportDate("2026-10-22")).toBe("2026-10-22");
    expect(parseImportDate("22/10/2026")).toBe("2026-10-22");
    expect(parseImportDate("03/04/2026", "mdy")).toBe("2026-03-04");
    expect(parseImportDate("31/02/2026")).toBeNull();
    expect(parseImportDate("soon")).toBeNull();
  });
});

describe("parseImportRows (per exercise)", () => {
  const r = read(PER_EXERCISE);
  it("groups rows into sessions by date and start", () => {
    expect(r.sessions.map((s) => [s.date, s.blocks.length])).toEqual([["2026-10-22", 3], ["2026-10-24", 1]]);
    expect(r.sessions[0]!.sessionNotes).toBe("Good session");
  });
  it("reads sets, rest, superset", () => {
    const [sq, pull] = r.sessions[0]!.blocks;
    expect(sq!.sets.map((s) => s.value)).toEqual([35, 35, 35]);
    expect(sq!.restSec).toBe(95);
    expect(pull!.superset).toBe("A");
    expect(r.warnings.filter((w) => w.level === "error")).toEqual([]);
  });
});

describe("parseImportRows (edge cases)", () => {
  it("skips unreadable rows with a line number and keeps the rest", () => {
    const r = read("date,exercise,reps\n2026-10-22,Squats,5 5\nnot a date,Pull-ups,5\n2026-10-23,Dips,abc\n");
    expect(r.sessions).toHaveLength(1);
    expect(r.warnings.filter((w) => w.level === "error").map((w) => w.line)).toEqual([3, 4]);
  });
  it("warns on a duplicate exercise within a day", () => {
    const r = read("date,exercise,reps\n2026-10-22,Squats,5\n2026-10-22,squats,5\n");
    expect(r.warnings.some((w) => w.message.includes("twice"))).toBe(true);
  });
  it("reuses the previous date when the cell is blank", () => {
    const r = read("date,exercise,reps\n2026-10-22,Squats,5\n,Dips,6\n");
    expect(r.sessions[0]!.blocks).toHaveLength(2);
  });
});

describe("parseImportRows (per set)", () => {
  it("merges consecutive sets of one exercise", () => {
    const r = read(
      "date,exercise,set_number,value,unit,weight_kg,rest_sec,note\n" +
        "2026-10-22,Pull-ups,1,8,reps,10,90,\n2026-10-22,Pull-ups,2,7,reps,10,90,\n2026-10-22,Dead hang,1,30,sec,,,\n",
    );
    const [pull, hang] = r.sessions[0]!.blocks;
    expect(pull!.sets).toEqual([{ value: 8, weightKg: 10, restSec: 90 }, { value: 7, weightKg: 10, restSec: 90 }]);
    expect(hang!.unit).toBe("sec");
  });
});

describe("buildImportedSessions", () => {
  const EX = [
    { id: "pull", name: "Pull-ups", kind: "reps" as const, perSide: false, allowsWeight: true },
    { id: "hang", name: "Dead hang", kind: "hold" as const, perSide: false, allowsWeight: false },
  ];
  let n = 0;
  const id = () => `i${++n}`;
  it("applies the resolved exercises, skips the unresolved and drops empty sessions", () => {
    const r = read(
      "date,start,end,exercise,reps,rest,notes\n2026-10-22,12:40,13:17,Strict pull ups,4 4,1:30,+10 kg\n2026-10-22,12:40,13:17,Dead hang,20,,\n2026-10-23,,,Mystery,5,,\n",
    );
    const map: Record<string, string | null> = { "Strict pull ups": "pull", "Dead hang": "hang", Mystery: null };
    const built = buildImportedSessions(r.sessions, (name) => map[name] ?? null, EX, id);
    expect(built).toHaveLength(1);
    const s = built[0]!;
    expect(s.setCount).toBe(3);
    expect(s.session.source).toBe("import");
    expect(s.session.entries[0]!.sets.map((x) => [x.value, x.unit, x.weightKg])).toEqual([[4, "reps", 10], [4, "reps", 10]]);
    expect(s.session.entries[1]!.sets[0]!.unit).toBe("sec");
    expect(s.session.startedAt).toBeTruthy();
  });
});
