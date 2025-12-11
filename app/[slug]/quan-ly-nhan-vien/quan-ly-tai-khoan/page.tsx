"use client";

import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import { AppShell } from "@/component/layout/AppShell";
import { isSupabaseEnabled, getSupabaseClient } from "@/lib/supabase/client";

type AccountRow = {
  id: string;
  code: string;
  name: string;
  email: string;
  phone?: string;
  roleKey?: string;
  roleName?: string;
  loginType?: string;
  isActive: boolean;
  createdAt?: string | Date | null;
};

type ApiResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: AccountRow[];
};

const ROLE_LABELS: Record<string, string> = {
  DIRECTOR: "Giám đốc",
  ADMIN: "Quản trị",
  MANAGER: "Quản lý",
  ACCOUNTANT: "Kế toán",
  SUPERVISOR: "Giám sát",
  EMPLOYEE: "Nhân viên",
};

const LOGIN_LABELS: Record<string, string> = {
  LOCAL: "Nội bộ",
  GOOGLE: "Google",
};

export default function AccountManagePage() {
  return (
    <AppShell
      activeSection="employeeAccounts"
      render={() => <AccountManager />}
    />
  );
}

function AccountManager() {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [status, setStatus] = useState(""); // "" | active | inactive
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AccountRow | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  const roleOptions = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(ROLE_LABELS).forEach(([key, label]) => {
      if (key === "ADMIN") return;
      map.set(key, label);
    });
    rows.forEach((r) => {
      const key = (r.roleKey || "").toUpperCase();
      if (!key || key === "ADMIN") return;
      const label = r.roleName || ROLE_LABELS[key] || key;
      if (!map.has(key)) map.set(key, label);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [rows]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      async function loadFromSupabase() {
        if (!isSupabaseEnabled()) return false;
        try {
          const supabase = getSupabaseClient();
          const { data, error } = await supabase
            .from("accounts")
            .select("id, employee_code, full_name, email, phone, role, role_name, login_type, is_active, created_at");
          if (error) throw new Error(error.message);
          type SupabaseAccountRow = {
            id: string;
            employee_code?: string | null;
            full_name?: string | null;
            email?: string | null;
            phone?: string | null;
            role?: string | null;
            role_name?: string | null;
            login_type?: string | null;
            is_active?: boolean | null;
            created_at?: string | null;
          };
          const mapped =
            (data || []).map((row: SupabaseAccountRow) => ({
              id: row.id,
              code: row.employee_code || "",
              name: row.full_name || "",
              email: row.email || "",
              phone: row.phone || "",
              roleKey: (row.role || "").toUpperCase(),
              roleName: row.role_name || ROLE_LABELS[(row.role || "").toUpperCase()] || row.role || "",
              loginType: row.login_type || "LOCAL",
              isActive: row.is_active ?? true,
              createdAt: row.created_at,
            })) || [];

          const filtered = mapped
            .filter((a) => (roleKey ? (a.roleKey || "").toUpperCase() === roleKey : true))
            .filter((a) => {
              if (status === "active") return a.isActive;
              if (status === "inactive") return !a.isActive;
              return true;
            })
            .filter((a) => {
              if (!search) return true;
              const hay = `${a.name} ${a.email} ${a.code}`.toLowerCase();
              return hay.includes(search.toLowerCase());
            });

          const sorted = (() => {
            if (sortBy === "name") {
              return filtered.sort((a, b) => a.name.localeCompare(b.name));
            }
            if (sortBy === "role") {
              return filtered.sort((a, b) => (a.roleKey || "").localeCompare(b.roleKey || ""));
            }
            // createdAt default
            return filtered.sort((a, b) => {
              const av = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const bv = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return sortDir === "desc" ? bv - av : av - bv;
            });
          })();

          const totalFiltered = sorted.length;
          const start = (page - 1) * pageSize;
          const items = sorted.slice(start, start + pageSize);

          setRows(items);
          setTotal(totalFiltered);
          return true;
        } catch (supErr: unknown) {
          const msg = supErr instanceof Error ? supErr.message : "Không tải được từ Supabase";
          setError(msg);
          return false;
        }
      }

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (search) params.set("search", search);
        if (roleKey) params.set("roleKey", roleKey);
        if (status) params.set("status", status);
        if (sortBy) params.set("sortBy", sortBy);
        if (sortDir) params.set("sortDir", sortDir);

        const res = await fetch(`/api/accounts?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Không tải được danh sách tài khoản");
        }
        const data: ApiResponse = await res.json();
        if ((data.items || []).length) {
          setRows(data.items || []);
          setTotal(data.total || 0);
        } else {
          await loadFromSupabase();
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        // thử fallback Supabase
        const ok = await loadFromSupabase();
        if (!ok) setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [page, pageSize, search, roleKey, status, sortBy, sortDir]);

  const formatDate = (value?: string | Date | null) => {
    if (!value) return "-";
    try {
      const d = typeof value === "string" ? new Date(value) : value;
      return d.toLocaleDateString("vi-VN");
    } catch {
      return String(value);
    }
  };

  const toggleActive = async (row: AccountRow) => {
    try {
      const res = await fetch(`/api/accounts/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Không thể cập nhật trạng thái");
      }
      const updated: AccountRow = await res.json();
      setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
      toast.success(updated.isActive ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      toast.error(msg);
    }
  };

  const handleSave = async (draft: Partial<AccountRow> & { id: string }) => {
    try {
      const res = await fetch(`/api/accounts/${encodeURIComponent(draft.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: draft.name,
          email: draft.email,
          phone: draft.phone,
          roleKey: draft.roleKey,
          isActive: draft.isActive,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Không thể cập nhật tài khoản");
      }
      const updated: AccountRow = await res.json();
      setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
      toast.success("Đã cập nhật tài khoản");
      setEditing(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-4">
      <Toaster richColors position="top-right" />
      <header className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
              Quản lý tài khoản đăng nhập
            </p>
            <h2 className="text-lg font-semibold text-slate-900">Tài khoản nhân viên</h2>
            <p className="text-sm text-slate-600">
              Xem, khóa/mở khóa và đổi quyền truy cập của tài khoản nhân viên.
            </p>
          </div>
          <div className="text-xs text-slate-500">
            Tổng số tài khoản:{" "}
            <span className="font-semibold text-slate-800">{total}</span>
          </div>
        </div>
      </header>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo tên, email, mã NV"
              className="border border-slate-200 rounded px-3 py-2 text-xs min-w-[200px]"
            />
            <label>Chức vụ:</label>
            <select
              value={roleKey}
              onChange={(e) => {
                setRoleKey(e.target.value);
                setPage(1);
              }}
              className="border border-slate-200 rounded px-2 py-1 text-xs"
            >
              <option value="">Tất cả</option>
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <label>Trạng thái:</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="border border-slate-200 rounded px-2 py-1 text-xs"
            >
              <option value="">Tất cả</option>
              <option value="active">Hoạt động</option>
              <option value="inactive">Đã khóa</option>
            </select>
            <label>Sắp xếp:</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setSortDir("asc");
              }}
              className="border border-slate-200 rounded px-2 py-1 text-xs"
            >
              <option value="">Không sắp xếp</option>
              <option value="createdAt">Ngày tạo</option>
              <option value="name">Họ tên</option>
              <option value="role">Chức vụ</option>
            </select>
            {sortBy && (
              <select
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                className="border border-slate-200 rounded px-2 py-1 text-xs"
              >
                <option value="asc">Tăng dần</option>
                <option value="desc">Giảm dần</option>
              </select>
            )}
          </div>
          <div className="text-xs text-slate-400 ml-auto">
            Trang {page}/{totalPages}
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Mã NV</th>
                <th className="px-3 py-2 text-left font-medium">Họ và tên</th>
                <th className="px-3 py-2 text-left font-medium">Email</th>
                <th className="px-3 py-2 text-left font-medium">Chức vụ</th>
                <th className="px-3 py-2 text-left font-medium">Loại đăng nhập</th>
                <th className="px-3 py-2 text-left font-medium">Trạng thái</th>
                <th className="px-3 py-2 text-left font-medium">Ngày tạo</th>
                <th className="px-3 py-2 text-left font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-slate-400">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-4 text-center text-slate-400">
                    Chưa có tài khoản.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">{r.code || "-"}</td>
                    <td className="px-3 py-2">{r.name || "-"}</td>
                    <td className="px-3 py-2">{r.email || "-"}</td>
                    <td className="px-3 py-2">{ROLE_LABELS[(r.roleKey || "").toUpperCase()] || r.roleName || r.roleKey || "-"}</td>
                    <td className="px-3 py-2">
                      {LOGIN_LABELS[(r.loginType || "").toUpperCase()] || r.loginType || "-"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-2 py-1 rounded-full text-[11px] ${
                          r.isActive
                            ? "bg-green-50 text-green-700 border border-green-100"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {r.isActive ? "Hoạt động" : "Đã khóa"}
                      </span>
                    </td>
                    <td className="px-3 py-2">{formatDate(r.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          className="px-2 py-1 rounded border border-blue-200 text-[11px] text-blue-700 hover:bg-blue-50"
                          onClick={() => setEditing(r)}
                        >
                          Sửa
                        </button>
                        <button
                          className={`px-2 py-1 rounded border text-[11px] ${
                            r.isActive
                              ? "border-red-200 text-red-700 hover:bg-red-50"
                              : "border-green-200 text-green-700 hover:bg-green-50"
                          }`}
                          onClick={() => toggleActive(r)}
                        >
                          {r.isActive ? "Khóa" : "Mở"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-2 rounded border border-slate-200 disabled:opacity-50"
          >
            Trang trước
          </button>
          <span className="text-slate-600">
            Trang {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-2 rounded border border-slate-200 disabled:opacity-50"
          >
            Trang tiếp
          </button>
        </div>
      </div>

      {editing && (
        <EditAccountModal
          account={editing}
          roleOptions={roleOptions}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function EditAccountModal({
  account,
  roleOptions,
  onClose,
  onSave,
}: {
  account: AccountRow;
  roleOptions: { value: string; label: string }[];
  onClose: () => void;
  onSave: (draft: Partial<AccountRow> & { id: string }) => void;
}) {
  const [draft, setDraft] = useState<AccountRow>(account);

  useEffect(() => {
    setDraft(account);
  }, [account]);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-[520px] max-w-[95vw]">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Chỉnh sửa tài khoản</div>
            <div className="text-sm font-semibold text-slate-900">{draft.name}</div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <div className="px-4 py-4 grid grid-cols-2 gap-3 text-xs text-slate-700">
          <Field label="Mã NV" value={draft.code} disabled />
          <Field
            label="Họ và tên"
            value={draft.name}
            onChange={(v) => setDraft((prev) => ({ ...prev, name: v }))}
          />
          <Field
            label="Email"
            value={draft.email}
            onChange={(v) => setDraft((prev) => ({ ...prev, email: v }))}
          />
          <Field
            label="Số điện thoại"
            value={draft.phone || ""}
            onChange={(v) => setDraft((prev) => ({ ...prev, phone: v }))}
          />
          <Field
            label="Chức vụ"
            as="select"
            value={draft.roleKey || ""}
            options={roleOptions}
            onChange={(v) =>
              setDraft((prev) => ({ ...prev, roleKey: v.toUpperCase(), roleName: ROLE_LABELS[v] || v }))
            }
          />
          <Field
            label="Trạng thái"
            as="select"
            value={draft.isActive ? "active" : "inactive"}
            options={[
              { value: "active", label: "Hoạt động" },
              { value: "inactive", label: "Đã khóa" },
            ]}
            onChange={(v) => setDraft((prev) => ({ ...prev, isActive: v === "active" }))}
          />
        </div>

        <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition"
          >
            Hủy
          </button>
          <button
            onClick={() => onSave(draft)}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 transition"
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  as?: "input" | "select";
  options?: { value: string; label: string }[];
};

function Field({ label, value, onChange, disabled, as = "input", options = [] }: FieldProps) {
  return (
    <label className="flex flex-col gap-1 text-[11px] text-slate-600">
      <span className="font-medium text-slate-700">{label}</span>
      {as === "select" ? (
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-slate-50"
        >
          <option value="">Chọn</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={value}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-slate-50"
        />
      )}
    </label>
  );
}
