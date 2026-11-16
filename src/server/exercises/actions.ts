"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@lib/db";
import { normalizeExerciseName } from "@domain/index";
import { requirePageUser } from "@/server/current-user";

const input = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["reps", "hold"]),
  perSide: z.boolean(),
  allowsWeight: z.boolean(),
  allowsAssistance: z.boolean(),
  aliases: z.array(z.string().trim().min(1).max(80)).max(20),
  notes: z.string().trim().max(500).optional(),
});

export type ExerciseInput = z.infer<typeof input>;
export type ActionResult = { ok: true } | { ok: false; error: string };

async function nameTaken(userId: string, normalizedName: string, exceptId?: string) {
  const hit = await db.exercise.findFirst({
    where: { userId, normalizedName, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  return hit !== null;
}

export async function createExercise(raw: ExerciseInput): Promise<ActionResult> {
  const user = await requirePageUser("/exercises");
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the fields." };
  const normalizedName = normalizeExerciseName(parsed.data.name);
  if (await nameTaken(user.id, normalizedName)) return { ok: false, error: "An exercise with this name exists." };
  await db.exercise.create({ data: { ...parsed.data, notes: parsed.data.notes || null, userId: user.id, normalizedName } });
  revalidatePath("/exercises");
  return { ok: true };
}

export async function updateExercise(id: string, raw: ExerciseInput): Promise<ActionResult> {
  const user = await requirePageUser("/exercises");
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the fields." };
  const normalizedName = normalizeExerciseName(parsed.data.name);
  if (await nameTaken(user.id, normalizedName, id)) return { ok: false, error: "An exercise with this name exists." };
  const res = await db.exercise.updateMany({
    where: { id, userId: user.id },
    data: { ...parsed.data, notes: parsed.data.notes || null, normalizedName },
  });
  if (res.count === 0) return { ok: false, error: "Not found." };
  revalidatePath("/exercises");
  return { ok: true };
}

/** Retire, don't delete: history stays intact (brief P1 9b). */
export async function setExerciseArchived(id: string, archived: boolean, reason?: string): Promise<ActionResult> {
  const user = await requirePageUser("/exercises");
  const res = await db.exercise.updateMany({
    where: { id, userId: user.id },
    data: archived
      ? { archivedAt: new Date(), archivedReason: reason?.trim().slice(0, 200) || null }
      : { archivedAt: null, archivedReason: null },
  });
  if (res.count === 0) return { ok: false, error: "Not found." };
  revalidatePath("/exercises");
  return { ok: true };
}
