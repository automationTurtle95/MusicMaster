"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; adminOnly?: boolean };

export function SidebarNav({
  items,
  role,
}: {
  items: NavItem[];
  role?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items
        .filter((item) => !item.adminOnly || role === "ADMIN")
        .map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
    </nav>
  );
}
