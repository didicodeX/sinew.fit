import type { Metadata, Viewport } from "next";
import { BottomNav } from "@shared/components/BottomNav";
import { ServiceWorker } from "@shared/components/ServiceWorker";
import { APP } from "@shared/config/app";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP.name, template: `%s · ${APP.name}` },
  description: APP.description,
  applicationName: APP.name,
  appleWebApp: { capable: true, title: APP.name, statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: APP.themeColor,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh antialiased">
        <main className="mx-auto max-w-xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-28">{children}</main>
        <BottomNav />
        <ServiceWorker />
      </body>
    </html>
  );
}
