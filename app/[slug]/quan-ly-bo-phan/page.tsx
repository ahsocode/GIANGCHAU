"use client";

import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { AppShell } from "@/component/layout/AppShell";

type Department = { id: string; code: string; name: string };

export default function DepartmentsPage() {
  return (
    <AppShell
      activeSection="departments"
      render={() => (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
          <Toaster richColors position="top-right" />
          <Header />
          <DepartmentManager />
        </div>
      )}
    />
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Quản lý bộ phận</h2>
        <p className="text-sm text-slate-600">
          Tạo bộ phận với ID, mã viết tắt và tên để dùng giới hạn ca làm.
        </p>
      </div>
    </div>
  );
}

function DepartmentManager() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [draft, setDraft] = useState<Pick<Department, "code" | "name">>({
    code: "",
    name: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Department | null>(null);

  const normalizeKey = (value: string) => {
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
    return cleaned.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toUpperCase();
  };

  const genId = (name: string) => {
    const slug = normalizeKey(name);
    const rand = Math.floor(Math.random() * 900 + 100); // 3 chữ số
    return `DPT-${slug || "NEW"}-${rand}`;
  };

  const addDepartment = () => {
    if (!draft.code || !draft.name) return;
    const dupCode = departments.some((d) => d.code.toLowerCase() === draft.code.toLowerCase());
    const dupName = departments.some((d) => d.name.toLowerCase() === draft.name.toLowerCase());
    if (dupCode || dupName) {
      const msg = dupCode
        ? "Mã viết tắt đã tồn tại, vui lòng chọn mã khác."
        : "Tên bộ phận đã tồn tại.";
      setError(msg);
      toast.error(msg);
      return;
    }
    const id = genId(draft.name);
    setLoading(true);
    setError(null);
    fetch("/api/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft.name, code: draft.code, notes: `auto:${id}` }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Không thể tạo bộ phận");
        }
        return res.json();
      })
      .then((created) => {
        setDepartments((prev) => [...prev, created]);
        setDraft({ code: "", name: "" });
        toast.success("Đã tạo bộ phận");
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        setError(msg);
        toast.error(msg || "Không thể tạo bộ phận");
      })
      .finally(() => setLoading(false));
  };

  const updateDepartment = () => {
    if (!editingId || !draft.code || !draft.name) return;
    const dupCode = departments.some(
      (d) => d.id !== editingId && d.code.toLowerCase() === draft.code.toLowerCase()
    );
    const dupName = departments.some(
      (d) => d.id !== editingId && d.name.toLowerCase() === draft.name.toLowerCase()
    );
    if (dupCode || dupName) {
      const msg = dupCode
        ? "Mã viết tắt đã tồn tại, vui lòng chọn mã khác."
        : "Tên bộ phận đã tồn tại.";
      setError(msg);
      toast.error(msg);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/departments/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft.name, code: draft.code }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Không thể cập nhật");
        }
        return res.json();
      })
      .then((updated) => {
        setDepartments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        setDraft({ code: "", name: "" });
        setEditingId(null);
        toast.success("Đã cập nhật bộ phận");
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        setError(msg);
        toast.error(msg || "Không thể cập nhật");
      })
      .finally(() => setLoading(false));
  };

  const deleteDepartment = (id: string) => {
    setLoading(true);
    setError(null);
    fetch(`/api/departments/${id}`, { method: "DELETE" })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Không thể xóa");
        }
        return res.json();
      })
      .then(() => {
        setDepartments((prev) => prev.filter((d) => d.id !== id));
        if (editingId === id) {
          setEditingId(null);
          setDraft({ code: "", name: "" });
        }
        toast.success("Đã xóa bộ phận");
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        setError(msg);
        toast.error(msg || "Không thể xóa");
      })
      .finally(() => {
        setLoading(false);
        setPendingDelete(null);
      });
  };

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/departments")
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || "Không tải được danh sách");
        }
        return res.json() as Promise<Department[]>;
      })
      .then((data) => setDepartments(data))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Lỗi không xác định";
        setError(message);
        toast.error(message);
      })
      .finally(() => setLoading(false));
  };

  // load once
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 border border-slate-100 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Tạo bộ phận</h3>
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2 mb-2">
            {error}
          </div>
        )}
        <div className="space-y-3">
          <Input
            label="Mã viết tắt"
            value={draft.code}
            onChange={(v) => setDraft((d) => ({ ...d, code: v }))}
            placeholder="SX"
          />
          <Input
            label="Tên bộ phận"
            value={draft.name}
            onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
            placeholder="Sản xuất"
          />
          <div className="flex gap-2">
            <button
              onClick={editingId ? updateDepartment : addDepartment}
              disabled={loading}
              className="w-full rounded-md bg-emerald-600 text-white text-sm font-medium py-2 hover:bg-emerald-500 transition disabled:opacity-60"
            >
              {loading ? "Đang lưu..." : editingId ? "Cập nhật" : "Thêm bộ phận"}
            </button>
            {editingId && (
              <button
                onClick={() => {
                  setEditingId(null);
                  setDraft({ code: "", name: "" });
                }}
                className="px-3 py-2 rounded-md border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
                disabled={loading}
              >
                Hủy
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 border border-slate-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">Danh sách bộ phận</h3>
            <span className="text-xs text-slate-500">{departments.length} bộ phận</span>
          </div>
          {loading && (
          <div className="text-xs text-slate-500 mb-2">Đang tải danh sách...</div>
        )}
        <div className="space-y-2">
          {departments.map((d) => (
            <div
              key={d.id + d.code}
              className="flex items-center justify-between border border-slate-200 rounded-md px-3 py-2 text-xs"
            >
              <div>
                <div className="font-semibold text-slate-800">{d.name}</div>
                <div className="text-[11px] text-slate-500">
                  ID: {d.id} · Mã: {d.code}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 text-[11px] border border-blue-200 rounded-md text-blue-700 hover:bg-blue-50"
                  onClick={() => {
                    setEditingId(d.id);
                    setDraft({ code: d.code, name: d.name });
                  }}
                  disabled={loading}
                >
                  Sửa
                </button>
                <button
                  className="px-3 py-1 text-[11px] border border-red-200 rounded-md text-red-700 hover:bg-red-50"
                  onClick={() => setPendingDelete(d)}
                  disabled={loading}
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
          {departments.length === 0 && (
            <div className="text-xs text-slate-500">Chưa có bộ phận.</div>
          )}
        </div>
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 w-[360px] max-w-[90vw] p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-900">Xóa bộ phận?</div>
            <p className="text-xs text-slate-600">
              Bạn chắc chắn muốn xóa bộ phận <strong>{pendingDelete.name}</strong> (mã{" "}
              {pendingDelete.code})? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPendingDelete(null)}
                className="px-3 py-2 rounded-md border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
                disabled={loading}
              >
                Hủy
              </button>
              <button
                onClick={() => deleteDepartment(pendingDelete.id)}
                className="px-3 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-500 disabled:opacity-60"
                disabled={loading}
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Input(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  const { label, value, onChange, placeholder, type = "text" } = props;
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      />
    </label>
  );
}
