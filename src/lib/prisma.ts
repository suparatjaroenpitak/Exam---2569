import { Pool } from "pg";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/env";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function createAdapter() {
  if (env.databaseProvider === "postgresql" || env.databaseUrl.startsWith("postgresql://")) {
    return new PrismaPg(new Pool({ connectionString: env.databaseUrl }));
  }

  return new PrismaBetterSqlite3({
    url: env.databaseUrl
  });
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter: createAdapter()
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}