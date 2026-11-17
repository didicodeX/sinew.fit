import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@lib/db";

export const EXPORT_VERSION = 1;

/**
 * Everything the user logged and planned, as plain JSON (brief P0 #7). Auth tables and
 * import images are left out. Every query is scoped by the user id.
 */
export async function exportAll(userId: string) {
  const [exercises, chains, templates, programs, sessions, bodyweight, gtg] = await Promise.all([
    db.exercise.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    db.progressionChain.findMany({ where: { userId }, include: { steps: { orderBy: { order: "asc" } } } }),
    db.sessionTemplate.findMany({
      where: { userId },
      include: {
        parts: {
          orderBy: { order: "asc" },
          include: { items: { orderBy: { order: "asc" }, include: { changes: { orderBy: { effectiveFrom: "asc" } } } } },
        },
      },
    }),
    db.program.findMany({ where: { userId }, include: { days: { orderBy: { weekday: "asc" } } } }),
    db.workoutSession.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      include: { entries: { orderBy: { order: "asc" }, include: { sets: { orderBy: { index: "asc" } } } } },
    }),
    db.bodyweightLog.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    db.gtgLog.findMany({ where: { userId }, orderBy: { date: "asc" } }),
  ]);

  return {
    app: "sinew",
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    exercises,
    progressionChains: chains,
    templates,
    programs,
    sessions,
    bodyweight,
    gtg,
  };
}

/** JSON with Decimals as numbers and dates as ISO strings. */
export function toJson(data: unknown): string {
  return JSON.stringify(
    data,
    function (this: Record<string, unknown>, key, value) {
      const raw = this[key];
      return raw instanceof Prisma.Decimal ? raw.toNumber() : value;
    },
    2,
  );
}
