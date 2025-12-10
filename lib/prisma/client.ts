import { PrismaClient } from "@prisma/client";

type MiddlewareParams = {
  model?: string;
  action?: string;
  args?: Record<string, unknown>;
};

type MiddlewareNext = (params: MiddlewareParams) => Promise<unknown>;
type MiddlewareFn = (params: MiddlewareParams, next: MiddlewareNext) => Promise<unknown>;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Đảm bảo mỗi Account luôn có một AccountDetail đi kèm
function ensureAccountDetail(client: PrismaClient) {
  const marker = "_accountDetailMiddlewareSet";
  const typed = client as unknown as {
    [key: string]: unknown;
    $use?: (middleware: MiddlewareFn) => void;
  };

  if (typed[marker]) return;
  if (typeof typed.$use !== "function") return;

  typed.$use(async (params: MiddlewareParams, next: MiddlewareNext) => {
    const result = await next(params);

    if (params.model === "Account" && (params.action === "create" || params.action === "upsert")) {
      const accountId =
        (result as { id?: string } | null | undefined)?.id ||
        ((params.args as { where?: { id?: string } } | undefined)?.where?.id as string | undefined);

      if (accountId) {
        await client.accountDetail.upsert({
          where: { accountId },
          update: {},
          create: { accountId },
        });
      }
    }

    return result;
  });

  typed[marker] = true;
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

ensureAccountDetail(prisma);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export function isPrismaEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
