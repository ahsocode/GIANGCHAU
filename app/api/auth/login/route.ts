// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { findAccountByEmailPassword } from "@/lib/mockapi";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Thiếu email hoặc mật khẩu" },
        { status: 400 }
      );
    }

    const account = await findAccountByEmailPassword(email, password);

    if (!account) {
      return NextResponse.json(
        { error: "Sai email hoặc mật khẩu" },
        { status: 401 }
      );
    }

    return NextResponse.json({ account });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi đăng nhập";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
