import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MusicMaster",
  description: "Verwaltungssoftware für Musikvereine – Mitglieder, Proben, Auftritte, Noten.",
};

const modules = [
  { href: "/members", label: "Mitglieder" },
  { href: "/rehearsals", label: "Proben" },
  { href: "/events", label: "Auftritte" },
  { href: "/sheets", label: "Noten" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b bg-white">
            <div className="mx-auto max-w-5xl px-4 py-3 flex items-center gap-6">
              <Link href="/" className="font-semibold text-lg">
                MusicMaster
              </Link>
              <nav className="flex gap-4 text-sm">
                {modules.map((m) => (
                  <Link key={m.href} href={m.href} className="text-slate-600 hover:text-slate-900">
                    {m.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-5xl w-full px-4 py-6 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
