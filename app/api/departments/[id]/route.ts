"use server";

import { NextRequest, NextResponse } from "next/server";
import { prisma, isPrismaEnabled } from "@/lib/prisma/client";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isPrismaEnabled()) {
    return NextResponse.json({ error: "Prisma chưa được cấu hình" }, { status: 500 });
  }
  const { id } = await context.params;
  const body = await req.json();
  const { name, code, notes } = body || {};
  if (!name || !code) {
    return NextResponse.json({ error: "Thiếu name hoặc code" }, { status: 400 });
  }

  try {
    const updated = await prisma.department.update({
      where: { id },
      data: { name, code, notes },
    });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không thể cập nhật";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isPrismaEnabled()) {
    return NextResponse.json({ error: "Prisma chưa được cấu hình" }, { status: 500 });
  }
  const { id } = await context.params;
  try {
    await prisma.department.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không thể xóa";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
