import { NextResponse } from "next/server";
import type { DirectorSection } from "@/app/types";
import { prisma, isPrismaEnabled } from "@/lib/prisma/client";

const LOCKED_ROLES = new Set(["ADMIN", "DIRECTOR"]);

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function GET() {
  if (!isPrismaEnabled()) {
    return NextResponse.json(
      { error: "Prisma chưa được cấu hình" },
      { status: 500 }
    );
  }

  const [sections, roles, access] = await Promise.all([
    prisma.appSection.findMany({
      where: { isEnabled: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    prisma.role.findMany({
      select: { key: true, name: true, isDirector: true },
      orderBy: { id: "asc" },
    }),
    prisma.roleSectionAccess.findMany({
      include: { role: true, section: true },
    }),
  ]);

  const allKeys = sections.map((s) => s.key as DirectorSection);
  const roleAccess: Record<string, DirectorSection[]> = {};

  roles.forEach((r) => {
    const upper = (r.key || "").toUpperCase();
    if (LOCKED_ROLES.has(upper)) {
      roleAccess[upper] = allKeys;
    }
  });

  access.forEach((a) => {
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

  const role = await prisma.role.findUnique({ where: { key: roleKey } });
  if (!role) return badRequest("Role không tồn tại");

  const allSections = await prisma.appSection.findMany({
    where: { key: { in: sections } },
  });
  const sectionIdByKey = new Map(allSections.map((s) => [s.key, s.id]));
  if (!sectionIdByKey.size) return badRequest("Không có section hợp lệ");

  const targetIds = sections
    .map((k) => sectionIdByKey.get(k))
    .filter((v) => typeof v === "number") as number[];

  await prisma.$transaction(async (tx) => {
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
