import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@lib/db";
import { buildSeedRows } from "./seed-rows";

/**
 * Give a user the starting program (brief §7) as editable data.
 * Idempotent: does nothing if the user already has a program.
 * Rows get their ids up front so everything is written in one batched transaction.
 */
export async function seedUserProgram(userId: string): Promise<{ seeded: boolean }> {
  const existing = await db.program.count({ where: { userId } });
  if (existing > 0) return { seeded: false };

  const rows = buildSeedRows(userId, randomUUID);
  await db.$transaction([
    db.progressionChain.createMany({ data: rows.chains }),
    db.exercise.createMany({ data: rows.exercises }),
    db.progressionStep.createMany({ data: rows.steps }),
    db.sessionTemplate.createMany({ data: rows.templates }),
    db.templatePart.createMany({ data: rows.parts }),
    db.plannedExercise.createMany({ data: rows.planned }),
    db.program.create({ data: rows.program }),
    db.programDay.createMany({ data: rows.days }),
  ]);
  return { seeded: true };
}
