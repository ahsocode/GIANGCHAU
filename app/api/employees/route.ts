import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma, isPrismaEnabled } from "@/lib/prisma/client";
import { generateEmployeeCode } from "@/lib/employee-code";

export async function GET() {
  return NextResponse.json(
    {
      error:
        "API danh sách nhân viên đã tách riêng. Vui lòng dùng /api/employees/list hoặc /api/employees/info tùy tab.",
    },
    { status: 410 }
  );
}

type CreateEmployeeBody = {
  name?: string;
  roleKey?: string;
  roleName?: string;
  employmentType?: string;
  department?: string;
  workStatus?: string;
  startDate?: string;
  email?: string;
  phone?: string;
  cccd?: string;
  bhxh?: string;
};

export async function POST(req: Request) {
  if (!isPrismaEnabled()) {
    return NextResponse.json(
      { error: "Prisma chưa được cấu hình" },
      { status: 500 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as CreateEmployeeBody;
  const name = (body.name || "").trim();
  const roleKey = (body.roleKey || "").trim().toUpperCase();
  const roleName = (body.roleName || "").trim();
  const employmentType =
    (body.employmentType || "").trim().toUpperCase() === "TEMPORARY"
      ? "TEMPORARY"
      : "FULL_TIME";
  const workStatus =
    (body.workStatus || "").trim().toUpperCase() === "INACTIVE"
      ? "INACTIVE"
      : "ACTIVE";
  const department = (body.department || "").trim();
  const startDate =
    (body.startDate || "").trim() || new Date().toISOString().slice(0, 10);
  const email = (body.email || "").trim();
  const phone = (body.phone || "").trim();
  const cccd = (body.cccd || "").trim();
  const bhxh = (body.bhxh || "").trim();

  if (!name) {
    return NextResponse.json({ error: "Thiếu họ tên" }, { status: 400 });
  }
  if (!roleKey) {
    return NextResponse.json({ error: "Thiếu chức vụ" }, { status: 400 });
  }

  try {
    const role = await prisma.role.findUnique({ where: { key: roleKey } });
    const shortRole =
      (role?.shortName || roleKey || "NV").slice(0, 4).toUpperCase();

    const existingCodes = await prisma.account.findMany({
      select: { employeeCode: true },
      where: { employeeCode: { not: null } },
    });

    const employeeCode = generateEmployeeCode({
      shortRole,
      startDate,
      employmentType: employmentType as "FULL_TIME" | "TEMPORARY",
      existingCodes: existingCodes
        .map((r) => r.employeeCode)
        .filter((c): c is string => Boolean(c)),
    });

    const created = (await prisma.account.create({
      data: {
        employeeCode,
        fullName: name,
        email: email || `${employeeCode.toLowerCase()}@auto.local`,
        phone: phone || null,
        roleKey,
        loginType: "PASSWORD",
        isActive: true,
        detail: {
          create: {
            position: roleName || role?.name || null,
            employmentType,
            workStatus,
            startDate,
            department: department || null,
            cccd: cccd || null,
            bhxh: bhxh || null,
          },
        },
      },
      include: { detail: true },
    })) as Prisma.AccountGetPayload<{ include: { detail: true } }>;

    return NextResponse.json({
      code: created.employeeCode || "",
      name: created.fullName,
      roleKey: created.roleKey || undefined,
      roleName: created.detail?.position || roleName || undefined,
      phone: created.phone || "",
      email: created.email || "",
      cccd: created.detail?.cccd || "",
      bhxh: created.detail?.bhxh || "",
      employmentType: (created.detail?.employmentType || "FULL_TIME") as
        | "FULL_TIME"
        | "TEMPORARY",
      workStatus: (created.detail?.workStatus || "ACTIVE") as "ACTIVE" | "INACTIVE",
      workStatusLabel:
        (created.detail?.workStatus || "ACTIVE") === "ACTIVE" ? "Đang làm" : "Đã nghỉ",
      startDate: created.detail?.startDate || startDate,
      department: created.detail?.department || "",
      shiftCode: created.detail?.shiftCode || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không thể tạo nhân viên";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
