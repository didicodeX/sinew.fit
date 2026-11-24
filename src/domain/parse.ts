/**
 * Tolerant parsers for notebook-style input: reps rows ("5 5 5", "5,5,5", "5x5x5"),
 * hold times ("20 20 18", "0:20 0:20"), rest/break ("1:35", "90", "3 min", "2-3 min"),
 * clock times ("12:40") and loads written in notes ("+10 kg").
 */

export interface ParseWarning {
  code: "unparseable" | "ambiguous" | "out_of_range" | "empty";
  message: string;
}

export interface ValueListResult {
  values: number[];
  warnings: ParseWarning[];
}

/** `m:ss` or `h:mm:ss` → seconds. Returns null if not a clock-style duration. */
export function parseClockDuration(token: string): number | null {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(token.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Parse a reps/seconds row into one number per set.
 * Separators: whitespace, comma, semicolon, slash, `x`/`×`. Hold values may be `m:ss` or end in `s`.
 */
export function parseValueList(input: string, unit: "reps" | "sec" = "reps"): ValueListResult {
  const warnings: ParseWarning[] = [];
  const raw = input.trim();
  if (!raw) return { values: [], warnings: [{ code: "empty", message: "No values" }] };

  const tokens = raw
    .toLowerCase()
    .split(/[\s,;/x×*]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    // A unit written apart from its number ("10 s", "20 sec", "5 reps") is not a value
    .filter((t) => !/^(s|sec|secs|seconds?|reps?)$/.test(t));

  if (/^\s*\d+\s*[x×*]\s*\d+\s*$/i.test(raw)) {
    warnings.push({
      code: "ambiguous",
      message: `"${raw}" read as two sets (${tokens.join(", ")}). If you meant sets × reps, write each set, e.g. "5 5 5".`,
    });
  }

  const values: number[] = [];
  for (const token of tokens) {
    const clock = parseClockDuration(token);
    if (clock !== null) {
      values.push(clock);
      continue;
    }
    const m = /^(\d+(?:\.\d+)?)(s|sec|secs|seconds?|reps?)?$/.exec(token);
    if (!m) {
      warnings.push({ code: "unparseable", message: `Could not read "${token}"` });
      continue;
    }
    const n = Number(m[1]);
    if (!Number.isInteger(n)) {
      warnings.push({ code: "unparseable", message: `"${token}" is not a whole number` });
      continue;
    }
    values.push(n);
  }

  const max = unit === "sec" ? 600 : 200;
  for (const v of values) {
    if (v <= 0 || v > max) warnings.push({ code: "out_of_range", message: `${v} looks implausible` });
  }
  if (values.length > 20) warnings.push({ code: "out_of_range", message: `${values.length} sets looks implausible` });

  return { values, warnings };
}

export interface RestRange {
  sec: number;
  maxSec?: number;
}

/**
 * Rest/break: "1:35", "90", "90s", "3 min", "3m", "2-3 min", "2–3 min", "1m30".
 * A bare number is seconds, except when ≤ 10 and followed by a minute unit.
 */
export function parseRest(input: string): RestRange | null {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/–|—/g, "-")
    .replace(/(\d)\s*(?:''|"|″)/g, "$1s") // 90" = 90 seconds
    .replace(/(\d)\s*['’′]/g, "$1m"); // 1'30 = 1 min 30, 2' = 2 min
  if (!s) return null;

  const clock = parseClockDuration(s);
  if (clock !== null) return { sec: clock };

  const range = /^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(m|min|mins|minutes|s|sec|secs|seconds)?$/.exec(s);
  if (range) {
    const mult = range[3]?.startsWith("m") ? 60 : 1;
    return { sec: Math.round(Number(range[1]) * mult), maxSec: Math.round(Number(range[2]) * mult) };
  }

  const mixed = /^(\d+)\s*m(?:in)?\s*(\d+)\s*s?$/.exec(s);
  if (mixed) return { sec: Number(mixed[1]) * 60 + Number(mixed[2]) };

  const single = /^(\d+(?:\.\d+)?)\s*(m|min|mins|minutes|s|sec|secs|seconds)?$/.exec(s);
  if (single) {
    const mult = single[2]?.startsWith("m") ? 60 : 1;
    return { sec: Math.round(Number(single[1]) * mult) };
  }
  return null;
}

/** "12:40", "12h40", "12.40", or a bare hour "7" / "7h" (= 07:00) → minutes since midnight. */
export function parseClockTime(input: string): number | null {
  const m = /^(\d{1,2})(?:\s*[:h.]\s*(\d{2})?)?$/.exec(input.trim().toLowerCase());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Duration in minutes between two clock times; null if end is before start. */
export function clockDurationMinutes(start: string, end: string): number | null {
  const a = parseClockTime(start);
  const b = parseClockTime(end);
  if (a === null || b === null || b < a) return null;
  return b - a;
}

/** Extract a load like "+10 kg", "10kg", "+7.5kg" from free text. */
export function extractWeightKg(text: string): number | null {
  const m = /\+?\s*(\d+(?:[.,]\d+)?)\s*kg\b/i.exec(text);
  if (!m?.[1]) return null;
  return Number(m[1].replace(",", "."));
}

/** Format seconds as m:ss. */
export function formatDuration(totalSec: number): string {
  const sign = totalSec < 0 ? "-" : "";
  const s = Math.abs(Math.round(totalSec));
  return `${sign}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
