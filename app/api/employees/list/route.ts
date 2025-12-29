import { NextResponse } from "next/server";
import { prisma, isPrismaEnabled } from "@/lib/prisma/client";
import { isSupabaseEnabled, getSupabaseClient } from "@/lib/supabase/client";
import { fetchEmployeesFromSupabase } from "@/lib/supabase/hr";

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 200;

function parseIntSafe(value: string | null, fallback: number): number {
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return n;
}

const roleTranslations: Record<string, string> = {
  DIRECTOR: "Giám đốc",
  ADMIN: "Quản trị",
  MANAGER: "Quản lý",
  ACCOUNTANT: "Kế toán",
  SUPERVISOR: "Giám sát",
  EMPLOYEE: "Nhân viên",
};

type PrismaAccount = {
  employeeCode?: string | null;
  id?: string;
  fullName?: string;
  phone?: string | null;
  email?: string | null;
  roleKey?: string | null;
  roleName?: string | null;
  detail?: {
    position?: string | null;
    employmentType?: string | null;
    workStatus?: string | null;
    cccd?: string | null;
    bhxh?: string | null;
    startDate?: string | null;
    department?: string | null;
    shiftCode?: string | null;
  } | null;
};

function mapAccount(acc: PrismaAccount) {
  const roleKey = (acc.roleKey || "").toUpperCase();
  const roleName =
    acc.detail?.position ||
    acc.roleName ||
    roleTranslations[roleKey] ||
    acc.roleName ||
    acc.roleKey;

  const employmentType = acc.detail?.employmentType || "FULL_TIME";
  const workStatus = acc.detail?.workStatus || "ACTIVE";

  return {
    code: acc.employeeCode || acc.id,
    name: acc.fullName,
    roleKey,
    roleName,
    employmentType,
    department: acc.detail?.department || "",
    shiftCode: acc.detail?.shiftCode || null,
  } as const;
}

function buildQuery(searchParams: URLSearchParams) {
  const page = parseIntSafe(searchParams.get("page"), 1);
  const pageSize = Math.min(
    parseIntSafe(searchParams.get("pageSize"), PAGE_SIZE_DEFAULT),
    PAGE_SIZE_MAX
  );
  const sortBy = (searchParams.get("sortBy") || "").toLowerCase();
  const sortDir =
    (searchParams.get("sortDir") || "").toLowerCase() === "desc" ? "desc" : "asc";
  const roleKey = (searchParams.get("roleKey") || "").toUpperCase();
  const employmentType = (searchParams.get("employmentType") || "").toUpperCase();
  const department = searchParams.get("department") || "";
  const shiftCode = searchParams.get("shiftCode") || "";

  const where: Record<string, unknown> = {
    NOT: { roleKey: "ADMIN" },
  };
  if (roleKey) where.roleKey = roleKey;
  if (employmentType === "FULL_TIME" || employmentType === "TEMPORARY") {
    where.detail = { ...(where.detail || {}), employmentType };
  }
  if (department) {
    where.detail = { ...(where.detail || {}), department };
  }
  if (shiftCode) {
    where.detail = { ...(where.detail || {}), shiftCode };
  }

  let orderBy: Record<string, string> = { employeeCode: "asc" };
  if (sortBy === "code") orderBy = { employeeCode: sortDir };
  else if (sortBy === "name") orderBy = { fullName: sortDir };
  else if (sortBy === "role") orderBy = { roleKey: sortDir };

  return {
    pagination: { page, pageSize },
    filters: { where, orderBy },
    selection: { roleKey, employmentType, department, shiftCode },
  };
}

async function loadEmployees(searchParams: URLSearchParams) {
  const { pagination, filters, selection } = buildQuery(searchParams);
  const { page, pageSize } = pagination;
  const { where, orderBy } = filters;
  const { roleKey, employmentType, department, shiftCode } = selection;

  if (isPrismaEnabled()) {
    try {
      const items = await prisma.account.findMany({
        where,
        select: {
          id: true,
          employeeCode: true,
          fullName: true,
          roleKey: true,
          detail: {
            select: {
              position: true,
              employmentType: true,
              department: true,
              shiftCode: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      const total = await prisma.account.count({ where });

      if (items.length) {
        const mapped = items.map(mapAccount);
        return {
          page,
          pageSize,
          total,
          items: mapped,
        };
      }
    } catch (err) {
      console.warn("Prisma employees query failed, will try Supabase fallback:", err);
    }
  }

  if (isSupabaseEnabled()) {
    try {
      const supabase = getSupabaseClient();
      const employees = await fetchEmployeesFromSupabase(supabase);
      const filtered = employees
        .filter((e) => (e.roleKey || "").toUpperCase() !== "ADMIN")
        .filter((e) => (roleKey ? (e.roleKey || "").toUpperCase() === roleKey : true))
        .filter((e) =>
          employmentType
            ? (e.employmentType || "").toUpperCase() === employmentType
            : true
        )
        .filter((e) => (department ? (e.department || "") === department : true))
        .filter((e) => (shiftCode ? (e.shiftCode || "") === shiftCode : true))
        .map((e) => ({
          code: e.code,
          name: e.name,
          roleKey: (e.roleKey || "").toUpperCase(),
          roleName: e.roleName,
          employmentType: e.employmentType || "FULL_TIME",
          department: e.department || "",
          shiftCode: e.shiftCode || null,
        }));
      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);
      return {
        page,
        pageSize,
        total,
        items,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Không tải được danh sách nhân viên (Supabase)";
      return {
        error: message,
        status: 500,
      };
    }
  }

  return {
    error: "Không có nguồn dữ liệu (Prisma/Supabase) khả dụng",
    status: 500,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const result = await loadEmployees(searchParams);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status || 500 });
  }

  return NextResponse.json(result);
}
