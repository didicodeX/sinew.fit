"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@shared/utils";

const ITEMS = [
  { href: "/", label: "Today" },
  { href: "/program", label: "Program" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  // Hidden where it would get in the way: sign-in, and the session (rest bar lives there)
  if (pathname === "/signin" || pathname.startsWith("/session")) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-xl">
        {ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex h-16 items-center justify-center text-base font-medium",
                  active ? "text-accent" : "text-muted",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
