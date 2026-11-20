"use server";

import { z } from "zod";
import { db } from "@lib/db";
import { normalizeExerciseName } from "@domain/index";
import { requirePageUser } from "@/server/current-user";
import { saveSessions } from "@/server/sync/save-sessions";
import { syncSessionSchema } from "@/server/sync/schemas";

/**
 * Import pipeline, server side (brief §6.3): resolve exercise names (and remember aliases),
 * open a batch, write sessions in chunks tagged with it, finish, undo.
 * Every query is scoped by the user id.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const dayToDate = (d: string) => new Date(`${d}T00:00:00Z`);

// ─── Exercise resolution ────────────────────────────────────────────────────

const resolutionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("map"), key: z.string().max(200), sourceName: z.string().max(200), exerciseId: z.string().max(64) }),
  z.object({
    action: z.literal("create"),
    key: z.string().max(200),
    sourceName: z.string().max(200),
    name: z.string().trim().min(1).max(80),
    kind: z.enum(["reps", "hold"]),
  }),
]);
export type Resolution = z.infer<typeof resolutionSchema>;
export type ResolveResult = { ok: true; ids: Record<string, string> } | { ok: false; error: string };

/** Map names to library exercises (adding the source name as an alias) or create new ones. */
export async function resolveExercises(raw: Resolution[]): Promise<ResolveResult> {
  const user = await requirePageUser("/import");
  const parsed = z.array(resolutionSchema).max(500).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the exercise choices." };

  const ids: Record<string, string> = {};
  for (const r of parsed.data) {
    if (r.action === "map") {
      const ex = await db.exercise.findFirst({ where: { id: r.exerciseId, userId: user.id } });
      if (!ex) return { ok: false, error: `Exercise not found for "${r.sourceName}".` };
      const known = new Set([ex.name, ...ex.aliases].map(normalizeExerciseName));
      const alias = r.sourceName.trim();
      if (alias && !known.has(normalizeExerciseName(alias))) {
        await db.exercise.update({ where: { id: ex.id }, data: { aliases: { push: alias } } });
      }
      ids[r.key] = ex.id;
    } else {
      const normalizedName = normalizeExerciseName(r.name);
      const existing = await db.exercise.findFirst({ where: { userId: user.id, normalizedName }, select: { id: true } });
      const id =
        existing?.id ??
        (
          await db.exercise.create({
            data: { userId: user.id, name: r.name, normalizedName, kind: r.kind, aliases: [] },
            select: { id: true },
          })
        ).id;
      ids[r.key] = id;
    }
  }
  return { ok: true, ids };
}

// ─── Batches ────────────────────────────────────────────────────────────────

/** Dates (of the given ones) on which the user already has a session. */
export async function findExistingDates(dates: string[]): Promise<string[]> {
  const user = await requirePageUser("/import");
  const parsed = z.array(isoDate).max(5000).safeParse(dates);
  if (!parsed.success) return [];
  const rows = await db.workoutSession.findMany({
    where: { userId: user.id, deletedAt: null, date: { in: [...new Set(parsed.data)].map(dayToDate) } },
    select: { date: true },
  });
  return [...new Set(rows.map((r) => r.date.toISOString().slice(0, 10)))];
}

export async function startBatch(sourceName: string, kind: "file" | "photo" = "file"): Promise<{ id: string }> {
  const user = await requirePageUser("/import");
  const b = await db.importBatch.create({
    data: { userId: user.id, kind: kind === "photo" ? "photo" : "file", sourceName: sourceName.slice(0, 200) || null, status: "draft" },
    select: { id: true },
  });
  return { id: b.id };
}

type BatchSummary = {
  sessions: number;
  sets: number;
  skipped: number;
  replaced: number;
  replacedSessionIds: string[];
};
const EMPTY_SUMMARY: BatchSummary = { sessions: 0, sets: 0, skipped: 0, replaced: 0, replacedSessionIds: [] };

export type ChunkResult = { ok: true; saved: number; skipped: number } | { ok: false; error: string };

/**
 * Write one chunk of sessions into an open batch. A date that already has a session is
 * skipped or replaced (the old one is soft-deleted and restored if the batch is undone).
 */
export async function importChunk(batchId: string, rawSessions: unknown, policy: "skip" | "replace"): Promise<ChunkResult> {
  const user = await requirePageUser("/import");
  const parsed = z.array(syncSessionSchema).min(1).max(30).safeParse(rawSessions);
  if (!parsed.success) return { ok: false, error: "Invalid sessions in this chunk." };

  const batch = await db.importBatch.findFirst({ where: { id: batchId, userId: user.id, status: "draft" } });
  if (!batch) return { ok: false, error: "Import batch not found or already finished." };

  const sessions = parsed.data.map((s) => ({ ...s, source: "import" as const, deletedAt: undefined }));
  const existing = await db.workoutSession.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      date: { in: [...new Set(sessions.map((s) => s.date))].map(dayToDate) },
      OR: [{ importBatchId: null }, { importBatchId: { not: batchId } }],
    },
    select: { id: true, date: true },
  });
  const taken = new Set(existing.map((e) => e.date.toISOString().slice(0, 10)));

  const toSave = policy === "skip" ? sessions.filter((s) => !taken.has(s.date)) : sessions;
  const skipped = sessions.length - toSave.length;
  const replacedIds = policy === "replace" ? existing.map((e) => e.id) : [];

  if (replacedIds.length) {
    await db.workoutSession.updateMany({
      where: { id: { in: replacedIds }, userId: user.id },
      data: { deletedAt: new Date(), clientUpdatedAt: new Date() },
    });
  }
  if (toSave.length) {
    const results = await saveSessions(user.id, toSave, { importBatchId: batchId });
    const bad = results.find((r) => r.status !== "saved");
    if (bad) return { ok: false, error: `A session was ${bad.status === "rejected" ? `rejected (${bad.reason})` : "not saved"}.` };
  }

  const prev = { ...EMPTY_SUMMARY, ...((batch.summary as Partial<BatchSummary> | null) ?? {}) };
  const summary: BatchSummary = {
    sessions: prev.sessions + toSave.length,
    sets: prev.sets + toSave.reduce((n, s) => n + s.entries.reduce((m, e) => m + e.sets.filter((x) => x.done).length, 0), 0),
    skipped: prev.skipped + skipped,
    replaced: prev.replaced + replacedIds.length,
    replacedSessionIds: [...prev.replacedSessionIds, ...replacedIds],
  };
  await db.importBatch.update({ where: { id: batch.id }, data: { summary, rowCount: summary.sessions } });
  return { ok: true, saved: toSave.length, skipped };
}

export async function finishBatch(batchId: string): Promise<{ ok: boolean }> {
  const user = await requirePageUser("/import");
  const res = await db.importBatch.updateMany({
    where: { id: batchId, userId: user.id, status: "draft" },
    data: { status: "committed", committedAt: new Date() },
  });
  return { ok: res.count === 1 };
}

export interface BatchRow {
  id: string;
  sourceName: string | null;
  status: string;
  createdAt: string;
  sessions: number;
  sets: number;
  skipped: number;
  replaced: number;
}

export async function listBatches(): Promise<BatchRow[]> {
  const user = await requirePageUser("/import");
  const rows = await db.importBatch.findMany({
    where: { userId: user.id, status: { in: ["committed", "undone", "draft"] } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return rows.map((b) => {
    const s = { ...EMPTY_SUMMARY, ...((b.summary as Partial<BatchSummary> | null) ?? {}) };
    return {
      id: b.id,
      sourceName: b.sourceName,
      status: b.status,
      createdAt: b.createdAt.toISOString(),
      sessions: s.sessions,
      sets: s.sets,
      skipped: s.skipped,
      replaced: s.replaced,
    };
  });
}

/** Remove everything a batch added and bring back what it replaced. Other devices see it on their next pull. */
export async function undoBatch(batchId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requirePageUser("/import");
  const batch = await db.importBatch.findFirst({ where: { id: batchId, userId: user.id } });
  if (!batch || batch.status === "undone") return { ok: false, error: "Nothing to undo." };
  const summary = { ...EMPTY_SUMMARY, ...((batch.summary as Partial<BatchSummary> | null) ?? {}) };
  const now = new Date();
  await db.$transaction([
    db.workoutSession.updateMany({
      where: { userId: user.id, importBatchId: batch.id, deletedAt: null },
      data: { deletedAt: now, clientUpdatedAt: now },
    }),
    db.workoutSession.updateMany({
      where: { userId: user.id, id: { in: summary.replacedSessionIds } },
      data: { deletedAt: null, clientUpdatedAt: now },
    }),
    db.importBatch.update({ where: { id: batch.id }, data: { status: "undone", undoneAt: now } }),
  ]);
  return { ok: true };
}
