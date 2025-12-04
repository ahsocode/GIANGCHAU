// lib/mockapi.ts
export type UserRole =
  | "DIRECTOR"
  | "MANAGER"
  | "ACCOUNTANT"
  | "SUPERVISOR"
  | "EMPLOYEE"
  | "TEMPORARY";

export interface Account {
  id: string;
  employeeCode: string | null;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  loginType: "PASSWORD" | "GOOGLE";
  isActive: boolean;
  createdAt: string;
}

// lấy base URL mỗi lần dùng
function getBaseUrl() {
  const url = process.env.MOCKAPI_BASE_URL;
  if (!url) {
    throw new Error("Missing MOCKAPI_BASE_URL in env");
  }
  return url;
}

export async function findAccountByEmailPassword(
  email: string,
  password: string
): Promise<Account | null> {
  const baseUrl = getBaseUrl();
  const qs = new URLSearchParams({ email, password }).toString();

  const res = await fetch(`${baseUrl}/accounts?${qs}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("MockAPI error", await res.text());
    throw new Error("MockAPI request failed");
  }

  const data = (await res.json()) as Account[];
  if (data.length === 0) return null;

  const acc = data[0];
  if (!acc.isActive) {
    throw new Error("Tài khoản bị khóa");
  }

  return acc;
}
