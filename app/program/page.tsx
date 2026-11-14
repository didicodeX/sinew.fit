import type { Metadata } from "next";
import {
  RECOVERY_GUIDANCE,
  TRAINING_RULES,
  WEEKDAY_NAMES,
  type Weekday,
} from "@domain/index";
import { AccountCard } from "@features/auth/AccountCard";
import { TemplateParts } from "@features/program/TemplateParts";
import { requirePageUser } from "@/server/current-user";
import { getUserProgram } from "@/server/program/get-program";

export const metadata: Metadata = { title: "Program" };

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

export default async function ProgramPage() {
  const user = await requirePageUser("/program");
  const { program, templates, exercises, chains } = await getUserProgram(user.id);
  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted">Program</p>
        <h1 className="text-3xl font-bold tracking-tight">{program.name}</h1>
      </header>

      <div className="space-y-3">
        {WEEKDAYS.map((weekday) => {
          const t = templates.find((x) => x.id === program.week[weekday]);
          return (
            <details key={weekday} className="rounded-2xl border border-line bg-surface">
              <summary className="flex items-center gap-3 px-4 py-3">
                <span className="w-24 text-muted">{WEEKDAY_NAMES[weekday]}</span>
                <span className="font-semibold">{t ? t.name : "Full rest"}</span>
              </summary>
              {t ? (
                <div className="border-t border-line p-3">
                  <TemplateParts template={t} exercises={exercises} />
                </div>
              ) : null}
            </details>
          );
        })}
      </div>

      <Section title="Rules" items={TRAINING_RULES} />
      <Section title="Deload and pain" items={RECOVERY_GUIDANCE} />
      <Section title="Skill progression chains" items={chains.map((c) => `${c.name}: ${c.steps.join(" → ")}`)} />

      <AccountCard />
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <details className="rounded-2xl border border-line bg-surface">
      <summary className="px-4 py-3 font-semibold">{title}</summary>
      <ul className="list-disc space-y-1 border-t border-line px-8 py-3 text-sm">
        {items.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </details>
  );
}
