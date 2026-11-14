import { TodayView } from "@features/today/TodayView";
import { requirePageUser } from "@/server/current-user";
import { getUserProgram } from "@/server/program/get-program";

export default async function TodayPage() {
  const user = await requirePageUser("/");
  const { program, templates, exercises } = await getUserProgram(user.id);
  return <TodayView program={program} templates={templates} exercises={exercises} />;
}
