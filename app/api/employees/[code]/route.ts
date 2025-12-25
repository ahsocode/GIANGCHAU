import { NextResponse } from "next/server";
import { prisma, isPrismaEnabled } from "@/lib/prisma/client";

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
