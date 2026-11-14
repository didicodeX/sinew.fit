import type { IsoDate, Weekday } from "./types";

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse `YYYY-MM-DD` as a UTC midnight timestamp. Calendar math stays time-zone free. */
export function isoToUtc(date: IsoDate): number {
  const m = ISO_RE.exec(date);
  if (!m) throw new Error(`Invalid ISO date: ${date}`);
  const [, y, mo, d] = m;
  const ts = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  const check = new Date(ts);
  if (check.getUTCMonth() !== Number(mo) - 1 || check.getUTCDate() !== Number(d)) {
    throw new Error(`Invalid ISO date: ${date}`);
  }
  return ts;
}

export function isValidIsoDate(date: string): boolean {
  try {
    isoToUtc(date);
    return true;
  } catch {
    return false;
  }
}

export function utcToIso(ts: number): IsoDate {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Monday = 0 … Sunday = 6. */
export function weekdayOf(date: IsoDate): Weekday {
  return ((new Date(isoToUtc(date)).getUTCDay() + 6) % 7) as Weekday;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return utcToIso(isoToUtc(date) + days * 86_400_000);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((isoToUtc(to) - isoToUtc(from)) / 86_400_000);
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: IsoDate): IsoDate {
  return addDays(date, -weekdayOf(date));
}

/** Today's calendar date in a given IANA time zone (default: the runtime's). */
export function todayIn(timeZone?: string, now: Date = new Date()): IsoDate {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
