"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UserRole =
  | "DIRECTOR"
  | "MANAGER"
  | "ACCOUNTANT"
  | "SUPERVISOR"
  | "EMPLOYEE"
  | "TEMPORARY";

interface Account {
  id: string;
  employeeCode: string | null;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  loginType: "PASSWORD" | "GOOGLE";
  isActive: boolean;
  createdAt: string;
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("director@giangchau.com");
  const [password, setPassword] = useState("0900000001");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Đăng nhập thất bại");
      }

      const account = data.account as Account;

      if (typeof window !== "undefined") {
        localStorage.setItem("currentAccount", JSON.stringify(account));
      }

      switch (account.role) {
        case "DIRECTOR":
          router.push("/director");
          break;
        case "MANAGER":
          router.push("/manager");
          break;
        default:
          router.push("/employee");
          break;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Đăng nhập thất bại";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function handleFakeGoogleLogin() {
    alert("Login with Google hiện chỉ là UI demo, chưa tích hợp OAuth.");
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6">
        {/* Panel trái: brand + intro */}
        <div className="hidden md:flex flex-col justify-between rounded-2xl bg-blue-900 text-white p-8 shadow-lg">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">
              Thủy Sản Giang Châu
            </h1>
            <p className="mt-2 text-sm text-blue-100">
              Hệ thống chấm công & quản lý nhân sự nội bộ.
            </p>
          </div>
          <div className="mt-6 space-y-2 text-sm text-blue-100">
            <p>• Theo dõi chấm công theo ngày / tháng</p>
            <p>• Phân quyền theo vai trò: Giám đốc, quản lý, kế toán, nhân viên</p>
            <p>• Quản lý nhân viên chính thức & thời vụ</p>
          </div>
          <div className="mt-8 text-xs text-blue-200">
            © {new Date().getFullYear()} Thủy Sản Giang Châu
          </div>
        </div>

        {/* Panel phải: form login */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-slate-900">
              Đăng nhập hệ thống
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Sử dụng tài khoản nội bộ được cấp cho nhân viên.
            </p>
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={handleFakeGoogleLogin}
              className="w-full flex items-center justify-center gap-2 border border-slate-200 rounded-lg py-2.5 text-sm hover:bg-slate-50 transition"
            >
              <div className="h-4 w-4 rounded-full bg-red-500" />
              <span>Đăng nhập với Google (demo)</span>
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="flex-1 h-px bg-slate-200" />
              <span>hoặc</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 text-sm p-2 rounded-md">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vd: director@giangchau.com"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">
                  Mật khẩu
                </label>
                <input
                  type="password"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="mặc định là số điện thoại"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 mt-2 transition"
              >
                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
