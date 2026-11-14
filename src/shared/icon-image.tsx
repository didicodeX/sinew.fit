import { ImageResponse } from "next/og";

/** PNG app icon rendered at build time (installability needs PNG sizes). */
export function iconImage(size: number) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0b0d10" }}>
        <svg width={size} height={size} viewBox="0 0 64 64">
          <path d="M18 44c6-18 22-6 28-24" stroke="#c6f36b" strokeWidth="7" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
