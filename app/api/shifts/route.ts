"use server";

import { NextResponse } from "next/server";
import { prisma, isPrismaEnabled } from "@/lib/prisma/client";

const includeCapacities = { capacities: { include: { department: true } } } as const;

export async function GET() {
  if (!isPrismaEnabled()) {
    return NextResponse.json({ error: "Prisma chưa được cấu hình" }, { status: 500 });
  }

  const data = await prisma.workConfig.findMany({
    orderBy: [{ shift: "asc" }],
    include: includeCapacities as any,
  });

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  if (!isPrismaEnabled()) {
    return NextResponse.json({ error: "Prisma chưa được cấu hình" }, { status: 500 });
  }

  const body = await req.json();
  const {
    name,
    shift,
    standardCheckIn,
    standardCheckOut,
    lateGraceMinutes = 5,
    earlyLeaveGraceMinutes = 5,
    overtimeThresholdMinutes = 60,
    capacities = [],
  } = body || {};

  if (!name || shift == null || !standardCheckIn || !standardCheckOut) {
    return NextResponse.json({ error: "Thiếu trường bắt buộc" }, { status: 400 });
  }

  try {
    const created = await prisma.workConfig.create({
      data: {
        name,
        shift: Number(shift),
        standardCheckIn,
        standardCheckOut,
        lateGraceMinutes: Number(lateGraceMinutes),
        earlyLeaveGraceMinutes: Number(earlyLeaveGraceMinutes),
        overtimeThresholdMinutes: Number(overtimeThresholdMinutes),
        capacities: {
          create:
            Array.isArray(capacities) &&
            capacities
              .filter((c: { departmentId?: string; maxEmployees?: number } | null | undefined) => {
                return c?.departmentId && c.maxEmployees != null;
              })
              .map((c) => ({
                departmentId: c?.departmentId as string,
                maxEmployees: Number(c?.maxEmployees) || 0,
              })),
        },
      },
      include: includeCapacities as any,
    });

    return NextResponse.json(created);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không thể tạo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
