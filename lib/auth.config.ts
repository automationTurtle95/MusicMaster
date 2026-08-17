import type { NextAuthConfig } from "next-auth";

// Edge-sichere Basis-Konfiguration (kein Prisma/Node-Import!).
// Wird von der Middleware (Edge-Runtime) genutzt und als Basis für die
// volle Node-Config in `lib/auth.ts` (Adapter + Credentials) erweitert.
export const authConfig = {
  providers: [],
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isApiAuth = nextUrl.pathname.startsWith("/api/auth");
      const isPublic = ["/", "/login"].includes(nextUrl.pathname);

      if (isApiAuth || isPublic) return true;
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
