import type { SVGProps } from "react";

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** Six dots: "grab and drag to reorder". */
export function GripIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} fill="currentColor" stroke="none" {...props}>
      {[8, 16].flatMap((x) => [5, 12, 19].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} />))}
    </svg>
  );
}

/** Pencil: "edit". */
export function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
