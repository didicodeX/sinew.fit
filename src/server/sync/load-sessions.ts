import "server-only";
import { db } from "@lib/db";
import type { ExerciseDef, LoggedSession } from "@domain/types";

export interface PulledSession extends LoggedSession {
  updatedAt: number;
  exerciseDefs: ExerciseDef[];
}

const opt = <T>(v: T | null): T | undefined => (v === null ? undefined : v);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** The user's non-deleted sessions changed since `since` (client clock, ms), newest first. */
export async function loadSessions(userId: string, since = 0, limit = 200): Promise<PulledSession[]> {
  const rows = await db.workoutSession.findMany({
    where: { userId, deletedAt: null, clientUpdatedAt: { gt: new Date(since) } },
    orderBy: { date: "desc" },
    take: limit,
    include: {
      entries: {
        orderBy: { order: "asc" },
        include: { sets: { orderBy: [{ index: "asc" }] }, exercise: true },
      },
    },
  });

  return rows.map((s) => {
    const defs = new Map<string, ExerciseDef>();
    for (const e of s.entries) {
      defs.set(e.exerciseId, {
        id: e.exercise.id,
        name: e.exercise.name,
        kind: e.exercise.kind,
        perSide: e.exercise.perSide,
        allowsWeight: e.exercise.allowsWeight,
        allowsAssistance: e.exercise.allowsAssistance,
        aliases: e.exercise.aliases,
        archived: e.exercise.archivedAt !== null,
      });
    }
    return {
      id: s.id,
      date: isoDay(s.date),
      startedAt: s.startedAt?.toISOString(),
      endedAt: s.endedAt?.toISOString(),
      templateId: opt(s.templateId),
      title: opt(s.title),
      sessionNotes: opt(s.sessionNotes),
      isDeload: s.isDeload,
      source: s.source === "import" ? "import" : "app",
      updatedAt: s.clientUpdatedAt?.getTime() ?? s.updatedAt.getTime(),
      exerciseDefs: [...defs.values()],
      entries: s.entries.map((e) => ({
        id: e.id,
        exerciseId: e.exerciseId,
        order: e.order,
        partName: opt(e.partName),
        supersetGroup: opt(e.supersetGroup),
        plannedSets: opt(e.plannedSets),
        plannedTarget:
          e.plannedTargetMin !== null && e.plannedUnit
            ? { min: e.plannedTargetMin, max: opt(e.plannedTargetMax), unit: e.plannedUnit }
            : undefined,
        plannedWorking: opt(e.plannedWorking),
        restSec: opt(e.restSec),
        breakAfterSec: opt(e.breakAfterSec),
        notes: opt(e.notes),
        discomfort: opt(e.discomfort),
        sets: e.sets.map((x) => ({
          index: x.index,
          value: x.value,
          unit: x.unit,
          side: opt(x.side),
          weightKg: x.weightKg === null ? undefined : Number(x.weightKg),
          assistance: x.assistanceType
            ? { type: x.assistanceType, label: opt(x.assistanceLabel), kg: x.assistanceKg === null ? undefined : Number(x.assistanceKg) }
            : undefined,
          rir: opt(x.rir),
          clean: opt(x.clean),
          restActualSec: opt(x.restActualSec),
          note: opt(x.note),
          done: true,
        })),
      })),
    };
  });
}
