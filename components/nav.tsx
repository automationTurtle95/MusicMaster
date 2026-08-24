import Link from "next/link";

import { auth, signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/members", label: "Mitglieder" },
  { href: "/rehearsals", label: "Proben" },
  { href: "/events", label: "Auftritte" },
  { href: "/sheets", label: "Noten" },
];

async function logoutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export async function Nav() {
  const session = await auth();
  const user = session?.user;

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

          {user ? (
            <div className="ml-3 flex items-center gap-3 border-l pl-3">
              <span className="text-sm">
                <span className="font-medium text-foreground">
                  {user.name ?? user.email}
                </span>
                <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {user.role}
                </span>
              </span>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Logout
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="ml-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
