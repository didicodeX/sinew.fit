import { parseCsv } from "@domain/index";

function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    // Excel stores a time of day as 1899-12-30 + fraction
    const pad = (n: number) => String(n).padStart(2, "0");
    return v.getUTCFullYear() < 1950
      ? `${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`
      : `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  }
  return String(v);
}

/** Read a CSV/TSV/TXT or XLSX file into rows of text (first row = headers). */
export async function readTable(file: File): Promise<string[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(file);
    return rows.map((r) => r.map(cellText)).filter((r) => r.some((c) => c.trim() !== ""));
  }
  return parseCsv(await file.text());
}
