import { PrismaClient } from "@prisma/client";

function logDbError(model: string | undefined, operation: string, error: unknown) {
  const e = error as { code?: string; message?: string; meta?: unknown };
  console.error("[db-error] Failed to execute statement", {
    model,
    operation,
    code: e?.code,
    message: e?.message,
    meta: e?.meta,
  });
}

function buildPrisma() {
  return new PrismaClient().$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        try {
          return await query(args);
        } catch (err) {
          logDbError(model, operation, err);
          throw err;
        }
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof buildPrisma> | undefined;
};

export const prisma = globalForPrisma.prisma ?? buildPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
