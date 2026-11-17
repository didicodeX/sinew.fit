"use server";

import { revalidatePath } from "next/cache";
import { db } from "@lib/db";
import { isValidIsoDate } from "@domain/dates";
import { requirePageUser } from "@/server/current-user";

export type StructureResult = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/program");
  revalidatePath("/");
}

/** Replace the exercise of a planned row, keeping its sets, range and rest. */
export async function swapPlannedExercise(
  plannedId: string,
  exerciseId: string,
  effectiveFrom: string,
): Promise<StructureResult> {
  if (!isValidIsoDate(effectiveFrom)) return { ok: false, error: "Bad date." };
  const user = await requirePageUser("/program");
  const [row, ex] = await Promise.all([
    db.plannedExercise.findFirst({
      where: { id: plannedId, part: { template: { userId: user.id } } },
      select: { id: true, sets: true, targetMin: true, targetMax: true, workingTarget: true },
    }),
    db.exercise.findFirst({ where: { id: exerciseId, userId: user.id }, select: { id: true, kind: true, name: true } }),
  ]);
  if (!row || !ex) return { ok: false, error: "Not found." };
  await db.$transaction([
    db.plannedExercise.update({
      where: { id: row.id },
      data: {
        exerciseId: ex.id,
        // A hold has seconds, a rep exercise has reps
        targetUnit: ex.kind === "hold" ? "sec" : "reps",
        altExerciseId: null,
      },
    }),
    // Logged in the target history so the change shows up there
    db.targetChange.create({
      data: {
        plannedExerciseId: row.id,
        effectiveFrom: new Date(`${effectiveFrom}T00:00:00Z`),
        sets: row.sets,
        targetMin: row.targetMin,
        targetMax: row.targetMax,
        workingTarget: row.workingTarget,
        reason: `Swapped to ${ex.name}`.slice(0, 200),
      },
    }),
  ]);
  refresh();
  return { ok: true };
}

export async function removePlannedExercise(plannedId: string): Promise<StructureResult> {
  const user = await requirePageUser("/program");
  const res = await db.plannedExercise.deleteMany({
    where: { id: plannedId, part: { template: { userId: user.id } } },
  });
  if (res.count === 0) return { ok: false, error: "Not found." };
  refresh();
  return { ok: true };
}

/** Append an exercise to a part with starting defaults (edit them right after). */
export async function addPlannedExercise(partId: string, exerciseId: string): Promise<StructureResult> {
  const user = await requirePageUser("/program");
  const [part, ex] = await Promise.all([
    db.templatePart.findFirst({
      where: { id: partId, template: { userId: user.id } },
      select: { id: true, items: { select: { order: true }, orderBy: { order: "desc" }, take: 1 } },
    }),
    db.exercise.findFirst({ where: { id: exerciseId, userId: user.id }, select: { id: true, kind: true } }),
  ]);
  if (!part || !ex) return { ok: false, error: "Not found." };
  const hold = ex.kind === "hold";
  await db.plannedExercise.create({
    data: {
      partId: part.id,
      order: (part.items[0]?.order ?? -1) + 1,
      exerciseId: ex.id,
      sets: 3,
      targetMin: hold ? 10 : 8,
      targetMax: hold ? 20 : 12,
      targetUnit: hold ? "sec" : "reps",
      restSec: 90,
    },
  });
  refresh();
  return { ok: true };
}
