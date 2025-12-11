"use client";

import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import { AppShell } from "@/component/layout/AppShell";
import type { Employee } from "@/lib/hr-types";
import { isSupabaseEnabled, getSupabaseClient } from "@/lib/supabase/client";

const ROLE_LABELS: Record<string, string> = {
  DIRECTOR: "Giám đốc",
  ADMIN: "Quản trị",
  MANAGER: "Quản lý",
  ACCOUNTANT: "Kế toán",
  SUPERVISOR: "Giám sát",
  EMPLOYEE: "Nhân viên",
};

type SelectOption = string | { value: string; label?: string };

export default function EmployeeInfoPage() {
  return (
    <AppShell
      activeSection="employeeInfo"
      render={({ filteredEmployees, workConfigs }) => (
        <EmployeeInfoContent fallbackEmployees={filteredEmployees} workConfigs={workConfigs} />
      )}
    />
  );
}

type SortField = "" | "code" | "name" | "role";
type SortDir = "asc" | "desc";
type ApiResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: Employee[];
};

function EmployeeInfoContent({
  fallbackEmployees,
  workConfigs,
}: {
  fallbackEmployees: Employee[];
  workConfigs: { shift: number; name?: string | null }[];
}) {
  const [rows, setRows] = useState<Employee[]>([]);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortField>("");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [roleKey, setRoleKey] = useState<string>("");
  const [employmentType, setEmploymentType] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [shiftCode, setShiftCode] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deptMaster, setDeptMaster] = useState<SelectOption[]>([]);
  const [shiftMaster, setShiftMaster] = useState<SelectOption[]>([]);
  const [shiftMap, setShiftMap] = useState<Map<string, string>>(new Map());

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const roleOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      const key = (r.roleKey || "").toUpperCase();
      if (!key || key === "ADMIN") return;
      if (!map.has(key)) map.set(key, r.roleName || ROLE_LABELS[key] || key);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [rows]);
  const deptOptions = useMemo(() => {
    const map = new Map<string, string>();
    [...deptMaster, ...rows.map((r) => r.department || "")]
      .filter(Boolean)
      .forEach((opt) => {
        const val = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label || opt.value;
        if (!map.has(val)) map.set(val, label);
      });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [rows, deptMaster]);

  const shiftOptions = useMemo(() => {
    const map = new Map<string, string>();
    // Ưu tiên tên ca từ cấu hình hiện có
    workConfigs.forEach((c) => map.set(String(c.shift), c.name || `Ca ${c.shift}`));
    // Lấy tên ca từ dữ liệu master (API/Supabase)
    shiftMaster
      .filter(Boolean)
      .forEach((opt) => {
        const val = String(typeof opt === "string" ? opt : opt.value);
        const label = typeof opt === "string" ? opt : opt.label || opt.value;
        if (val && !map.has(val)) map.set(val, label);
      });

    [...shiftMaster, ...rows.map((r) => r.shiftCode || "")]
      .filter(Boolean)
      .forEach((opt) => {
        const val = String(typeof opt === "string" ? opt : opt.value);
        const label =
          map.get(val) ||
          (typeof opt === "string" ? opt : opt.label) ||
          `Ca ${val}`;
        if (!map.has(val)) map.set(val, label);
      });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [rows, shiftMaster, workConfigs]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          sortBy,
          sortDir,
        });
        if (roleKey) params.set("roleKey", roleKey);
        if (employmentType) params.set("employmentType", employmentType);
        if (department) params.set("department", department);
        if (shiftCode) params.set("shiftCode", shiftCode);
        const res = await fetch(`/api/employees?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Không tải được danh sách nhân viên");
        }
        const data: ApiResponse = await res.json();
        if ((data.items || []).length === 0 && fallbackEmployees.length) {
          setRows(fallbackEmployees);
          setTotal(fallbackEmployees.length);
        } else {
          setRows(data.items || []);
          setTotal(data.total || 0);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        if (fallbackEmployees.length) {
          setRows(fallbackEmployees);
          setTotal(fallbackEmployees.length);
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [page, pageSize, sortBy, sortDir, roleKey, employmentType, department, shiftCode, fallbackEmployees]);

  useEffect(() => {
    if (!rows.length && fallbackEmployees.length) {
      setRows(fallbackEmployees);
      setTotal(fallbackEmployees.length);
    }
  }, [fallbackEmployees, rows.length]);

  // Load master data for department & shifts (for dropdowns)
  useEffect(() => {
    const controller = new AbortController();
    async function loadMaster() {
      let deptList: SelectOption[] = [];
      let shiftList: SelectOption[] = [];
      try {
        const [deptRes, shiftRes] = await Promise.all([
          fetch("/api/departments", { signal: controller.signal }),
          fetch("/api/shifts", { signal: controller.signal }),
        ]);
        if (deptRes.ok) {
          const depts = await deptRes.json();
          deptList =
            Array.isArray(depts) && depts.length
              ? depts.map((d: { name?: string | null; code?: string | null }) => ({
                  value: d.name || d.code || "",
                  label: d.name && d.code ? `${d.name} (${d.code})` : d.name || d.code || "",
                }))
              : [];
        }
        if (shiftRes.ok) {
          const shifts = await shiftRes.json();
          shiftList =
            Array.isArray(shifts) && shifts.length
              ? (shifts
                  .map(
                    (s: {
                      shiftCode?: string | null;
                      shift?: number | string | null;
                      id?: string | number | null;
                      name?: string | null;
                    }) => {
                      const val = s.shiftCode || s.shift || s.id;
                      const num = s.shift;
                      const label =
                        s.name ||
                        (num != null ? `Ca ${num}` : undefined) ||
                        (val ? String(val) : "");
                      return val ? { value: String(val), label: label || "" } : null;
                    }
                  )
                  .filter((s): s is { value: string; label: string } => Boolean(s))) 
              : [];
        }
      } catch {
        // ignore master data errors
      }

      if (isSupabaseEnabled()) {
        try {
          const supabase = getSupabaseClient();
          if (!deptList.length) {
            const { data, error } = await supabase.from("departments").select("name, code");
            if (!error && Array.isArray(data)) {
              deptList = data
                .filter((d) => d.name || d.code)
                .map((d: { name?: string | null; code?: string | null }) => ({
                  value: d.name || d.code || "",
                  label: d.name && d.code ? `${d.name} (${d.code})` : d.name || d.code || "",
                }));
            }
          }
          if (!shiftList.length) {
            const { data, error } = await supabase.from("work_configs").select("shift, name, id");
            if (!error && Array.isArray(data)) {
              shiftList = data
                .filter((s) => s.shift != null || s.name || s.id)
                .map(
                  (s: { shift?: number | string | null; name?: string | null; id?: string | number | null }) => {
                  const val = s.shift ?? s.id;
                  const label = s.name || (s.shift != null ? `Ca ${s.shift}` : String(val));
                  return { value: String(val), label: label || "" };
                }
              );
            }
          }
        } catch {
          // ignore supabase fallback errors
        }
      }

      if (deptList.length) setDeptMaster(deptList);
      if (shiftList.length) setShiftMaster(shiftList);
    }
    loadMaster();
    return () => controller.abort();
  }, []);

  const sortedRows = useMemo(() => rows, [rows]);

  const shiftNameMap = useMemo(() => {
    const map = new Map<string, string>();
    workConfigs.forEach((c) => map.set(String(c.shift), c.name || `Ca ${c.shift}`));
    shiftOptions.forEach((opt) => {
      const val = typeof opt === "string" ? opt : opt.value;
      const label = typeof opt === "string" ? opt : opt.label || opt.value;
      if (val && !map.has(String(val))) map.set(String(val), label);
    });
    [...rows, ...fallbackEmployees].forEach((e) => {
      if (e.shiftCode) {
        const key = String(e.shiftCode);
        if (!map.has(key)) map.set(key, `Ca ${key}`);
      }
    });
    return map;
  }, [workConfigs, shiftOptions, rows, fallbackEmployees]);

  useEffect(() => {
    if (shiftNameMap.size) {
      setShiftMap(shiftNameMap);
    }
  }, [shiftNameMap]);

  useEffect(() => {
    async function loadShifts() {
      if (shiftMap.size || !isSupabaseEnabled()) return;
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.from("work_configs").select("shift,name");
        if (!error && Array.isArray(data)) {
          const map = new Map<string, string>();
          data.forEach((c: { shift: number | string | null; name?: string | null }) => {
            const key = c.shift != null ? String(c.shift) : "";
            if (key) map.set(key, c.name || `Ca ${key}`);
          });
          if (map.size) setShiftMap(map);
        }
      } catch {
        // ignore
      }
    }
    loadShifts();
  }, [shiftMap]);

  const handleSave = async (draft: Partial<Employee> & { code: string }) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/employees/${encodeURIComponent(draft.code)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Không thể cập nhật nhân viên");
      }
      const updated: Employee = await res.json();
      setRows((prev) => prev.map((e) => (e.code === updated.code ? updated : e)));
      toast.success("Đã cập nhật thông tin nhân viên");
      setMessage("Đã cập nhật thông tin nhân viên.");
      setEditing(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (code: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${encodeURIComponent(code)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Không thể xóa nhân viên");
      }
      setRows((prev) => prev.filter((e) => e.code !== code));
      setTotal((t) => Math.max(0, t - 1));
      toast.success("Đã xóa nhân viên");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Lỗi không xác định";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
      setDeleting(null);
    }
  };

  const toggleSort = (field: SortField) => {
    setSortBy(field);
    setSortDir("asc");
    setPage(1);
  };

  const handleFilter = (key: string, value: string) => {
    if (key === "roleKey") setRoleKey(value);
    if (key === "employmentType") setEmploymentType(value);
    if (key === "department") setDepartment(value);
    if (key === "shiftCode") setShiftCode(value);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <Toaster richColors position="top-right" />
      <header className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
              Quản lý thông tin nhân viên
            </p>
            <h2 className="text-lg font-semibold text-slate-900">Hồ sơ nhân viên</h2>
            <p className="text-sm text-slate-600">
              Tra cứu nhanh mã nhân viên, chức vụ, loại hình, bộ phận và trạng thái làm việc.
            </p>
          </div>
          <div className="text-xs text-slate-500">
            Tổng số nhân viên:{" "}
            <span className="font-semibold text-slate-800">
              {total || rows.length}
            </span>
          </div>
        </div>
      </header>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-sm font-semibold text-slate-800">Danh sách hồ sơ</h3>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span>Sắp xếp:</span>
              <select
                value={sortBy}
                onChange={(e) => toggleSort(e.target.value as SortField)}
                className="border border-slate-200 rounded px-2 py-1 text-xs"
              >
                <option value="">Không sắp xếp</option>
                <option value="code">Mã NV</option>
                <option value="name">Họ tên</option>
                <option value="role">Chức vụ</option>
              </select>
              {sortBy && (
                <select
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value as SortDir)}
                  className="border border-slate-200 rounded px-2 py-1 text-xs"
                >
                  <option value="asc">Tăng dần</option>
                  <option value="desc">Giảm dần</option>
                </select>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label className="text-slate-600">Chức vụ:</label>
              <select
                value={roleKey}
                onChange={(e) => handleFilter("roleKey", e.target.value)}
                className="border border-slate-200 rounded px-2 py-1 text-xs"
              >
                <option value="">Tất cả</option>
                {roleOptions.map((r) => {
                  const val = typeof r === "string" ? r : r.value;
                  const label = typeof r === "string" ? r : r.label || r.value;
                  return (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <label className="text-slate-600">Loại:</label>
              <select
                value={employmentType}
                onChange={(e) => handleFilter("employmentType", e.target.value)}
                className="border border-slate-200 rounded px-2 py-1 text-xs"
              >
                <option value="">Tất cả</option>
                <option value="FULL_TIME">Chính thức</option>
                <option value="TEMPORARY">Thời vụ</option>
              </select>
              <label className="text-slate-600">Bộ phận:</label>
              <select
                value={department}
                onChange={(e) => handleFilter("department", e.target.value)}
                className="border border-slate-200 rounded px-2 py-1 text-xs"
              >
                <option value="">Tất cả</option>
                {deptOptions.map((d) => {
                  const val = typeof d === "string" ? d : d.value;
                  const label = typeof d === "string" ? d : d.label || d.value;
                  return (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <label className="text-slate-600">Ca làm:</label>
              <select
                value={shiftCode}
                onChange={(e) => handleFilter("shiftCode", e.target.value)}
                className="border border-slate-200 rounded px-2 py-1 text-xs"
              >
                <option value="">Tất cả</option>
                {shiftOptions.map((s) => {
                  const val = typeof s === "string" ? s : s.value;
                  const label = typeof s === "string" ? s : s.label || s.value;
                  return (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          <span className="text-xs text-slate-400">
            Trang {page}/{totalPages} • {total} nhân viên
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Mã NV</th>
                <th className="px-3 py-2 text-left font-medium">Họ và tên</th>
                <th className="px-3 py-2 text-left font-medium">Chức vụ</th>
                <th className="px-3 py-2 text-left font-medium">Loại</th>
                <th className="px-3 py-2 text-left font-medium">Bộ phận</th>
                <th className="px-3 py-2 text-left font-medium">Ngày vào làm</th>
                <th className="px-3 py-2 text-left font-medium">Trạng thái</th>
                <th className="px-3 py-2 text-left font-medium">Số điện thoại</th>
                <th className="px-3 py-2 text-left font-medium">Email</th>
                <th className="px-3 py-2 text-left font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} className="px-3 py-4 text-center text-slate-400">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              )}
              {!loading && sortedRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-slate-400">
                    Chưa có dữ liệu nhân viên.
                  </td>
                </tr>
              )}
              {!loading && sortedRows.map((e) => (
                <tr key={e.code} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">{e.code}</td>
                  <td className="px-3 py-2">{e.name}</td>
                  <td className="px-3 py-2">{e.roleName || e.roleKey || "-"}</td>
                  <td className="px-3 py-2">
                    {e.employmentType === "FULL_TIME" ? "Chính thức" : "Thời vụ"}
                  </td>
                  <td className="px-3 py-2">{e.department || "-"}</td>
                  <td className="px-3 py-2">
                    {e.shiftCode
                      ? shiftMap.get(String(e.shiftCode)) ||
                        workConfigs.find((c) => c.name?.toLowerCase() === String(e.shiftCode).toLowerCase())?.name ||
                        `Ca ${e.shiftCode}`
                      : "-"}
                  </td>
                  <td className="px-3 py-2">{e.startDate || "-"}</td>
                  <td className="px-3 py-2">
                    {e.workStatus === "ACTIVE" ? "Đang làm" : "Đã nghỉ"}
                  </td>
                  <td className="px-3 py-2">{e.phone || "-"}</td>
                  <td className="px-3 py-2">{e.email || "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        className="px-2 py-1 rounded border border-blue-200 text-[11px] text-blue-700 hover:bg-blue-50"
                        onClick={() => setEditing(e)}
                        disabled={saving}
                      >
                        Sửa
                      </button>
                      <button
                        className="px-2 py-1 rounded border border-red-200 text-[11px] text-red-700 hover:bg-red-50"
                        onClick={() => setDeleting(e)}
                        disabled={saving}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="px-4 py-3 border border-t-0 border-slate-200 rounded-b-xl flex items-center justify-between text-xs bg-white">
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

      {message && (
        <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          {message}
        </div>
      )}
      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {editing && (
        <EditEmployeeModal
          employee={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          saving={saving}
          roleOptions={roleOptions}
          deptOptions={deptOptions}
          shiftOptions={shiftOptions}
          shiftMap={shiftMap}
        />
      )}

      {deleting && (
        <ConfirmDeleteModal
          employee={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={() => handleDelete(deleting.code)}
          loading={saving}
        />
      )}
    </div>
  );
}

function EditEmployeeModal({
  employee,
  onClose,
  onSave,
  saving,
  roleOptions,
  deptOptions,
  shiftOptions,
  shiftMap,
}: {
  employee: Employee;
  onClose: () => void;
  onSave: (draft: Partial<Employee> & { code: string }) => void;
  saving: boolean;
  roleOptions: SelectOption[];
  deptOptions: SelectOption[];
  shiftOptions: SelectOption[];
  shiftMap: Map<string, string>;
}) {
  const [draft, setDraft] = useState<Employee>(employee);
  useEffect(() => {
    setDraft(employee);
  }, [employee]);

  const roleSelectOptions = useMemo(() => {
    const list: SelectOption[] = [...roleOptions];
    const key = (draft.roleKey || "").toUpperCase();
    const label = draft.roleName || ROLE_LABELS[key] || key;
    const exists = list.some((opt) => (typeof opt === "string" ? opt : opt.value) === key);
    if (key && !exists) list.push({ value: key, label });
    return list;
  }, [roleOptions, draft.roleKey, draft.roleName]);

  const deptSelectOptions = useMemo(() => {
    const map = new Map<string, string>();
    deptOptions.forEach((opt) => {
      const val = typeof opt === "string" ? opt : opt.value;
      const label = typeof opt === "string" ? opt : opt.label || opt.value;
      if (val) map.set(val, label);
    });
    if (draft.department) {
      const currentLabel =
        typeof draft.department === "string" ? draft.department : String(draft.department);
      map.set(draft.department, currentLabel);
    }
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [deptOptions, draft.department]);

  const shiftSelectOptions = useMemo(() => {
    const map = new Map<string, string>();
    shiftOptions.forEach((opt) => {
      const val = typeof opt === "string" ? opt : opt.value;
      const label = typeof opt === "string" ? opt : opt.label || opt.value;
      if (val) map.set(String(val), label);
    });
    if (draft.shiftCode) {
      const val = String(draft.shiftCode);
      const label = shiftMap.get(val) || map.get(val) || `Ca ${val}`;
      map.set(val, label);
    }
    return Array.from(map.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [shiftOptions, draft.shiftCode, shiftMap]);

  const isoStartDate = useMemo(() => {
    const raw = draft.startDate || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return "";
  }, [draft.startDate]);

  const handleChange = (key: keyof Employee, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    const code = draft.code || employee.code;
    if (!code) return;
    onSave({
      code,
      name: draft.name,
      roleKey: draft.roleKey,
      roleName: draft.roleName,
      phone: draft.phone,
      email: draft.email,
      cccd: draft.cccd,
      bhxh: draft.bhxh,
      employmentType: draft.employmentType,
      workStatus: draft.workStatus,
      startDate: draft.startDate,
      department: draft.department,
      shiftCode: draft.shiftCode,
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-[540px] max-w-[95vw]">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Chỉnh sửa nhân viên</div>
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
          <Field label="Họ và tên" value={draft.name} onChange={(v) => handleChange("name", v)} />
          <Field
            label="Chức vụ"
            as="select"
            value={draft.roleKey || ""}
            options={roleSelectOptions}
            onChange={(v) => {
              const label =
                roleSelectOptions.find((opt) =>
                  typeof opt === "string" ? opt === v : opt.value === v
                );
              const display = typeof label === "string" ? label : label?.label || v;
              handleChange("roleKey", v.toUpperCase());
              handleChange("roleName", display);
            }}
          />
          <Field
            label="Loại"
            as="select"
            value={draft.employmentType}
            options={[
              { value: "FULL_TIME", label: "Chính thức" },
              { value: "TEMPORARY", label: "Thời vụ" },
            ]}
            onChange={(v) => handleChange("employmentType", v as Employee["employmentType"])}
          />
          <Field
            label="Trạng thái"
            as="select"
            value={draft.workStatus}
            options={[
              { value: "ACTIVE", label: "Đang làm" },
              { value: "INACTIVE", label: "Đã nghỉ" },
            ]}
            onChange={(v) => handleChange("workStatus", v as Employee["workStatus"])}
          />
          <Field
            label="Bộ phận"
            as="select"
            value={draft.department || ""}
            options={deptSelectOptions}
            onChange={(v) => handleChange("department", v)}
          />
          <Field
            label="Ca làm"
            as="select"
            value={draft.shiftCode || ""}
            options={shiftSelectOptions}
            onChange={(v) => handleChange("shiftCode", v)}
          />
          <Field
            label="Ngày vào làm"
            type="date"
            value={isoStartDate}
            onChange={(v) => handleChange("startDate", v)}
          />
          <Field label="Số điện thoại" value={draft.phone || ""} onChange={(v) => handleChange("phone", v)} />
          <Field label="Email" value={draft.email || ""} onChange={(v) => handleChange("email", v)} />
          <Field label="CCCD" value={draft.cccd || ""} onChange={(v) => handleChange("cccd", v)} />
          <Field label="BHXH" value={draft.bhxh || ""} onChange={(v) => handleChange("bhxh", v)} />
        </div>

        <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition"
            disabled={saving}
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 transition disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  employee,
  onClose,
  onConfirm,
  loading,
}: {
  employee: Employee;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-[420px] max-w-[95vw] p-4 space-y-3">
        <div className="text-sm font-semibold text-slate-900">Xóa nhân viên?</div>
        <p className="text-xs text-slate-600">
          Bạn chắc chắn muốn xóa nhân viên <strong>{employee.name}</strong> ({employee.code})?
          Thao tác này không thể hoàn tác.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-xs font-medium rounded border border-slate-200 text-slate-700 hover:bg-slate-100"
            disabled={loading}
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-3 py-2 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-500 disabled:opacity-60"
          >
            {loading ? "Đang xóa..." : "Xóa"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  as = "input",
  options = [],
  type = "text",
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  as?: "input" | "select";
  options?: SelectOption[];
  type?: string;
}) {
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
          {options.map((opt) => {
            const val = typeof opt === "string" ? opt : opt.value;
            const labelText = typeof opt === "string" ? opt : opt.label || opt.value;
            return (
              <option key={val} value={val}>
                {labelText}
              </option>
            );
          })}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value)}
          className="border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-slate-50"
        />
      )}
    </label>
  );
}
