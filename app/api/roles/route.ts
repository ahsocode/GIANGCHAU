"use server";

import { NextResponse } from "next/server";
import { prisma, isPrismaEnabled } from "@/lib/prisma/client";

function normalizeKey(value: string) {
  const mapSpecial = (v: string) =>
    v
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/ă/g, "a")
      .replace(/Ă/g, "A")
      .replace(/â/g, "a")
      .replace(/Â/g, "A")
      .replace(/ê/g, "e")
      .replace(/Ê/g, "E")
      .replace(/ô/g, "o")
      .replace(/Ô/g, "O")
      .replace(/ơ/g, "o")
      .replace(/Ơ/g, "O")
      .replace(/ư/g, "u")
      .replace(/Ư/g, "U");
  const cleaned = mapSpecial(value.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  return cleaned.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
}

export async function GET() {
  if (!isPrismaEnabled()) {
    return NextResponse.json({ error: "Prisma chưa được cấu hình" }, { status: 500 });
  }
  const data = await prisma.role.findMany({
    orderBy: [{ id: "asc" }],
  });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  if (!isPrismaEnabled()) {
    return NextResponse.json({ error: "Prisma chưa được cấu hình" }, { status: 500 });
  }
  const body = await req.json();
  const { name, shortName, key: customKey } = body || {};
  if (!name || !shortName) {
    return NextResponse.json({ error: "Thiếu name hoặc shortName" }, { status: 400 });
  }

  try {
    const key = customKey ? normalizeKey(customKey) : normalizeKey(name);
    const created = await prisma.role.create({
      data: { name, shortName, key },
    });
    return NextResponse.json(created);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không thể tạo chức vụ";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
