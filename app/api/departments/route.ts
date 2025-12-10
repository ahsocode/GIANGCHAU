"use server";

import { NextResponse } from "next/server";
import { prisma, isPrismaEnabled } from "@/lib/prisma/client";

export async function GET() {
  if (!isPrismaEnabled()) {
    return NextResponse.json({ error: "Prisma chưa được cấu hình" }, { status: 500 });
  }
  const data = await prisma.department.findMany({
    orderBy: [{ code: "asc" }],
  });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  if (!isPrismaEnabled()) {
    return NextResponse.json({ error: "Prisma chưa được cấu hình" }, { status: 500 });
  }

  const body = await req.json();
  const { name, code, notes } = body || {};
  if (!name || !code) {
    return NextResponse.json({ error: "Thiếu name hoặc code" }, { status: 400 });
  }

  try {
    const created = await prisma.department.create({
      data: { name, code, notes },
    });
    return NextResponse.json(created);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không thể tạo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
