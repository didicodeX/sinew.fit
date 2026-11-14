import { iconImage } from "@shared/icon-image";

const SIZES = ["192", "512"] as const;

export const dynamicParams = false;
export function generateStaticParams() {
  return SIZES.map((size) => ({ size }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  return iconImage(Number(size));
}
