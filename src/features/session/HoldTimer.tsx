"use client";

import { useState } from "react";
import { useNow } from "./useNow";

/** Full-screen stopwatch for holds: Start → Stop fills the set value. */
export function HoldTimer({
  title,
  target,
  onDone,
  onCancel,
}: {
  title: string;
  target: string;
  onDone: (seconds: number) => void;
  onCancel: () => void;
}) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const now = useNow(startedAt !== null, 100);
  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-bg px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">Hold</p>
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
        <button type="button" onClick={onCancel} className="h-11 px-3 text-muted">
          Cancel
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="tabular text-[8rem] leading-none font-bold">{elapsed}</div>
        <div className="mt-2 text-muted">seconds · target {target}</div>
      </div>
      {startedAt === null ? (
        <button
          type="button"
          onClick={() => setStartedAt(Date.now())}
          className="h-20 w-full rounded-2xl bg-accent text-2xl font-bold text-accent-fg"
        >
          Start
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onDone(Math.max(1, Math.floor((Date.now() - startedAt) / 1000)))}
          className="h-20 w-full rounded-2xl bg-warn text-2xl font-bold text-accent-fg"
        >
          Stop · save {elapsed} s
        </button>
      )}
    </div>
  );
}
