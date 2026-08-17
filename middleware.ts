import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";

// Edge-Middleware nutzt die node-freie Basis-Config (kein Prisma / node:crypto).
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
