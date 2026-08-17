import Link from "next/link";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/members", label: "Mitglieder" },
  { href: "/rehearsals", label: "Proben" },
  { href: "/events", label: "Auftritte" },
  { href: "/sheets", label: "Noten" },
];

export function Nav() {
  return (
    <header className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          MusicMaster
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
