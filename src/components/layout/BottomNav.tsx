"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, Dumbbell, History } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Calendar", icon: CalendarDays },
  { href: "/routines", label: "Routines", icon: ClipboardList },
  { href: "/exercises", label: "Exercises", icon: Dumbbell },
  { href: "/history", label: "History", icon: History },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-zinc-800/90 bg-[#09090B]/95 backdrop-blur-md"
    >
      <div className="mx-auto grid w-full max-w-lg grid-cols-4 px-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                isActive
                  ? "text-emerald-400"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${
                  isActive ? "text-emerald-400" : "text-zinc-400"
                }`}
                aria-hidden="true"
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
