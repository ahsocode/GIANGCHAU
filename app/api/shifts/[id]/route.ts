"use server";

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma, isPrismaEnabled } from "@/lib/prisma/client";

const includeCapacities: Prisma.WorkConfigInclude = { capacities: { include: { department: true } } };

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isPrismaEnabled()) {
    return NextResponse.json({ error: "Prisma chưa được cấu hình" }, { status: 500 });
  }
  const { id } = await params;
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
    const updated = await prisma.workConfig.update({
      where: { id: Number(id) },
      data: {
        name,
        shift: Number(shift),
        standardCheckIn,
        standardCheckOut,
        lateGraceMinutes: Number(lateGraceMinutes),
        earlyLeaveGraceMinutes: Number(earlyLeaveGraceMinutes),
        overtimeThresholdMinutes: Number(overtimeThresholdMinutes),
        capacities: Array.isArray(capacities)
          ? {
              deleteMany: {},
              create: capacities
                .filter(
                  (c: { departmentId?: string; maxEmployees?: number } | null | undefined) =>
                    c?.departmentId && c.maxEmployees != null
                )
                .map((c) => ({
                  departmentId: c?.departmentId as string,
                  maxEmployees: Number(c?.maxEmployees) || 0,
                })),
            }
          : undefined,
      },
      include: includeCapacities,
    });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không thể cập nhật";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isPrismaEnabled()) {
    return NextResponse.json({ error: "Prisma chưa được cấu hình" }, { status: 500 });
  }
  const { id } = await params;
  try {
    await prisma.workConfig.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Không thể xóa";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
