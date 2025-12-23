import { NextResponse } from "next/server";
import { prisma, isPrismaEnabled } from "@/lib/prisma/client";
import { isSupabaseEnabled, getSupabaseClient } from "@/lib/supabase/client";

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

function parseIntSafe(value: string | null, fallback: number): number {
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return n;
}

const ROLE_LABELS: Record<string, string> = {
  DIRECTOR: "Giám đốc",
  ADMIN: "Quản trị",
  MANAGER: "Quản lý",
  ACCOUNTANT: "Kế toán",
  SUPERVISOR: "Giám sát",
  EMPLOYEE: "Nhân viên",
};

type AccountRow = {
  id: string;
  employeeCode?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  roleKey?: string | null;
  roleName?: string | null;
  loginType?: string | null;
  isActive?: boolean | null;
  createdAt?: string | Date | null;
};

function mapAccount(row: AccountRow) {
  const roleKey = ((row.role || row.roleKey) || "").toUpperCase();
  return {
    id: row.id,
    code: row.employeeCode || "",
    name: row.fullName || "",
    email: row.email || "",
    phone: row.phone || "",
    roleKey,
    roleName: row.roleName || ROLE_LABELS[roleKey] || roleKey,
    loginType: row.loginType || "LOCAL",
    isActive: row.isActive ?? true,
    createdAt: row.createdAt ? new Date(row.createdAt) : null,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseIntSafe(searchParams.get("page"), 1);
  const pageSize = Math.min(parseIntSafe(searchParams.get("pageSize"), PAGE_SIZE_DEFAULT), PAGE_SIZE_MAX);
  const search = (searchParams.get("search") || "").trim();
  const roleKey = (searchParams.get("roleKey") || "").toUpperCase();
  const status = (searchParams.get("status") || "").toLowerCase(); // active | inactive | ""
  const sortBy = (searchParams.get("sortBy") || "").toLowerCase(); // createdAt | name | role
  const sortDir = (searchParams.get("sortDir") || "").toLowerCase() === "desc" ? "desc" : "asc";

  // Thử Prisma trước
  if (isPrismaEnabled()) {
    try {
      const baseWhere: Record<string, unknown> = {
        NOT: { roleKey: "ADMIN" },
      };
      if (roleKey) baseWhere.roleKey = roleKey;
      if (status === "active") baseWhere.isActive = true;
      if (status === "inactive") baseWhere.isActive = false;
      if (search) {
        baseWhere.OR = [
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { employeeCode: { contains: search, mode: "insensitive" } },
        ];
      }

      let orderBy: Record<string, string> = { createdAt: "desc" };
      if (sortBy === "name") orderBy = { fullName: sortDir };
      else if (sortBy === "role") orderBy = { roleKey: sortDir };
      else if (sortBy === "createdat") orderBy = { createdAt: sortDir };

      const [items, total] = await Promise.all([
        prisma.account.findMany({
          where: baseWhere,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.account.count({ where: baseWhere }),
      ]);

      if (items.length || !isSupabaseEnabled()) {
        return NextResponse.json({
          page,
          pageSize,
          total,
          items: items.map((item) => mapAccount({
            id: item.id,
            employeeCode: item.employeeCode,
            fullName: item.fullName,
            email: item.email,
            phone: item.phone,
            roleKey: item.roleKey,
            loginType: item.loginType,
            isActive: item.isActive,
            createdAt: item.createdAt,
          })),
        });
      }
    } catch (err: unknown) {
      console.warn("Prisma accounts query failed, fallback to Supabase", err);
    }
  }

  // Fallback Supabase
  if (isSupabaseEnabled()) {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("accounts")
        .select("id, employee_code, full_name, email, phone, role, login_type, is_active, created_at");

      if (error) {
        throw new Error(error.message);
      }

      type SupabaseAccountRow = {
        id: string;
        employee_code?: string | null;
        full_name?: string | null;
        email?: string | null;
        phone?: string | null;
        role?: string | null;
        role_name?: string | null;
        login_type?: string | null;
        is_active?: boolean | null;
        created_at?: string | null;
      };

      const mapped = (data || []).map((row: SupabaseAccountRow) =>
        mapAccount({
          id: row.id,
          employeeCode: row.employee_code,
          fullName: row.full_name,
          email: row.email,
          phone: row.phone,
          role: row.role,
          roleName: row.role_name,
          loginType: row.login_type,
          isActive: row.is_active,
          createdAt: row.created_at,
        })
      );

      const filtered = mapped
        .filter((a) => (roleKey ? (a.roleKey || "").toUpperCase() === roleKey : true))
        .filter((a) => {
          if (status === "active") return a.isActive;
          if (status === "inactive") return !a.isActive;
          return true;
        })
        .filter((a) => {
          if (!search) return true;
          const hay = `${a.name} ${a.email} ${a.code}`.toLowerCase();
          return hay.includes(search.toLowerCase());
        })
        .filter((a) => (a.roleKey || "").toUpperCase() !== "ADMIN");

      const sorted = (() => {
        if (sortBy === "name") {
          return filtered.sort((a, b) => a.name.localeCompare(b.name));
        }
        if (sortBy === "role") {
          return filtered.sort((a, b) => (a.roleKey || "").localeCompare(b.roleKey || ""));
        }
        // createdAt default
        return filtered.sort((a, b) => {
          const av = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bv = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return sortDir === "desc" ? bv - av : av - bv;
        });
      })();

      const total = sorted.length;
      const start = (page - 1) * pageSize;
      const items = sorted.slice(start, start + pageSize);

      return NextResponse.json({ page, pageSize, total, items });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Không tải được danh sách tài khoản (Supabase)";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "Không có nguồn dữ liệu khả dụng (Prisma/Supabase)" },
    { status: 500 }
  );
}