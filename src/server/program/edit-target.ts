"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@lib/db";
import { isValidIsoDate } from "@domain/dates";
import { requirePageUser } from "@/server/current-user";

const schema = z
  .object({
    sets: z.number().int().min(1).max(20),
    targetMin: z.number().int().min(1).max(999),
    targetMax: z.number().int().min(1).max(999).nullable(),
    restSec: z.number().int().min(0).max(3600).nullable(),
    restMaxSec: z.number().int().min(0).max(3600).nullable(),
    reason: z.string().trim().max(200).optional(),
    /** Local calendar date the change takes effect. */
    effectiveFrom: z.string().refine(isValidIsoDate),
  })
  .refine((v) => v.targetMax === null || v.targetMax >= v.targetMin, "max < min")
  .refine((v) => v.restMaxSec === null || (v.restSec !== null && v.restMaxSec > v.restSec), "rest max <= min");

export type TargetEdit = z.infer<typeof schema>;
export type EditResult = { ok: true } | { ok: false; error: string };

/**
 * Change a planned exercise's sets / range / rest and log it in the versioned target
 * history (brief P1 #9). Past sessions keep the targets they were done with.
 */
export async function editPlannedTarget(plannedId: string, raw: TargetEdit): Promise<EditResult> {
  const user = await requirePageUser("/program");
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the numbers." };
  const v = parsed.data;

  const row = await db.plannedExercise.findFirst({
    where: { id: plannedId, part: { template: { userId: user.id } } },
    select: { id: true, workingTarget: true },
  });
  if (!row) return { ok: false, error: "Not found." };

  // Keep the working target inside the new range
  const top = v.targetMax ?? v.targetMin;
  const working = row.workingTarget === null ? null : Math.min(Math.max(row.workingTarget, v.targetMin), top);

  await db.$transaction([
    db.plannedExercise.update({
      where: { id: row.id },
      data: {
        sets: v.sets,
        targetMin: v.targetMin,
        targetMax: v.targetMax,
        workingTarget: working,
        restSec: v.restSec,
        restMaxSec: v.restMaxSec,
      },
    }),
    db.targetChange.create({
      data: {
        plannedExerciseId: row.id,
        effectiveFrom: new Date(`${v.effectiveFrom}T00:00:00Z`),
        sets: v.sets,
        targetMin: v.targetMin,
        targetMax: v.targetMax,
        workingTarget: working,
        reason: v.reason || null,
      },
    }),
  ]);
  revalidatePath("/program");
  revalidatePath("/");
  return { ok: true };
}

export interface TargetHistoryEntry {
  id: string;
  effectiveFrom: string;
  sets: number;
  targetMin: number;
  targetMax: number | null;
  reason: string | null;
}

/** Target history of one planned exercise, newest first. */
export async function getTargetHistory(plannedId: string): Promise<TargetHistoryEntry[]> {
  const user = await requirePageUser("/program");
  const rows = await db.targetChange.findMany({
    where: { plannedExerciseId: plannedId, plannedExercise: { part: { template: { userId: user.id } } } },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  return rows.map((r) => ({
    id: r.id,
    effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10),
    sets: r.sets,
    targetMin: r.targetMin,
    targetMax: r.targetMax,
    reason: r.reason,
  }));
}
