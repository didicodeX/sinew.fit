"use client";

import { formatDuration, restRemaining, type RestTimer } from "@domain/index";
import { cn } from "@shared/utils";

export function RestBar({
  rest,
  now,
  onSkip,
  onAdjust,
}: {
  rest: RestTimer;
  now: number;
  onSkip: () => void;
  onAdjust: (deltaSec: number) => void;
}) {
  const left = restRemaining(rest, now);
  const over = left <= 0;
  const pct = Math.min(100, Math.max(0, (1 - left / Math.max(1, rest.durationSec)) * 100));

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="h-1 bg-surface-2">
        <div className={cn("h-full transition-[width]", over ? "bg-warn" : "bg-accent")} style={{ width: `${pct}%` }} />
      </div>
      <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-3">
        <button type="button" onClick={() => onAdjust(-15)} className="h-12 w-14 rounded-xl border border-line text-muted">
          −15
        </button>
        <div className="flex-1 text-center" aria-live="polite">
          <div className="text-xs uppercase tracking-wide text-muted">{over ? "Rest done" : "Rest"}</div>
          <div className={cn("tabular text-4xl font-bold", over && "text-warn")}>
            {over ? `+${formatDuration(-left)}` : formatDuration(left)}
          </div>
        </div>
        <button type="button" onClick={() => onAdjust(15)} className="h-12 w-14 rounded-xl border border-line text-muted">
          +15
        </button>
        <button type="button" onClick={onSkip} className="h-12 rounded-xl bg-surface-2 px-4 font-semibold">
          {over ? "Go" : "Skip"}
        </button>
      </div>
    </div>
  );
}
