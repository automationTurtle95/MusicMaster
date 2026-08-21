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
    // JWT-Strategie: rollen-/identitätsrelevante Felder vom User in den Token
    // und von dort in die Session propagieren. Ohne diese Callbacks landen
    // `role`/`id` nicht in `session.user` (Default kopiert nur name/email/picture/sub).
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id ?? session.user.id;
        session.user.role = token.role ?? "MEMBER";
        session.user.name = token.name ?? session.user.name;
        session.user.email = token.email ?? session.user.email;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
