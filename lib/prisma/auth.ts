import type { Account } from "../types/account";
import { prisma, isPrismaEnabled } from "./client";
import { verifyPassword } from "../auth/password";

type AccountRow = {
  id?: string;
  employeeCode?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  roleKey?: string | null;
  role?: string | null;
  loginType?: "PASSWORD" | "GOOGLE";
  password?: string | null;
  isActive?: boolean | null;
  createdAt?: Date | string | null;
};

function mapAccount(row: AccountRow): Account {
  return {
    id: String(row.id ?? ""),
    employeeCode: row.employeeCode ?? null,
    fullName: row.fullName || "",
    email: row.email || "",
    phone: row.phone || "",
    role: row.roleKey || row.role || "",
    loginType: row.loginType || "PASSWORD",
    isActive: Boolean(row.isActive ?? true),
    createdAt: (row.createdAt as string) || "",
  };
}

export { isPrismaEnabled };

export async function findAccountByEmailPasswordPrisma(
  email: string,
  password: string
): Promise<Account | null> {
  const account = await prisma.account.findFirst({
    where: { email },
  });

  if (!account) return null;
  if (!account.isActive) {
    throw new Error("Tài khoản bị khóa");
  }

  const isMatch = await verifyPassword(password, account.password);
  if (!isMatch) return null;

  return mapAccount(account);
}
