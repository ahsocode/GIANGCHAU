import { NextResponse } from "next/server";
import { prisma, isPrismaEnabled } from "@/lib/prisma/client";

const ROLE_BLOCKLIST = ["ADMIN"];

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!isPrismaEnabled()) {
    return NextResponse.json({ error: "Prisma chưa được cấu hình" }, { status: 500 });
  }

  const { id } = await context.params;
  const accountId = decodeURIComponent(id || "");
  if (!accountId) {
    return NextResponse.json({ error: "Thiếu mã tài khoản" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { fullName, email, roleKey, phone, isActive } = body;

  const nextRole = roleKey ? String(roleKey).toUpperCase() : undefined;
  if (nextRole && ROLE_BLOCKLIST.includes(nextRole)) {
    return NextResponse.json({ error: "Không thể gán quyền ADMIN" }, { status: 400 });
  }

  try {
    const updated = await prisma.account.update({
      where: { id: accountId },
      data: {
        fullName: fullName ?? undefined,
        email: email ?? undefined,
        phone: phone ?? undefined,
        roleKey: nextRole ?? undefined,
        isActive: typeof isActive === "boolean" ? isActive : undefined,
      },
    });

    return NextResponse.json({
      id: updated.id,
      code: updated.employeeCode || "",
      name: updated.fullName,
      email: updated.email,
      phone: updated.phone || "",
      roleKey: updated.roleKey || "",
      roleName: updated.roleKey || "",
      loginType: updated.loginType,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không thể cập nhật tài khoản";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
