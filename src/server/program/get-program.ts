import "server-only";
import { db } from "@lib/db";
import type { ExerciseDef, ProgramDef, ProgressionChainDef, SessionTemplate } from "@domain/types";
import { seedUserProgram } from "./seed-user";
import { chainInclude, templateInclude, toChains, toExercises, toProgram, toTemplates } from "./to-domain";

export interface UserProgram {
  program: ProgramDef;
  templates: SessionTemplate[];
  exercises: ExerciseDef[];
  chains: ProgressionChainDef[];
}

/** The user's active program as domain data. Every query is scoped by `userId`. */
export async function getUserProgram(userId: string): Promise<UserProgram> {
  let program = await db.program.findFirst({
    where: { userId, active: true },
    include: { days: true },
    orderBy: { createdAt: "desc" },
  });

  // Safety net if the sign-up seed failed (idempotent)
  if (!program) {
    await seedUserProgram(userId);
    program = await db.program.findFirstOrThrow({ where: { userId, active: true }, include: { days: true } });
  }

  const [templates, exercises, chains] = await Promise.all([
    db.sessionTemplate.findMany({ where: { userId }, include: templateInclude }),
    db.exercise.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    db.progressionChain.findMany({ where: { userId }, include: chainInclude }),
  ]);

  return {
    program: toProgram(program),
    templates: toTemplates(templates),
    exercises: toExercises(exercises, chains),
    chains: toChains(chains),
  };
}
