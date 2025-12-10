import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, isSupabaseServerEnabled } from "@/lib/supabase/server";
import { verifyPassword, hashPassword } from "@/lib/auth/password";

export async function POST(req: NextRequest) {
  try {
    const { email, oldPassword, newPassword, confirmPassword } = await req.json();

    if (!email || !oldPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Thiếu thông tin (email, mật khẩu cũ, mật khẩu mới, xác nhận)." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Xác nhận mật khẩu mới không khớp." },
        { status: 400 }
      );
    }

    if (!isSupabaseServerEnabled()) {
      return NextResponse.json(
        { error: "Thiếu cấu hình Supabase Service Role Key." },
        { status: 500 }
      );
    }

    const supabase = getSupabaseServerClient();

    const { data: account, error: fetchError } = await supabase
      .from("accounts")
      .select("id,password,is_active")
      .eq("email", email)
      .maybeSingle();

    if (fetchError) {
      throw new Error(fetchError.message);
    }

    if (!account) {
      return NextResponse.json({ error: "Không tìm thấy tài khoản." }, { status: 404 });
    }

    if (!account.is_active) {
      return NextResponse.json({ error: "Tài khoản bị khóa." }, { status: 403 });
    }

    const isMatch = await verifyPassword(oldPassword, account.password);
    if (!isMatch) {
      return NextResponse.json({ error: "Mật khẩu cũ không đúng." }, { status: 401 });
    }

    const hashed = await hashPassword(newPassword);

    const { error: updateError } = await supabase
      .from("accounts")
      .update({ password: hashed })
      .eq("id", account.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({ message: "Đổi mật khẩu thành công." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lỗi đổi mật khẩu";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
