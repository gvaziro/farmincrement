import { iconPng } from "@/pwa/iconImage";

/** PNG icons for the manifest: /pwa-icon/192, /pwa-icon/512 and /pwa-icon/maskable. */
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }, { size: "maskable" }];
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  return size === "maskable" ? iconPng(512, true) : iconPng(size === "192" ? 192 : 512);
}
