"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Employee } from "@/lib/hr-types";
import { AppShell } from "@/component/layout/AppShell";
import { Toaster, toast } from "sonner";
import { getSupabaseClient, isSupabaseEnabled } from "@/lib/supabase/client";

type SortField = "" | "code" | "name" | "role";
type SortDir = "asc" | "desc";

type ApiResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: Employee[];
};

export default function EmployeesListPage() {
  return (
    <AppShell
      activeSection="employees"
      render={({ filteredEmployees, workConfigs }) => (
        <EmployeesSection fallbackEmployees={filteredEmployees} workConfigs={workConfigs} />
      )}
    />
  );
}

function EmployeesSection({
  fallbackEmployees,
  workConfigs,
}: {
  fallbackEmployees: Employee[];
  workConfigs: { shift: number; name?: string | null }[];
}) {
  const [data, setData] = useState<Employee[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<SortField>("");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [roleKey, setRoleKey] = useState<string>("");
  const [employmentType, setEmploymentType] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [shiftCode, setShiftCode] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shiftMap, setShiftMap] = useState<Map<string, string>>(new Map());
  const [showCreate, setShowCreate] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const router = useRouter();
  const params = useParams<{ slug?: string }>();
  const slug = (params?.slug as string) || "";

  // Khởi tạo dữ liệu từ fallback ngay lập tức
  useEffect(() => {
    if (fallbackEmployees.length > 0 && data.length === 0) {
      setData(fallbackEmployees);
      setTotal(fallbackEmployees.length);
    }
  }, [fallbackEmployees, data.length]);

  const optionSource = data.length ? data : fallbackEmployees;
  const roleOptions = useMemo(
    () =>
      Array.from(new Set(optionSource.map((r) => (r.roleKey || "").toUpperCase()).filter(Boolean))),
    [optionSource]
  );
  const deptOptions = useMemo(
    () => Array.from(new Set(optionSource.map((r) => r.department || "").filter(Boolean))),
    [optionSource]
  );
  const shiftOptions = useMemo(
    () => Array.from(new Set(optionSource.map((r) => r.shiftCode || "").filter(Boolean))),
    [optionSource]
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  // Load từ API - chỉ update nếu có dữ liệu mới
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
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

        const res = await fetch(`/api/employees/list?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Không tải được danh sách nhân viên");
        }
        const data: ApiResponse = await res.json();
        
        if (data.items && data.items.length > 0) {
          setData(data.items);
          setTotal(data.total || 0);
        } else if (fallbackEmployees.length > 0) {
          // Nếu API trả về rỗng và chưa init, dùng fallback
          setData(fallbackEmployees);
          setTotal(fallbackEmployees.length);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        
        // Khi có lỗi, giữ dữ liệu hiện tại hoặc dùng fallback
        if (data.length === 0 && fallbackEmployees.length > 0) {
          setData(fallbackEmployees);
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
  }, [page, pageSize, sortBy, sortDir, roleKey, employmentType, department, shiftCode, fallbackEmployees, data.length, reloadToken]);

  useEffect(() => {
    const map = new Map<string, string>();
    workConfigs.forEach((c) => map.set(String(c.shift), c.name || `Ca ${c.shift}`));
    // đảm bảo có nhãn cho mọi mã ca đang có trong dữ liệu hiện tại
    [...data, ...fallbackEmployees].forEach((e) => {
      if (e.shiftCode) {
        const key = String(e.shiftCode);
        if (!map.has(key)) map.set(key, `Ca ${key}`);
      }
    });
    setShiftMap(map);
  }, [workConfigs, data, fallbackEmployees]);

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

  const getShiftLabel = (e: Employee) => {
    if (!e.shiftCode) return "-";
    const code = String(e.shiftCode);
    if (shiftMap.has(code)) return shiftMap.get(code)!;
    const byName = workConfigs.find(
      (c) => c.name && c.name.toLowerCase() === code.toLowerCase()
    );
    if (byName) return byName.name;
    return `Ca ${code}`;
  };

  const handleSort = (field: SortField) => {
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
    <>
      <Toaster richColors position="top-right" />
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 transition"
          >
            + Thêm nhân viên
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={(e) => handleSort(e.target.value as SortField)}
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
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
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
              {deptOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <label className="text-slate-600">Ca làm:</label>
            <select
              value={shiftCode}
              onChange={(e) => handleFilter("shiftCode", e.target.value)}
              className="border border-slate-200 rounded px-2 py-1 text-xs"
            >
              <option value="">Tất cả</option>
              {shiftOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Danh sách nhân viên</h2>
            <div className="text-xs text-slate-400">
              Trang {page}/{totalPages} • {total} nhân viên
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
                  <th className="px-3 py-2 text-left font-medium">Chức vụ</th>
                  <th className="px-3 py-2 text-left font-medium">Loại</th>
                  <th className="px-3 py-2 text-left font-medium">Bộ phận</th>
                  <th className="px-3 py-2 text-left font-medium">Ca làm</th>
                  <th className="px-3 py-2 text-left font-medium">Trạng thái làm việc</th>
                  <th className="px-3 py-2 text-left font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading && data.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-slate-400">
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                )}
                {!loading && data.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-slate-400">
                      Chưa có nhân viên nào trong danh sách.
                    </td>
                  </tr>
                )}

                {data.map((e) => (
                  <tr key={e.code} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">{e.code}</td>
                    <td className="px-3 py-2">{e.name}</td>
                    <td className="px-3 py-2">{e.roleName || e.roleKey || "-"}</td>
                    <td className="px-3 py-2">
                      {e.employmentType === "FULL_TIME" ? "Chính thức" : "Thời vụ"}
                    </td>
                    <td className="px-3 py-2">{e.department}</td>
                    <td className="px-3 py-2">{getShiftLabel(e)}</td>
                    <td className="px-3 py-2">
                      {e.workStatusLabel || (e.workStatus === "ACTIVE" ? "Đang làm" : "Đã nghỉ")}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        className="px-3 py-1 rounded-md text-[11px] font-medium bg-blue-600 text-white hover:bg-blue-500 transition"
                        onClick={() =>
                          router.push(
                            `${slug ? `/${slug}` : ""}/quan-ly-nhan-vien/nhan-vien/${encodeURIComponent(e.code)}`
                          )
                        }
                      >
                        Xem chi tiết
                      </button>
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
      </div>

      {showCreate && (
        <CreateEmployeeModal
          roleOptions={roleOptions}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setPage(1);
            setReloadToken((v) => v + 1);
          }}
        />
      )}
    </>
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type CreateEmployeeModalProps = {
  roleOptions: string[];
  onClose: () => void;
  onCreated: () => void;
};

function CreateEmployeeModal({ roleOptions, onClose, onCreated }: CreateEmployeeModalProps) {
  const [name, setName] = useState("");
  const [roleKey, setRoleKey] = useState(roleOptions[0] || "");
  const [employmentType, setEmploymentType] = useState("FULL_TIME");
  const [department, setDepartment] = useState("");
  const [workStatus, setWorkStatus] = useState("ACTIVE");
  const [startDate, setStartDate] = useState(todayIso());
  const [email, setEmail] = useState("");
  const [cccd, setCccd] = useState("");
  const [bhxh, setBhxh] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Vui lòng nhập họ tên");
      return;
    }
    if (!roleKey.trim()) {
      toast.error("Vui lòng chọn chức vụ");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          roleKey: roleKey.trim().toUpperCase(),
          employmentType,
          department: department.trim(),
          workStatus,
          startDate: startDate || undefined,
          email: email.trim() || undefined,
          cccd: cccd.trim() || undefined,
          bhxh: bhxh.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Không thể tạo nhân viên");
      }
      toast.success("Đã tạo nhân viên");
      onCreated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Không thể tạo nhân viên";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-[520px] max-w-full">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Thêm nhân viên mới</p>
            <h3 className="text-sm font-semibold text-slate-900">Thông tin cơ bản</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
            aria-label="Đóng"
            disabled={submitting}
          >
            ×
          </button>
        </div>

        <div className="px-4 py-4 grid grid-cols-2 gap-3 text-xs text-slate-700">
          <label className="flex flex-col gap-1">
            <span className="font-medium text-slate-800">Họ tên *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-slate-200 rounded px-3 py-2 text-sm"
              placeholder="Nguyễn Văn A"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-slate-800">Chức vụ *</span>
            <select
              value={roleKey}
              onChange={(e) => setRoleKey(e.target.value)}
              className="border border-slate-200 rounded px-3 py-2 text-sm"
            >
              <option value="">Chọn chức vụ</option>
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-slate-800">Loại</span>
            <select
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
              className="border border-slate-200 rounded px-3 py-2 text-sm"
            >
              <option value="FULL_TIME">Chính thức</option>
              <option value="TEMPORARY">Thời vụ</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-slate-800">Bộ phận</span>
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="border border-slate-200 rounded px-3 py-2 text-sm"
              placeholder="VD: Kinh doanh"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-slate-800">Trạng thái</span>
            <select
              value={workStatus}
              onChange={(e) => setWorkStatus(e.target.value)}
              className="border border-slate-200 rounded px-3 py-2 text-sm"
            >
              <option value="ACTIVE">Đang làm</option>
              <option value="INACTIVE">Đã nghỉ</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-slate-800">Ngày vào làm</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-slate-200 rounded px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-slate-800">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-slate-200 rounded px-3 py-2 text-sm"
              placeholder="Tùy chọn"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-slate-800">CCCD</span>
            <input
              value={cccd}
              onChange={(e) => setCccd(e.target.value)}
              className="border border-slate-200 rounded px-3 py-2 text-sm"
              placeholder="Tùy chọn"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-slate-800">BHXH</span>
            <input
              value={bhxh}
              onChange={(e) => setBhxh(e.target.value)}
              className="border border-slate-200 rounded px-3 py-2 text-sm"
              placeholder="Tùy chọn"
            />
          </label>
        </div>

        <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition disabled:opacity-50"
            disabled={submitting}
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-500 transition disabled:opacity-50"
          >
            {submitting ? "Đang lưu..." : "Tạo nhân viên"}
          </button>
        </div>
      </div>
    </div>
  );
}
