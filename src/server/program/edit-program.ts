"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@lib/db";
import { requirePageUser } from "@/server/current-user";

export type EditResult = { ok: true } | { ok: false; error: string };
const NOT_FOUND: EditResult = { ok: false, error: "Not found." };
const name = z.string().trim().min(1).max(120);
const kind = z.enum(["pull", "push", "legs", "core", "other"]);

function refresh() {
  revalidatePath("/program");
  revalidatePath("/");
}

type Dir = "up" | "down";

/** Move an exercise one place within its part. (partId, order) is unique, so park one row at -1 while swapping. */
export async function moveExercise(plannedId: string, dir: Dir): Promise<EditResult> {
  const user = await requirePageUser("/program");
  const row = await db.plannedExercise.findFirst({
    where: { id: plannedId, part: { template: { userId: user.id } } },
    select: { id: true, partId: true, order: true },
  });
  if (!row) return NOT_FOUND;
  const other = await db.plannedExercise.findFirst({
    where: { partId: row.partId, order: dir === "up" ? { lt: row.order } : { gt: row.order } },
    orderBy: { order: dir === "up" ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!other) return { ok: true };
  await db.$transaction([
    db.plannedExercise.update({ where: { id: row.id }, data: { order: -1 } }),
    db.plannedExercise.update({ where: { id: other.id }, data: { order: row.order } }),
    db.plannedExercise.update({ where: { id: row.id }, data: { order: other.order } }),
  ]);
  refresh();
  return { ok: true };
}

export async function movePart(partId: string, dir: Dir): Promise<EditResult> {
  const user = await requirePageUser("/program");
  const row = await db.templatePart.findFirst({
    where: { id: partId, template: { userId: user.id } },
    select: { id: true, templateId: true, order: true },
  });
  if (!row) return NOT_FOUND;
  const other = await db.templatePart.findFirst({
    where: { templateId: row.templateId, order: dir === "up" ? { lt: row.order } : { gt: row.order } },
    orderBy: { order: dir === "up" ? "desc" : "asc" },
    select: { id: true, order: true },
  });
  if (!other) return { ok: true };
  await db.$transaction([
    db.templatePart.update({ where: { id: row.id }, data: { order: -1 } }),
    db.templatePart.update({ where: { id: other.id }, data: { order: row.order } }),
    db.templatePart.update({ where: { id: row.id }, data: { order: other.order } }),
  ]);
  refresh();
  return { ok: true };
}

export async function addPart(templateId: string, rawName: string, rawKind: string): Promise<EditResult> {
  const user = await requirePageUser("/program");
  const n = name.safeParse(rawName);
  const k = kind.safeParse(rawKind);
  if (!n.success || !k.success) return { ok: false, error: "Check the fields." };
  const t = await db.sessionTemplate.findFirst({
    where: { id: templateId, userId: user.id },
    select: { id: true, parts: { select: { order: true }, orderBy: { order: "desc" }, take: 1 } },
  });
  if (!t) return NOT_FOUND;
  await db.templatePart.create({
    data: { templateId: t.id, order: (t.parts[0]?.order ?? -1) + 1, name: n.data, kind: k.data },
  });
  refresh();
  return { ok: true };
}

export async function renamePart(partId: string, rawName: string): Promise<EditResult> {
  const user = await requirePageUser("/program");
  const n = name.safeParse(rawName);
  if (!n.success) return { ok: false, error: "Name required." };
  const res = await db.templatePart.updateMany({
    where: { id: partId, template: { userId: user.id } },
    data: { name: n.data },
  });
  if (res.count === 0) return NOT_FOUND;
  refresh();
  return { ok: true };
}

export async function removePart(partId: string): Promise<EditResult> {
  const user = await requirePageUser("/program");
  const res = await db.templatePart.deleteMany({ where: { id: partId, template: { userId: user.id } } });
  if (res.count === 0) return NOT_FOUND;
  refresh();
  return { ok: true };
}

/** Make a new empty template and put it on a weekday. */
export async function createTemplateForDay(weekday: number, rawName: string): Promise<EditResult> {
  const user = await requirePageUser("/program");
  const n = name.safeParse(rawName);
  if (!n.success || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { ok: false, error: "Check the fields." };
  const program = await db.program.findFirst({ where: { userId: user.id, active: true }, select: { id: true } });
  if (!program) return NOT_FOUND;
  const t = await db.sessionTemplate.create({ data: { userId: user.id, name: n.data } });
  await db.programDay.upsert({
    where: { programId_weekday: { programId: program.id, weekday } },
    create: { programId: program.id, weekday, templateId: t.id },
    update: { templateId: t.id },
  });
  refresh();
  return { ok: true };
}

/** Put an existing template (or null = rest day) on a weekday. */
export async function assignDay(weekday: number, templateId: string | null): Promise<EditResult> {
  const user = await requirePageUser("/program");
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return { ok: false, error: "Check the fields." };
  const [program, t] = await Promise.all([
    db.program.findFirst({ where: { userId: user.id, active: true }, select: { id: true } }),
    templateId ? db.sessionTemplate.findFirst({ where: { id: templateId, userId: user.id }, select: { id: true } }) : null,
  ]);
  if (!program || (templateId && !t)) return NOT_FOUND;
  await db.programDay.upsert({
    where: { programId_weekday: { programId: program.id, weekday } },
    create: { programId: program.id, weekday, templateId },
    update: { templateId },
  });
  refresh();
  return { ok: true };
}

export async function renameTemplate(templateId: string, rawName: string): Promise<EditResult> {
  const user = await requirePageUser("/program");
  const n = name.safeParse(rawName);
  if (!n.success) return { ok: false, error: "Name required." };
  const res = await db.sessionTemplate.updateMany({ where: { id: templateId, userId: user.id }, data: { name: n.data } });
  if (res.count === 0) return NOT_FOUND;
  refresh();
  return { ok: true };
}

/** Days that used it become rest days; logged sessions keep their own copy. */
export async function deleteTemplate(templateId: string): Promise<EditResult> {
  const user = await requirePageUser("/program");
  const res = await db.sessionTemplate.deleteMany({ where: { id: templateId, userId: user.id } });
  if (res.count === 0) return NOT_FOUND;
  refresh();
  return { ok: true };
}
