import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";

import authConfig from "@/lib/auth.config";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { rateLimitAllow } from "@/lib/rate-limit";
import { Role, signInSchema } from "@/lib/validations/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(raw, request) {
        const ip =
          request?.headers
            ?.get("x-forwarded-for")
            ?.split(",")[0]
            ?.trim() ||
          request?.headers?.get("x-real-ip") ||
          "unknown";

        // Konto aus den Credentials als zweiter Schlüssel: verhindert einen
        // globalen Lockout, falls x-forwarded-for/x-real-ip fehlt (z. B. direkter
        // Node-Server ohne Proxy) – sonst teilen ALLE Logins ein Limit.
        const email =
          (raw && typeof raw === "object" && "email" in raw
            ? String((raw as Record<string, unknown>).email ?? "")
            : "") || "unknown";

        // Brute-Force-Schutz: max. 10 Login-Versuche pro Konto+IP/Minute.
        if (!rateLimitAllow(`login:${ip}:${email}`)) return null;

        const parsed = signInSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
        });
        if (!user?.password) return null;

        const valid = await verifyPassword(parsed.data.password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: (user.role as Role) ?? "MEMBER",
        };
      },
    }),
    // E-Mail-Login via Resend. Benötigt RESEND_API_KEY + E-Mail-"from".
    // Solange der Key fehlt, ist der Provider registriert, aber inaktiv.
    ...(process.env.RESEND_API_KEY
      ? [
          Resend({
            from: process.env.AUTH_EMAIL_FROM ?? "MusicMaster <noreply@musicmaster.app>",
          }),
        ]
      : []),
  ],
});
