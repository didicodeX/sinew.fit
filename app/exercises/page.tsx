import type { Metadata } from "next";
import { ExerciseLibrary } from "@features/exercises/ExerciseLibrary";
import { requirePageUser } from "@/server/current-user";
import { getUserProgram } from "@/server/program/get-program";

export const metadata: Metadata = { title: "Exercises" };

export default async function ExercisesPage() {
  const user = await requirePageUser("/exercises");
  const { exercises } = await getUserProgram(user.id);
  return <ExerciseLibrary exercises={exercises} />;
}
