// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  findAccountByEmailPasswordSupabase,
  isSupabaseAuthEnabled,
} from "@/lib/supabase/auth";
import {
  findAccountByEmailPasswordPrisma,
  isPrismaEnabled,
} from "@/lib/prisma/auth";
import type { Account } from "@/lib/types/account";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Thiếu email hoặc mật khẩu" },
        { status: 400 }
      );
    }

    const prismaEnabled = isPrismaEnabled();
    const supabaseEnabled = isSupabaseAuthEnabled();

    if (!prismaEnabled && !supabaseEnabled) {
      return NextResponse.json(
        { error: "Thiếu cấu hình Prisma hoặc Supabase" },
        { status: 500 }
      );
    }

    let account: Account | null = null;

    if (prismaEnabled) {
      account = await findAccountByEmailPasswordPrisma(email, password);
    }

    if (!account && supabaseEnabled) {
      account = await findAccountByEmailPasswordSupabase(email, password);
    }

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
