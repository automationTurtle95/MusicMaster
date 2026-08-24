import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MusicMaster",
  description: "Verwaltungssoftware für Musikvereine – Mitglieder, Proben, Auftritte, Noten.",
};

// Die frühere Kopf-Navigation (Mitglieder/Proben/Auftritte/Noten) wurde entfernt – redundant
// zur linken Sidebar (components/dashboard/sidebar.tsx), die dieselben Links bereits bietet
// (Lukas' Feedback 24.08.2026: "Navigationsbar in der Kopfzeile ist sinnlos"). Das Root-Layout
// ist jetzt eine reine Hülle; die (app)-Routengruppe bringt ihre eigene Sidebar-Navigation mit,
// die Login-Seite braucht keinen zusätzlichen Header.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
