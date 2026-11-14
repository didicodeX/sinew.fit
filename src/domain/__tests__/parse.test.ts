import { describe, expect, it } from "vitest";
import { clockDurationMinutes, extractWeightKg, formatDuration, parseRest, parseValueList } from "../parse";

describe("parseValueList", () => {
  it.each([
    ["5 5 5", [5, 5, 5]],
    ["5,5,5", [5, 5, 5]],
    ["5, 5, 6", [5, 5, 6]],
    ["35 35 35", [35, 35, 35]],
    ["5x5x5", [5, 5, 5]],
    ["4", [4]],
  ])("%s", (input, expected) => {
    expect(parseValueList(input).values).toEqual(expected);
  });

  it("reads hold times in seconds or m:ss", () => {
    expect(parseValueList("20 20 18", "sec").values).toEqual([20, 20, 18]);
    expect(parseValueList("0:20 0:20 1:05", "sec").values).toEqual([20, 20, 65]);
    expect(parseValueList("20s 15s", "sec").values).toEqual([20, 15]);
  });

  it("flags ambiguous NxM and junk", () => {
    expect(parseValueList("3x5").warnings[0]?.code).toBe("ambiguous");
    const r = parseValueList("5 five 5");
    expect(r.values).toEqual([5, 5]);
    expect(r.warnings[0]?.code).toBe("unparseable");
    expect(parseValueList("").warnings[0]?.code).toBe("empty");
    expect(parseValueList("500").warnings[0]?.code).toBe("out_of_range");
  });
});

describe("parseRest", () => {
  it.each([
    ["1:35", { sec: 95 }],
    ["0:00", { sec: 0 }],
    ["90", { sec: 90 }],
    ["90s", { sec: 90 }],
    ["3 min", { sec: 180 }],
    ["3m", { sec: 180 }],
    ["2-3 min", { sec: 120, maxSec: 180 }],
    ["2–3 min", { sec: 120, maxSec: 180 }],
    ["1m30", { sec: 90 }],
  ])("%s", (input, expected) => {
    expect(parseRest(input)).toEqual(expected);
  });
  it("returns null for garbage", () => {
    expect(parseRest("soon")).toBeNull();
    expect(parseRest("")).toBeNull();
  });
});

describe("clock + weight helpers", () => {
  it("computes durations and rejects end before start", () => {
    expect(clockDurationMinutes("12:40", "13:17")).toBe(37);
    expect(clockDurationMinutes("13:17", "12:40")).toBeNull();
  });
  it("extracts loads from notes", () => {
    expect(extractWeightKg("Felt good +10 kg")).toBe(10);
    expect(extractWeightKg("RDL 7,5kg")).toBe(7.5);
    expect(extractWeightKg("no load")).toBeNull();
  });
  it("formats durations", () => {
    expect(formatDuration(95)).toBe("1:35");
    expect(formatDuration(5)).toBe("0:05");
  });
});
