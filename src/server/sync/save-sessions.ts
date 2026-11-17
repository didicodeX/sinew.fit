import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@lib/db";
import type { SyncResult, SyncSession } from "./schemas";

/**
 * Last-write-wins per session (brief §10 step 3: enough for a single user on a few devices).
 * A session is replaced as a whole: entries and sets are rewritten from the client copy.
 * Only confirmed sets are stored; prefilled-but-not-done sets live on the device only.
 */
export async function saveSessions(
  userId: string,
  sessions: SyncSession[],
  opts: { importBatchId?: string } = {},
): Promise<SyncResult[]> {
  const exerciseIds = [...new Set(sessions.flatMap((s) => s.entries.map((e) => e.exerciseId)))];
  const templateIds = [...new Set(sessions.flatMap((s) => (s.templateId ? [s.templateId] : [])))];

  const [ownedExercises, ownedTemplates, existing] = await Promise.all([
    db.exercise.findMany({ where: { userId, id: { in: exerciseIds } }, select: { id: true } }),
    db.sessionTemplate.findMany({ where: { userId, id: { in: templateIds } }, select: { id: true } }),
    db.workoutSession.findMany({
      where: { id: { in: sessions.map((s) => s.id) } },
      select: { id: true, userId: true, clientUpdatedAt: true },
    }),
  ]);
  const okExercise = new Set(ownedExercises.map((e) => e.id));
  const okTemplate = new Set(ownedTemplates.map((t) => t.id));
  const existingById = new Map(existing.map((e) => [e.id, e]));

  const results: SyncResult[] = [];
  for (const s of sessions) {
    const prev = existingById.get(s.id);
    if (prev && prev.userId !== userId) {
      results.push({ id: s.id, status: "rejected", reason: "not_owner" });
      continue;
    }
    if (s.entries.some((e) => !okExercise.has(e.exerciseId))) {
      results.push({ id: s.id, status: "rejected", reason: "unknown_exercise" });
      continue;
    }
    if (prev?.clientUpdatedAt && prev.clientUpdatedAt.getTime() > s.updatedAt) {
      results.push({ id: s.id, status: "stale" });
      continue;
    }

    const sessionData = {
      date: new Date(`${s.date}T00:00:00Z`),
      startedAt: s.startedAt ? new Date(s.startedAt) : null,
      endedAt: s.endedAt ? new Date(s.endedAt) : null,
      templateId: s.templateId && okTemplate.has(s.templateId) ? s.templateId : null,
      title: s.title ?? null,
      sessionNotes: s.sessionNotes ?? null,
      isDeload: s.isDeload,
      source: s.source,
      deletedAt: s.deletedAt ? new Date(s.deletedAt) : null,
      clientUpdatedAt: new Date(s.updatedAt),
      ...(opts.importBatchId ? { importBatchId: opts.importBatchId } : {}),
    };

    const entries = s.entries.map((e) => ({
      id: e.id,
      sessionId: s.id,
      exerciseId: e.exerciseId,
      order: e.order,
      partName: e.partName ?? null,
      supersetGroup: e.supersetGroup ?? null,
      plannedSets: e.plannedSets ?? null,
      plannedTargetMin: e.plannedTarget?.min ?? null,
      plannedTargetMax: e.plannedTarget?.max ?? null,
      plannedUnit: e.plannedTarget?.unit ?? null,
      plannedWorking: e.plannedWorking ?? null,
      restSec: e.restSec ?? null,
      breakAfterSec: e.breakAfterSec ?? null,
      notes: e.notes ?? null,
      discomfort: e.discomfort ?? null,
    }));

    const sets = s.entries.flatMap((e) =>
      e.sets
        .filter((x) => x.done)
        .map((x) => ({
          id: randomUUID(),
          entryId: e.id,
          index: x.index,
          value: x.value,
          unit: x.unit,
          side: x.side ?? null,
          weightKg: x.weightKg ?? null,
          assistanceType: x.assistance?.type ?? null,
          assistanceLabel: x.assistance?.label ?? null,
          assistanceKg: x.assistance?.kg ?? null,
          rir: x.rir ?? null,
          clean: x.clean ?? null,
          restActualSec: x.restActualSec ?? null,
          note: x.note ?? null,
        })),
    );

    await db.$transaction([
      db.workoutSession.upsert({
        where: { id: s.id },
        create: { id: s.id, userId, ...sessionData },
        update: sessionData,
      }),
      // Cascade removes the old sets with their entries
      db.exerciseEntry.deleteMany({ where: { sessionId: s.id } }),
      db.exerciseEntry.createMany({ data: entries }),
      db.setEntry.createMany({ data: sets }),
    ]);
    results.push({ id: s.id, status: "saved" });
  }
  return results;
}
