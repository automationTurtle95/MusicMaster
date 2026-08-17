import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Resend from "next-auth/providers/resend";

import authConfig from "@/lib/auth.config";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
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
      async authorize(raw) {
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
