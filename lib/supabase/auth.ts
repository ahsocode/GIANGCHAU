import type { Account } from "../types/account";
import { getSupabaseServerClient, isSupabaseServerEnabled } from "./server";
import { verifyPassword } from "../auth/password";

const ACCOUNT_COLUMNS =
  "id,employee_code,full_name,email,phone,role,login_type,is_active,created_at,password";

type AccountRow = {
  id?: string;
  employee_code?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  login_type?: "PASSWORD" | "GOOGLE" | null;
  is_active?: boolean | null;
  created_at?: string | null;
  password?: string | null;
};

function mapAccountRow(row: AccountRow): Account {
  return {
    id: String(row.id ?? ""),
    employeeCode: row.employee_code ?? null,
    fullName: row.full_name || "",
    email: row.email || "",
    phone: row.phone || "",
    role: row.role || "",
    loginType: row.login_type || "PASSWORD",
    isActive: Boolean(row.is_active ?? true),
    createdAt: row.created_at || "",
  };
}

export function isSupabaseAuthEnabled(): boolean {
  return isSupabaseServerEnabled();
}

export async function findAccountByEmailPasswordSupabase(
  email: string,
  password: string
): Promise<Account | null> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("email", email)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return null;

  if (!data.is_active) {
    throw new Error("Tài khoản bị khóa");
  }

  const isMatch = await verifyPassword(password, data.password);
  if (!isMatch) {
    return null;
  }

  return mapAccountRow(data);
}
