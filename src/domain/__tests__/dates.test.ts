import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isValidIsoDate, startOfWeek, todayIn, weekdayOf } from "../dates";

describe("dates", () => {
  it("weekdayOf uses Monday = 0", () => {
    expect(weekdayOf("2027-02-01")).toBe(0); // Monday
    expect(weekdayOf("2027-02-07")).toBe(6); // Sunday
  });
  it("adds days across month and DST boundaries", () => {
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2027-03-13", 1)).toBe("2027-03-14");
    expect(daysBetween("2027-01-01", "2027-12-31")).toBe(364);
  });
  it("startOfWeek returns Monday", () => {
    expect(startOfWeek("2027-02-04")).toBe("2027-02-01");
    expect(startOfWeek("2027-02-07")).toBe("2027-02-01");
  });
  it("rejects invalid dates", () => {
    expect(isValidIsoDate("2027-02-30")).toBe(false);
    expect(isValidIsoDate("2027-2-3")).toBe(false);
    expect(isValidIsoDate("2027-02-03")).toBe(true);
  });
  it("todayIn respects the time zone", () => {
    const now = new Date("2027-02-01T05:00:00Z"); // 22:00 Jan 31 in Calgary
    expect(todayIn("America/Edmonton", now)).toBe("2027-01-31");
    expect(todayIn("UTC", now)).toBe("2027-02-01");
  });
});
