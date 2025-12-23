import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error:
        "API danh sách nhân viên đã tách riêng. Vui lòng dùng /api/employees/list hoặc /api/employees/info tùy tab.",
    },
    { status: 410 }
  );
}
