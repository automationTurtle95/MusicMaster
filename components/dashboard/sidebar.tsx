import Link from "next/link";

import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getIsoWeek } from "@/lib/dashboard";
import { SidebarNav, type SidebarNavItem } from "./sidebar-nav";

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export async function Sidebar() {
  const [membersCount, rehearsalsCount, sheetsCount, instrumentsCount] =
    await Promise.all([
      prisma.member.count(),
      prisma.rehearsal.count(),
      prisma.sheetMusic.count(),
      prisma.instrument.count(),
    ]);

  const session = await auth();
  const role = session?.user?.role;
  const week = getIsoWeek(new Date());

  const navItems: SidebarNavItem[] = [
    { num: "01", href: "/dashboard", label: "Dashboard", badge: null },
    { num: "02", href: "/rehearsals", label: "Probenplan", badge: rehearsalsCount },
    { num: "03", href: "/members", label: "Mitglieder", badge: membersCount },
    { num: "04", href: "/instruments", label: "Instrumente", badge: instrumentsCount },
    { num: "05", href: "/sheets", label: "Notenarchiv", badge: sheetsCount },
  ];

  return (
    <aside className="flex w-[235px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex flex-col gap-4 p-4">
        <Link href="/dashboard" className="block">
          <span className="text-lg font-bold tracking-tight">MusicMaster</span>
          <span className="block text-xs text-muted-foreground">
            Musikverein Harmonie e.V.
          </span>
        </Link>

        <SidebarNav items={navItems} />
      </div>

      <div className="mt-auto flex flex-col gap-3 p-4">
        <div className="rounded-lg border border-sidebar-border bg-card p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Saison 2026/27
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, Math.round((week / 52) * 100))}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Woche {week} von 52
          </p>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{role ?? "MITGLIED"}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md px-2 py-1 font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              Abmelden
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
