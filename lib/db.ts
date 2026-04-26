import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Always cache the client on globalThis — prevents connection pool exhaustion
// in long-lived serverless Lambda invocations serving multiple requests.
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ["error"] });

globalForPrisma.prisma = db;
