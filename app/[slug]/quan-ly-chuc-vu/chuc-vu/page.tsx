"use client";

import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { AppShell } from "@/component/layout/AppShell";

type RoleItem = {
  id: number;
  key: string;
  name: string;
  shortName: string | null;
};

export default function RolesPage() {
  return (
    <AppShell
      activeSection="roles"
      render={() => (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
          <Toaster richColors position="top-right" />
          <Header />
          <RoleManager />
        </div>
      )}
    />
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Quản lý chức vụ</h2>
        <p className="text-sm text-slate-600">
          Tạo, sửa, xóa chức vụ và viết tắt để gán cho nhân viên.
        </p>
      </div>
    </div>
  );
}

function RoleManager() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [draft, setDraft] = useState<{ name: string; shortName: string; key: string }>({
    name: "",
    shortName: "",
    key: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RoleItem | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/roles")
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Không tải được danh sách");
        }
        return res.json();
      })
      .then((data: RoleItem[]) => setRoles(data))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const handleSave = () => {
    if (!draft.name || !draft.shortName) {
      const msg = "Vui lòng nhập tên và viết tắt.";
      setError(msg);
      toast.error(msg);
      return;
    }

    const dupName = roles.some(
      (r) => r.id !== editingId && r.name.toLowerCase() === draft.name.toLowerCase()
    );
    const dupShort = roles.some(
      (r) =>
        r.id !== editingId &&
        (r.shortName || "").toLowerCase() === draft.shortName.toLowerCase()
    );
    const dupKey =
      draft.key &&
      roles.some((r) => r.id !== editingId && r.key.toLowerCase() === draft.key.toLowerCase());

    if (dupName || dupShort || dupKey) {
      const msg = dupName
        ? "Tên chức vụ đã tồn tại."
        : dupShort
        ? "Viết tắt đã tồn tại."
        : "Key đã tồn tại.";
      setError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    setError(null);
    const payload = { name: draft.name, shortName: draft.shortName, key: draft.key };
    const isEdit = editingId != null;
    const url = isEdit ? `/api/roles/${editingId}` : "/api/roles";
    const method = isEdit ? "PATCH" : "POST";

    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Không thể lưu chức vụ");
        }
        return res.json();
      })
      .then((saved: RoleItem) => {
        setRoles((prev) => {
          if (!isEdit) return [...prev, saved];
          return prev.map((r) => (r.id === saved.id ? saved : r));
        });
        setDraft({ name: "", shortName: "", key: "" });
        setEditingId(null);
        toast.success(isEdit ? "Đã cập nhật chức vụ" : "Đã tạo chức vụ");
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  };

  const handleDelete = (id: number) => {
    setLoading(true);
    setError(null);
    fetch(`/api/roles/${id}`, { method: "DELETE" })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Không thể xóa");
        }
        return res.json();
      })
      .then(() => {
        setRoles((prev) => prev.filter((r) => r.id !== id));
        if (editingId === id) {
          setEditingId(null);
          setDraft({ name: "", shortName: "", key: "" });
        }
        toast.success("Đã xóa chức vụ");
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => {
        setLoading(false);
        setPendingDelete(null);
      });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 border border-slate-100 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">
          {editingId ? "Sửa chức vụ" : "Tạo chức vụ"}
        </h3>
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2 mb-2">
            {error}
          </div>
        )}
        <div className="space-y-3">
            <Input
              label="Tên chức vụ"
              value={draft.name}
              onChange={(v) => setDraft((d) => ({ ...d, name: v }))}
              placeholder="Quản lý"
            />
          <Input
            label="Key (tùy chọn, viết hoa, không dấu)"
            value={draft.key}
            onChange={(v) => setDraft((d) => ({ ...d, key: v }))}
            placeholder="MANAGER"
          />
          <Input
            label="Viết tắt"
            value={draft.shortName}
            onChange={(v) => setDraft((d) => ({ ...d, shortName: v }))}
            placeholder="QL"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full rounded-md bg-blue-600 text-white text-sm font-medium py-2 hover:bg-blue-500 transition disabled:opacity-60"
            >
              {loading ? "Đang lưu..." : editingId ? "Cập nhật" : "Thêm chức vụ"}
            </button>
            {editingId && (
              <button
            onClick={() => {
              setEditingId(null);
              setDraft({ name: "", shortName: "", key: "" });
            }}
                disabled={loading}
                className="px-3 py-2 rounded-md border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 border border-slate-100 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-800">Danh sách chức vụ</h3>
          <span className="text-xs text-slate-500">{roles.length} chức vụ</span>
        </div>
        {loading && <div className="text-xs text-slate-500 mb-2">Đang tải dữ liệu...</div>}
        <div className="space-y-2">
          {roles.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between border border-slate-200 rounded-md px-3 py-2 text-xs"
            >
              <div>
                <div className="font-semibold text-slate-800">{r.name}</div>
                <div className="text-[11px] text-slate-500">
                  Viết tắt: {r.shortName || "-"} · Key: {r.key}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 text-[11px] border border-blue-200 rounded-md text-blue-700 hover:bg-blue-50"
                  onClick={() => {
                    setEditingId(r.id);
                    setDraft({ name: r.name, shortName: r.shortName || "", key: r.key || "" });
                  }}
                  disabled={loading}
                >
                  Sửa
                </button>
                <button
                  className="px-3 py-1 text-[11px] border border-red-200 rounded-md text-red-700 hover:bg-red-50"
                  onClick={() => setPendingDelete(r)}
                  disabled={loading}
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
          {roles.length === 0 && <div className="text-xs text-slate-500">Chưa có chức vụ.</div>}
        </div>
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 w-[360px] max-w-[90vw] p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-900">Xóa chức vụ?</div>
            <p className="text-xs text-slate-600">
              Bạn chắc chắn muốn xóa chức vụ <strong>{pendingDelete.name}</strong> (viết tắt{" "}
              {pendingDelete.shortName || "-"})? Thao tác này không thể hoàn tác.
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
                onClick={() => handleDelete(pendingDelete.id)}
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
