import { NextResponse } from "next/server";
import type { DirectorSection } from "@/app/types";
import { DEFAULT_ROLE_SECTIONS } from "@/lib/role-permissions";
import { prisma, isPrismaEnabled } from "@/lib/prisma/client";

// Prisma client có thể chưa sinh model appSection trên môi trường build hiện tại,
// dùng cast any để tránh lỗi type khi compile.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = prisma;

const LOCKED_ROLES = new Set(["ADMIN", "DIRECTOR"]);
const ALLOWED_ACTIONS = new Set(["VIEW", "CREATE", "UPDATE", "DELETE", "MANAGE"]);
const FALLBACK_SECTIONS: { key: DirectorSection; label: string; path: string; group?: string | null }[] = [
  { key: "overview", label: "Tổng quan", path: "tong-quan" },
  { key: "departments", label: "Quản lý bộ phận", path: "quan-ly-bo-phan" },
  { key: "employeesOverview", label: "Tổng quan nhân viên", path: "quan-ly-nhan-vien/tong-quan-nhan-vien" },
  { key: "employees", label: "Danh sách nhân viên", path: "quan-ly-nhan-vien/danh-sach-nhan-vien" },
  { key: "employeeAccounts", label: "Quản lý tài khoản", path: "quan-ly-nhan-vien/quan-ly-tai-khoan" },
  { key: "attendanceOverview", label: "Tổng quan chấm công", path: "quan-ly-cham-cong" },
  { key: "attendanceDailyReport", label: "Báo cáo chấm công theo ngày", path: "quan-ly-cham-cong/bao-cao-ngay" },
  { key: "attendanceWeeklyReport", label: "Báo cáo chấm công theo tuần", path: "quan-ly-cham-cong/bao-cao-tuan" },
  { key: "attendanceMonthlyReport", label: "Báo cáo chấm công theo tháng", path: "quan-ly-cham-cong/bao-cao-thang" },
  { key: "attendanceEdit", label: "Chỉnh sửa chấm công", path: "quan-ly-cham-cong/chinh-sua" },
  { key: "shiftOverview", label: "Tổng quan ca làm", path: "quan-ly-ca-lam/tong-quan-ca-lam" },
  { key: "shifts", label: "Ca làm", path: "quan-ly-ca-lam/ca-lam" },
  { key: "shiftAssignment", label: "Phân ca", path: "quan-ly-ca-lam/phan-ca" },
  { key: "permissions", label: "Phân quyền", path: "quan-ly-chuc-vu/phan-quyen" },
  { key: "roles", label: "Chức vụ", path: "quan-ly-chuc-vu/chuc-vu" },
];
const FALLBACK_ROLES = [
  { key: "ADMIN", name: "Admin", isDirector: true },
  { key: "DIRECTOR", name: "Giám đốc", isDirector: true },
  { key: "MANAGER", name: "Trưởng phòng", isDirector: false },
  { key: "ACCOUNTANT", name: "Kế toán", isDirector: false },
  { key: "SUPERVISOR", name: "Giám sát", isDirector: false },
  { key: "EMPLOYEE", name: "Nhân viên", isDirector: false },
  { key: "TEMPORARY", name: "Thời vụ", isDirector: false },
];

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

function buildFallbackPayload(reason: string) {
  const allKeys = FALLBACK_SECTIONS.map((s) => s.key as DirectorSection);
  const roleAccess: Record<string, DirectorSection[]> = {
    ...DEFAULT_ROLE_SECTIONS,
    ADMIN: allKeys,
    DIRECTOR: allKeys,
  };

  return {
    sections: FALLBACK_SECTIONS,
    roles: FALLBACK_ROLES,
    roleAccess,
    source: "fallback",
    reason,
  };
}

export async function GET() {
  if (!isPrismaEnabled()) {
    return NextResponse.json(buildFallbackPayload("Prisma is not configured"));
  }

  try {
    const [sections, roles, access] = await Promise.all([
      db.appSection.findMany({
        where: { isEnabled: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      }),
      db.role.findMany({
        select: { key: true, name: true, isDirector: true },
        orderBy: { id: "asc" },
      }),
      db.roleSectionAccess.findMany({
        include: { role: true, section: true },
      }),
    ]);

    const allKeys = sections.map((s: { key: string }) => s.key as DirectorSection);
    const roleAccess: Record<string, DirectorSection[]> = {};

    roles.forEach((r: { key?: string | null }) => {
      const upper = (r.key || "").toUpperCase();
      if (LOCKED_ROLES.has(upper)) {
        roleAccess[upper] = allKeys;
      }
    });

    access.forEach((a: { role?: { key?: string | null }; section?: { key?: string | null } }) => {
      const key = (a.role?.key || "").toUpperCase();
      if (!key || LOCKED_ROLES.has(key)) return;
      const sectionKey = a.section?.key as DirectorSection | undefined;
      if (!sectionKey) return;
      if (!roleAccess[key]) roleAccess[key] = [];
      roleAccess[key].push(sectionKey);
    });

    return NextResponse.json({
      sections,
      roles,
      roleAccess,
    });
  } catch (err) {
    console.error("Failed to load permissions sections", err);
    return NextResponse.json(buildFallbackPayload("Database unavailable"));
  }
}

export async function PUT(req: Request) {
  if (!isPrismaEnabled()) {
    return NextResponse.json(
      { error: "Prisma chưa được cấu hình" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const roleKey = (body?.role || "").toUpperCase();
  const sections: string[] = Array.isArray(body?.sections)
    ? body.sections
    : [];

  if (!roleKey) return badRequest("Thiếu role");
  if (!sections.length) return badRequest("Danh sách section trống");
  if (LOCKED_ROLES.has(roleKey)) return unauthorized("Không thể sửa quyền Admin/Giám đốc");

  const role = await db.role.findUnique({ where: { key: roleKey } });
  if (!role) return badRequest("Role không tồn tại");

  const allSections = await db.appSection.findMany({
    where: { key: { in: sections } },
  });
  const sectionIdByKey = new Map(allSections.map((s: { key: string; id: number }) => [s.key, s.id]));
  if (!sectionIdByKey.size) return badRequest("Không có section hợp lệ");

  const targetIds = sections
    .map((k) => sectionIdByKey.get(k))
    .filter((v) => typeof v === "number") as number[];

  await db.$transaction(async (tx: typeof db) => {
    await tx.roleSectionAccess.deleteMany({
      where: {
        roleId: role.id,
        NOT: { sectionId: { in: targetIds } },
      },
    });

    for (const sec of allSections) {
      await tx.roleSectionAccess.upsert({
        where: {
          roleId_sectionId: { roleId: role.id, sectionId: sec.id },
        },
        update: {
          allowedActions:
            sec.actions && sec.actions.length ? sec.actions : ["VIEW"],
        },
        create: {
          roleId: role.id,
          sectionId: sec.id,
          allowedActions:
            sec.actions && sec.actions.length ? sec.actions : ["VIEW"],
        },
      });
    }
  });

  return NextResponse.json({
    role: roleKey,
    sections: sections as DirectorSection[],
  });
}

export async function POST(req: Request) {
  if (!isPrismaEnabled()) {
    return NextResponse.json(
      { error: "Prisma chưa được cấu hình" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const requesterRole = (body?.role || "").toUpperCase();
  if (requesterRole !== "ADMIN") return unauthorized("Chỉ Admin được phép thêm chức năng mới");

  const rawKey = (body?.key || "").trim();
  const label = (body?.label || "").trim();
  const pathInput = (body?.path || "").trim();
  const group = (body?.group || "").trim();
  const sortOrderRaw = Number(body?.sortOrder);

  if (!rawKey) return badRequest("Thiếu key chức năng");
  if (!label) return badRequest("Thiếu tên hiển thị");
  if (!pathInput) return badRequest("Thiếu path điều hướng");

  const key = rawKey.replace(/\s+/g, "_");
  const path = pathInput.replace(/^\//, "");
  const sortOrder = Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0;

  const actionsInput = Array.isArray(body?.actions) ? body.actions : [];
  const actions = actionsInput
    .map((a: unknown) => String(a || "").toUpperCase())
    .filter((a: string) => ALLOWED_ACTIONS.has(a));

  const existing = await db.appSection.findUnique({ where: { key } });
  if (existing) return badRequest("Key chức năng đã tồn tại");

  const created = await db.appSection.create({
    data: {
      key,
      label,
      path,
      group: group || null,
      sortOrder,
      actions: actions.length ? actions : ["VIEW"],
      isEnabled: true,
    },
  });

  return NextResponse.json({ section: created });
}
