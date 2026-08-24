import Link from "next/link";

import { auth, signOut } from "@/lib/auth";
import { SidebarNav } from "@/components/sidebar-nav";

const navItems = [
  { href: "/members", label: "Mitglieder" },
  { href: "/rehearsals", label: "Proben" },
  { href: "/events", label: "Auftritte" },
  { href: "/sheets", label: "Noten" },
  // Nutzerverwaltung ist ADMIN-exklusiv (siehe lib/authz isAdmin).
  { href: "/users", label: "Nutzer", adminOnly: true },
];

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export async function Sidebar() {
  const session = await auth();
  const user = session?.user;

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center px-5">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-sidebar-foreground"
        >
          MusicMaster
        </Link>
      </div>

      <div className="flex-1 px-3 py-4">
        <SidebarNav items={navItems} role={user?.role} />
      </div>

      <div className="border-t border-sidebar-border p-3">
        {user ? (
          <div className="mb-2 px-2 text-sm">
            <span className="block font-medium">{user.name ?? user.email}</span>
            <span className="text-xs text-sidebar-foreground/70">
              {user.role}
            </span>
          </div>
        ) : null}

        {user ? (
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              Logout
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            className="block rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            Login
          </Link>
        )}
      </div>
    </aside>
  );
}
