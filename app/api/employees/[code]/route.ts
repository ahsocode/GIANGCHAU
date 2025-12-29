import { NextResponse } from "next/server";
import { prisma, isPrismaEnabled } from "@/lib/prisma/client";
import { isSupabaseEnabled, getSupabaseClient } from "@/lib/supabase/client";
import { fetchEmployeesFromSupabase } from "@/lib/supabase/hr";

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
    code: acc.employeeCode || acc.id || "",
    name: acc.fullName || "",
    roleKey,
    roleName,
    phone: acc.phone || "",
    email: acc.email || "",
    cccd: acc.detail?.cccd || "",
    bhxh: acc.detail?.bhxh || "",
    employmentType,
    workStatus,
    workStatusLabel: workStatus === "ACTIVE" ? "Đang làm" : "Đã nghỉ",
    startDate: acc.detail?.startDate || "",
    department: acc.detail?.department || "",
    shiftCode: acc.detail?.shiftCode || null,
  };
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await context.params;
  const code = decodeURIComponent(rawCode || "").trim();
  if (!code) {
    return NextResponse.json({ error: "Thiếu mã nhân viên" }, { status: 400 });
  }

  const codeLower = code.toLowerCase();

  if (isPrismaEnabled()) {
    try {
      const account = await prisma.account.findFirst({
        where: {
          OR: [
            { employeeCode: code },
            { employeeCode: code.toUpperCase() },
            { id: code },
            { email: code },
          ],
        },
        include: { detail: true },
      });

      if (account) {
        return NextResponse.json(mapAccount(account));
      }
    } catch (err) {
      console.warn("Prisma employee detail failed, will try Supabase fallback:", err);
    }
  }

  if (isSupabaseEnabled()) {
    try {
      const supabase = getSupabaseClient();
      const employees = await fetchEmployeesFromSupabase(supabase);
      const found = employees.find((e) => (e.code || "").toLowerCase() === codeLower);
      if (found) return NextResponse.json(found);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Không tải được dữ liệu nhân viên (Supabase)";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  if (!isPrismaEnabled()) {
    return NextResponse.json(
      { error: "Prisma chưa được cấu hình" },
      { status: 500 }
    );
  }

  const { code: rawCode } = await context.params;
  const code = decodeURIComponent(rawCode || "").trim();
  if (!code) {
    return NextResponse.json({ error: "Thiếu mã nhân viên" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    name,
    roleKey,
    roleName,
    phone,
    email,
    cccd,
    bhxh,
    employmentType,
    workStatus,
    startDate,
    department,
    shiftCode,
  } = body;

  const validEmployment =
    employmentType === "FULL_TIME" || employmentType === "TEMPORARY"
      ? employmentType
      : undefined;
  const validStatus = workStatus === "ACTIVE" || workStatus === "INACTIVE" ? workStatus : undefined;

  try {
    const account = await prisma.account.findFirst({
      where: { employeeCode: code },
      include: { detail: true },
    });
    if (!account) {
      return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });
    }

    const updated = await prisma.account.update({
      where: { id: account.id },
      data: {
        fullName: name ?? account.fullName,
        phone: phone ?? account.phone,
        email: email ?? account.email,
        roleKey: roleKey ?? account.roleKey,
        detail: {
          update: {
            cccd: cccd ?? account.detail?.cccd,
            bhxh: bhxh ?? account.detail?.bhxh,
            department: department ?? account.detail?.department,
            shiftCode: shiftCode ?? account.detail?.shiftCode,
            employmentType: validEmployment ?? account.detail?.employmentType,
            workStatus: validStatus ?? account.detail?.workStatus,
            startDate: startDate ?? account.detail?.startDate,
            position: roleName ?? account.detail?.position,
          },
        },
      },
      include: { detail: true },
    });

    return NextResponse.json({
      code: updated.employeeCode || code,
      name: updated.fullName,
      roleKey: updated.roleKey || undefined,
      roleName: updated.detail?.position || roleName || undefined,
      phone: updated.phone || "",
      email: updated.email || "",
      cccd: updated.detail?.cccd || "",
      bhxh: updated.detail?.bhxh || "",
      employmentType: (updated.detail?.employmentType || "FULL_TIME") as "FULL_TIME" | "TEMPORARY",
      workStatus: (updated.detail?.workStatus || "ACTIVE") as "ACTIVE" | "INACTIVE",
      workStatusLabel: (updated.detail?.workStatus || "ACTIVE") === "ACTIVE" ? "Đang làm" : "Đã nghỉ",
      startDate: updated.detail?.startDate || "",
      department: updated.detail?.department || "",
      shiftCode: updated.detail?.shiftCode || null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không thể cập nhật";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ code: string }> }
) {
  if (!isPrismaEnabled()) {
    return NextResponse.json(
      { error: "Prisma chưa được cấu hình" },
      { status: 500 }
    );
  }

  const { code: rawCode } = await context.params;
  const code = decodeURIComponent(rawCode || "").trim();
  if (!code) {
    return NextResponse.json({ error: "Thiếu mã nhân viên" }, { status: 400 });
  }

  try {
    const account = await prisma.account.findFirst({
      where: { employeeCode: code },
    });
    if (!account) {
      return NextResponse.json({ error: "Không tìm thấy nhân viên" }, { status: 404 });
    }

    await prisma.accountDetail.deleteMany({ where: { accountId: account.id } });
    await prisma.account.delete({ where: { id: account.id } });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không thể xóa nhân viên";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
