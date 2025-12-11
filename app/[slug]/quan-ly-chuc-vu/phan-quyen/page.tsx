"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/component/layout/AppShell";
import type { DirectorSection } from "@/app/types";
import { DEFAULT_ROLE_SECTIONS, sanitizeRoleSections } from "@/lib/role-permissions";

type RoleConfig = Record<string, DirectorSection[]>;
type ApiSection = { key: DirectorSection; label: string; path: string; group?: string | null };
type ApiRole = { key: string; name: string | null; isDirector: boolean };
type ApiPayload = {
  sections: ApiSection[];
  roles: ApiRole[];
  roleAccess: RoleConfig;
};

const FALLBACK_SECTIONS: ApiSection[] = [
  { key: "overview", label: "Tổng quan", path: "tong-quan" },
  { key: "departments", label: "Quản lý bộ phận", path: "quan-ly-bo-phan" },
  { key: "employeesOverview", label: "Tổng quan nhân viên", path: "quan-ly-nhan-vien/tong-quan-nhan-vien" },
  { key: "employees", label: "Danh sách nhân viên", path: "quan-ly-nhan-vien/danh-sach-nhan-vien" },
  { key: "attendance", label: "Quản lý chấm công", path: "quan-ly-cham-cong" },
  { key: "shiftOverview", label: "Tổng quan ca làm", path: "quan-ly-ca-lam/tong-quan-ca-lam" },
  { key: "shifts", label: "Ca làm", path: "quan-ly-ca-lam/ca-lam" },
  { key: "shiftAssignment", label: "Phân ca", path: "quan-ly-ca-lam/phan-ca" },
  { key: "permissions", label: "Phân quyền", path: "quan-ly-chuc-vu/phan-quyen" },
  { key: "roles", label: "Chức vụ", path: "quan-ly-chuc-vu/chuc-vu" },
];

const LOCKED = new Set(["ADMIN", "DIRECTOR"]);

export default function PermissionsPage() {
  const [config, setConfig] = useState<RoleConfig>({});
  const [sections, setSections] = useState<ApiSection[]>([]);
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [activeRole, setActiveRole] = useState<string>("MANAGER");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    fetch("/api/permissions/sections", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Không tải được phân quyền");
        }
        return res.json();
      })
      .then((data: ApiPayload) => {
        const sectionList = (data.sections || []).length ? data.sections : FALLBACK_SECTIONS;
        setSections(sectionList);
        setRoles(data.roles || []);
        setConfig(data.roleAccess || {});
        const firstEditable =
          data.roles?.find((r) => !LOCKED.has((r.key || "").toUpperCase()))?.key ||
          "MANAGER";
        setActiveRole(firstEditable);
        if (!data.sections?.length) {
          setMessage("Chưa có dữ liệu phân quyền trong DB. Đang hiển thị danh sách mặc định.");
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        setError(msg);
      });
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const visibleConfig = useMemo(() => {
    const allKeys = sections.map((s) => s.key);
    const current = config[activeRole] || DEFAULT_ROLE_SECTIONS[activeRole] || [];
    const sanitized = sanitizeRoleSections(activeRole, current, allKeys);
    return new Set<DirectorSection>(sanitized);
  }, [activeRole, config, sections]);

  const isLocked = LOCKED.has((activeRole || "").toUpperCase());

  const toggleSection = (section: DirectorSection) => {
    if (isLocked) return;
    setConfig((prev) => {
      const next = { ...prev };
      const allKeys = sections.map((s) => s.key);
      const current = new Set<DirectorSection>(
        sanitizeRoleSections(
          activeRole,
          next[activeRole] || DEFAULT_ROLE_SECTIONS[activeRole] || [],
          allKeys
        )
      );
      if (current.has(section)) current.delete(section);
      else current.add(section);
      next[activeRole] = Array.from(current);
      return next;
    });
  };

  const handleSave = () => {
    setSaving(true);
    setMessage(null);
    setError(null);

    const allKeys = sections.map((s) => s.key);
    const sanitized = sanitizeRoleSections(activeRole, Array.from(visibleConfig), allKeys);

    fetch("/api/permissions/sections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: activeRole, sections: sanitized }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Không thể lưu phân quyền");
        }
        return res.json();
      })
      .then((resp: { role: string; sections: DirectorSection[] }) => {
        setConfig((prev) => ({
          ...prev,
          [resp.role.toUpperCase()]: resp.sections,
        }));
        setMessage("Đã lưu phân quyền từ API.");
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        setError(msg);
      })
      .finally(() => setSaving(false));
  };

  const resetRole = () => {
    if (isLocked) return;
    setConfig((prev) => {
      const next = { ...prev };
      next[activeRole] = DEFAULT_ROLE_SECTIONS[activeRole] || [];
      return next;
    });
  };

  const roleOptions = useMemo(() => {
    if (!roles.length) {
      return [
        { key: "ADMIN", label: "Admin (khóa)" },
        { key: "DIRECTOR", label: "Giám đốc (khóa)" },
        { key: "MANAGER", label: "Trưởng phòng" },
        { key: "ACCOUNTANT", label: "Kế toán" },
        { key: "SUPERVISOR", label: "Giám sát" },
        { key: "EMPLOYEE", label: "Nhân viên" },
        { key: "TEMPORARY", label: "Thời vụ" },
      ];
    }
    return roles.map((r) => ({
      key: r.key.toUpperCase(),
      label: r.name || r.key,
      locked: LOCKED.has((r.key || "").toUpperCase()) || r.isDirector,
    }));
  }, [roles]);

  return (
    <AppShell
      activeSection="permissions"
      render={() => (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
                  Phân quyền sidebar
                </p>
                <h2 className="text-lg font-semibold text-slate-900">Chọn tab hiển thị theo chức vụ</h2>
                <p className="text-sm text-slate-600">
                  Admin và Giám đốc luôn thấy toàn bộ menu và không bị chỉnh sửa. Các chức vụ khác
                  do Admin/Giám đốc quyết định.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={activeRole}
                  onChange={(e) => setActiveRole(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 bg-white"
                >
                  {roleOptions.map((role) => (
                    <option key={role.key} value={role.key}>
                      {role.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={resetRole}
                  disabled={isLocked}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Khôi phục mặc định
                </button>
                <button
                  onClick={handleSave}
                  disabled={isLocked || saving}
                  className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Lưu cấu hình"}
                </button>
              </div>
            </div>
            {message && (
              <div className="mt-3 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 inline-flex items-center gap-2">
                <span>{message}</span>
              </div>
            )}
            {error && (
              <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 inline-flex items-center gap-2">
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="border-b border-slate-200 px-6 py-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                Quyền menu cho{" "}
                {roleOptions.find((r) => r.key === activeRole)?.label || activeRole}
              </h3>
              {isLocked && <span className="text-xs text-slate-500">Luôn đầy đủ, không chỉnh sửa.</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 p-4">
              {sections.map((section) => (
                <label
                  key={section.key}
                  className={`flex items-center gap-2 border rounded-lg px-3 py-2 text-sm ${
                    visibleConfig.has(section.key)
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 text-slate-700"
                  } ${isLocked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={visibleConfig.has(section.key)}
                    onChange={() => toggleSection(section.key)}
                    disabled={isLocked}
                  />
                  <span>{section.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-5 text-sm text-slate-700">
            <p className="font-semibold text-slate-900 mb-2">Ghi chú</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Dữ liệu lấy từ API `/api/permissions/sections`. Admin/Giám đốc luôn có toàn quyền.</li>
              <li>Admin/Giám đốc luôn có toàn quyền và không thể bị khóa.</li>
              <li>Những tab bạn bật ở đây sẽ xuất hiện trong sidebar của role tương ứng.</li>
            </ul>
          </div>
        </div>
      )}
    />
  );
}
