import { z } from "zod";
import { isValidIsoDate } from "@domain/dates";

/** Payload pushed by a client (web today, watch later). Unknown keys (device-only state) are stripped. */
const id = z.string().min(1).max(64);
const unit = z.enum(["reps", "sec"]);

export const syncSetSchema = z.object({
  index: z.number().int().min(0).max(99),
  value: z.number().int().min(0).max(999),
  unit,
  side: z.enum(["L", "R"]).optional(),
  weightKg: z.number().min(-500).max(500).optional(),
  assistance: z
    .object({
      type: z.enum(["band", "machine"]),
      label: z.string().max(60).optional(),
      kg: z.number().min(0).max(500).optional(),
    })
    .optional(),
  rir: z.number().int().min(0).max(10).optional(),
  clean: z.boolean().optional(),
  restActualSec: z.number().int().min(0).max(24 * 3600).optional(),
  note: z.string().max(500).optional(),
  done: z.boolean(),
});

export const syncEntrySchema = z.object({
  id,
  exerciseId: id,
  order: z.number().int().min(0).max(200),
  partName: z.string().max(120).optional(),
  supersetGroup: z.string().max(40).optional(),
  plannedSets: z.number().int().min(0).max(99).optional(),
  plannedTarget: z
    .object({ min: z.number().int().min(0).max(999), max: z.number().int().min(0).max(999).optional(), unit })
    .optional(),
  plannedWorking: z.number().int().min(0).max(999).optional(),
  restSec: z.number().int().min(0).max(3600).optional(),
  breakAfterSec: z.number().int().min(0).max(24 * 3600).optional(),
  notes: z.string().max(2000).optional(),
  discomfort: z.enum(["none", "mild", "pain"]).optional(),
  sets: z.array(syncSetSchema).max(100),
});

export const syncSessionSchema = z.object({
  id,
  date: z.string().refine(isValidIsoDate, "Invalid date"),
  startedAt: z.iso.datetime().optional(),
  endedAt: z.iso.datetime().optional(),
  templateId: id.optional(),
  title: z.string().max(120).optional(),
  sessionNotes: z.string().max(5000).optional(),
  isDeload: z.boolean(),
  source: z.enum(["app", "import"]),
  entries: z.array(syncEntrySchema).max(60),
  /** Client clock (epoch ms) of the last local edit. */
  updatedAt: z.number().int().positive(),
  deletedAt: z.number().int().positive().optional(),
});

export const syncPushSchema = z.object({
  sessions: z.array(syncSessionSchema).min(1).max(20),
});

export type SyncSession = z.infer<typeof syncSessionSchema>;
export type SyncResult = { id: string; status: "saved" | "stale" | "rejected"; reason?: string };
