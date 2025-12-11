"use client";

import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "sonner";
import { AppShell } from "@/component/layout/AppShell";
import type { WorkConfigRecord, Department as DeptType } from "@/app/types";
import type { Employee } from "@/lib/hr-types";

type Department = { id: string; code: string; name: string };
type ShiftDraft = WorkConfigRecord & {
  name: string;
  maxPerDept: Record<string, number>;
};

type ApiCapacity = {
  department?: { code?: string };
  departmentId?: string;
  maxEmployees?: number;
};

type ApiShift = {
  id: string | number;
  shift: number;
  name?: string | null;
  standardCheckIn: string;
  standardCheckOut: string;
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  overtimeThresholdMinutes: number;
  capacities?: ApiCapacity[];
};

export default function ShiftsPage() {
  return (
    <AppShell
      activeSection="shifts"
      render={({ workConfigs, employees }) => (
        <ShiftsScreen initialConfigs={workConfigs} employees={employees} />
      )}
    />
  );
}

function ShiftsScreen({
  initialConfigs,
  employees,
}: {
  initialConfigs: WorkConfigRecord[];
  employees: Employee[];
}) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ShiftDraft | null>(null);
  const deptTotals = useMemo(() => {
    const map: Record<string, number> = {};
    employees.forEach((e) => {
      const key = (e.department || "").trim();
      if (!key) return;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [employees]);

  const initialShifts: ShiftDraft[] = useMemo(() => {
    if (!initialConfigs.length) {
      return [
        {
          id: "temp-1",
          shift: 1,
          name: "Ca 1",
          standardCheckIn: "08:00",
          standardCheckOut: "17:00",
          lateGraceMinutes: 5,
          earlyLeaveGraceMinutes: 5,
          overtimeThresholdMinutes: 60,
          maxPerDept: {},
        },
      ];
    }
    return initialConfigs.map((cfg) => ({
      ...cfg,
      name: `Ca ${cfg.shift}`,
      maxPerDept: {},
    }));
  }, [initialConfigs]);

  const [shifts, setShifts] = useState<ShiftDraft[]>(initialShifts);

  const [shiftForm, setShiftForm] = useState<ShiftDraft>({
    id: "",
    shift: shifts.length ? shifts[shifts.length - 1].shift + 1 : 1,
    name: "",
    standardCheckIn: "08:00",
    standardCheckOut: "17:00",
    lateGraceMinutes: 5,
    earlyLeaveGraceMinutes: 5,
    overtimeThresholdMinutes: 60,
    maxPerDept: {},
  });

  const saveShift = () => {
    if (!shiftForm.name) return;
    setLoading(true);
    setError(null);

    const capacitiesPayload = Object.entries(shiftForm.maxPerDept)
      .filter(([, v]) => v != null)
      .map(([code, max]) => {
        const dept = departments.find((d) => d.code === code);
        return dept ? { departmentId: dept.id, maxEmployees: Number(max) || 0 } : null;
      })
      .filter(Boolean);

    const payload = {
      name: shiftForm.name,
      shift: shiftForm.shift,
      standardCheckIn: shiftForm.standardCheckIn,
      standardCheckOut: shiftForm.standardCheckOut,
      lateGraceMinutes: shiftForm.lateGraceMinutes,
      earlyLeaveGraceMinutes: shiftForm.earlyLeaveGraceMinutes,
      overtimeThresholdMinutes: shiftForm.overtimeThresholdMinutes,
      capacities: capacitiesPayload,
    };

    const isEdit = Boolean(editingId);
    const url = isEdit ? `/api/shifts/${editingId}` : "/api/shifts";
    const method = isEdit ? "PATCH" : "POST";

    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || (isEdit ? "Không thể cập nhật ca" : "Không thể tạo ca"));
        }
        return res.json();
      })
      .then((saved: ApiShift) => {
        const maxPerDept = (saved.capacities || []).reduce(
          (acc: Record<string, number>, c: ApiCapacity) => {
            const code = c.department?.code || c.departmentId;
            if (code) acc[code] = c.maxEmployees || 0;
            return acc;
          },
          {}
        );
        const nextShift: ShiftDraft = {
          id: String(saved.id),
          shift: saved.shift,
          name: saved.name || `Ca ${saved.shift}`,
          standardCheckIn: saved.standardCheckIn,
          standardCheckOut: saved.standardCheckOut,
          lateGraceMinutes: saved.lateGraceMinutes,
          earlyLeaveGraceMinutes: saved.earlyLeaveGraceMinutes,
          overtimeThresholdMinutes: saved.overtimeThresholdMinutes,
          maxPerDept,
        };

        setShifts((prev) => {
          if (!isEdit) return [...prev, nextShift];
          return prev.map((s) => (s.id === nextShift.id ? nextShift : s));
        });

        setShiftForm({
          id: "",
          shift: isEdit
            ? Math.max(...shifts.map((m) => m.shift), saved.shift) + 1
            : shiftForm.shift + 1,
          name: "",
          standardCheckIn: "08:00",
          standardCheckOut: "17:00",
          lateGraceMinutes: 5,
          earlyLeaveGraceMinutes: 5,
          overtimeThresholdMinutes: 60,
          maxPerDept: {},
        });
        setEditingId(null);
        toast.success(isEdit ? "Đã cập nhật ca" : "Đã tạo ca");
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  };

  const updateMaxPerDept = (shiftId: string, deptCode: string, value: number) => {
    setShifts((prev) =>
      prev.map((s) =>
        s.shift === Number(shiftId) || s.id === shiftId
          ? { ...s, maxPerDept: { ...s.maxPerDept, [deptCode]: value } }
          : s
      )
    );
  };

  const deleteShift = (id: string) => {
    setLoading(true);
    setError(null);
    fetch(`/api/shifts/${id}`, { method: "DELETE" })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Không thể xóa ca");
        }
        return res.json();
      })
      .then(() => {
        setShifts((prev) => prev.filter((s) => s.id !== id));
        if (editingId === id) {
          setEditingId(null);
          setShiftForm({
            id: "",
            shift: shifts.length ? Math.max(...shifts.map((m) => m.shift)) + 1 : 1,
            name: "",
            standardCheckIn: "08:00",
            standardCheckOut: "17:00",
            lateGraceMinutes: 5,
            earlyLeaveGraceMinutes: 5,
            overtimeThresholdMinutes: 60,
            maxPerDept: {},
          });
        }
        toast.success("Đã xóa ca làm");
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

  const loadInitial = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/departments").then((r) => r.ok ? r.json() : Promise.reject(r)),
      fetch("/api/shifts").then((r) => r.ok ? r.json() : Promise.reject(r)),
    ])
      .then(([deptData, shiftData]: [DeptType[], ApiShift[]]) => {
        const mappedDept: Department[] = deptData.map((d) => ({
          id: d.id,
          code: d.code,
          name: d.name,
        }));
        const mappedShifts: ShiftDraft[] = shiftData.map((s) => ({
          id: String(s.id),
          shift: s.shift,
          name: s.name || `Ca ${s.shift}`,
          standardCheckIn: s.standardCheckIn,
          standardCheckOut: s.standardCheckOut,
          lateGraceMinutes: s.lateGraceMinutes,
          earlyLeaveGraceMinutes: s.earlyLeaveGraceMinutes,
          overtimeThresholdMinutes: s.overtimeThresholdMinutes,
          maxPerDept: (s.capacities || []).reduce(
            (acc: Record<string, number>, c: ApiCapacity) => {
              const code = c.department?.code || c.departmentId;
              if (code) acc[code] = c.maxEmployees || 0;
              return acc;
            },
            {}
          ),
        }));
        setDepartments(mappedDept);
        setShifts(mappedShifts.length ? mappedShifts : initialShifts);
        setShiftForm((prev) => ({
          ...prev,
          shift: mappedShifts.length ? Math.max(...mappedShifts.map((m) => m.shift)) + 1 : prev.shift,
        }));
      })
      .catch(async (err: unknown) => {
        let message = "Không tải được dữ liệu";
        if (err && typeof err === "object" && "json" in err && typeof (err as Response).json === "function") {
          const data = await (err as Response).json().catch(() => ({}));
          message = (data as { error?: string }).error || message;
        } else if (err instanceof Error) {
          message = err.message;
        }
        setError(message);
        setDepartments(initialConfigs.length ? departments : []);
        setShifts(initialShifts);
      })
      .finally(() => setLoading(false));
  };

  // load once
  useEffect(() => {
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <Toaster richColors position="top-right" />
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Quản lý ca làm</h2>
            <p className="text-sm text-slate-600">
              Đặt tên ca, giờ vào/ra, cấu hình trễ/sớm/tăng ca và giới hạn nhân viên theo bộ phận.
            </p>
            <p className="text-xs text-slate-500">
              Quản lý bộ phận đã tách sang tab riêng trong sidebar.
            </p>
          </div>
          <span className="text-xs text-slate-500">
            {loading ? "Đang tải..." : "Đã kết nối API (Prisma)"}
          </span>
        </div>
        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2 mb-3">
            {error}
          </div>
        )}

        <div className="border border-slate-200 rounded-lg p-4">
          <div className="space-y-3">
            <Input
              label="Tên ca"
              value={shiftForm.name}
              onChange={(v) => setShiftForm((s) => ({ ...s, name: v }))}
              placeholder="Ca sáng"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Giờ bắt đầu"
                value={shiftForm.standardCheckIn}
                onChange={(v) => setShiftForm((s) => ({ ...s, standardCheckIn: v }))}
                placeholder="08:00"
              />
              <Input
                label="Giờ kết thúc"
                value={shiftForm.standardCheckOut}
                onChange={(v) => setShiftForm((s) => ({ ...s, standardCheckOut: v }))}
                placeholder="17:00"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Cho phép vào trễ (phút)"
                type="number"
                value={String(shiftForm.lateGraceMinutes)}
                onChange={(v) =>
                  setShiftForm((s) => ({ ...s, lateGraceMinutes: Number(v) || 0 }))
                }
              />
              <Input
                label="Tính ra sớm (phút)"
                type="number"
                value={String(shiftForm.earlyLeaveGraceMinutes)}
                onChange={(v) =>
                  setShiftForm((s) => ({ ...s, earlyLeaveGraceMinutes: Number(v) || 0 }))
                }
              />
              <Input
                label="Bắt đầu tính tăng ca (phút)"
                type="number"
                value={String(shiftForm.overtimeThresholdMinutes)}
                onChange={(v) =>
                  setShiftForm((s) => ({ ...s, overtimeThresholdMinutes: Number(v) || 0 }))
                }
              />
            </div>
            <button
              onClick={saveShift}
              disabled={loading}
              className="w-full rounded-md bg-blue-600 text-white text-sm font-medium py-2 hover:bg-blue-500 transition"
            >
              {loading ? "Đang lưu..." : editingId ? "Cập nhật ca" : "Thêm ca làm"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Danh sách ca làm</h3>
          <span className="text-xs text-slate-500">
            {shifts.length} ca · {departments.length} bộ phận
          </span>
        </div>
        {loading && <div className="text-xs text-slate-500">Đang tải dữ liệu...</div>}

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Tên ca</th>
                <th className="px-3 py-2 text-left font-medium">Giờ làm</th>
                <th className="px-3 py-2 text-left font-medium">Trễ/Sớm/OT</th>
                <th className="px-3 py-2 text-left font-medium">Giới hạn theo bộ phận</th>
                <th className="px-3 py-2 text-left font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr key={s.id || s.name + s.shift} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-800">
                    {s.standardCheckIn} - {s.standardCheckOut}
                  </td>
                  <td className="px-3 py-2 text-slate-700">
                    Trễ: {s.lateGraceMinutes}p · Sớm: {s.earlyLeaveGraceMinutes}p · OT sau{" "}
                    {s.overtimeThresholdMinutes}p
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-2">
                      {departments.map((d) => (
                        <div key={d.code} className="flex items-center gap-2">
                          <span className="w-20 text-[11px] text-slate-600">
                            {d.code}{" "}
                            {deptTotals[d.name] != null && (
                              <span className="text-slate-400">(Tổng {deptTotals[d.name]})</span>
                            )}
                          </span>
                          <input
                            type="number"
                            min={0}
                            className="w-24 border border-slate-200 rounded px-2 py-1 text-xs"
                            value={s.maxPerDept[d.code] ?? ""}
                            onChange={(e) =>
                              updateMaxPerDept(
                                s.id || String(s.shift),
                                d.code,
                                Number(e.target.value) || 0
                              )
                            }
                            placeholder="Số lượng"
                          />
                        </div>
                      ))}
                      {departments.length === 0 && (
                        <div className="text-xs text-slate-500">Chưa có bộ phận.</div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1 text-[11px] border border-blue-200 rounded-md text-blue-700 hover:bg-blue-50"
                        onClick={() => {
                          setEditingId(s.id);
                          setShiftForm({
                            id: s.id,
                            shift: s.shift,
                            name: s.name,
                            standardCheckIn: s.standardCheckIn,
                            standardCheckOut: s.standardCheckOut,
                            lateGraceMinutes: s.lateGraceMinutes,
                            earlyLeaveGraceMinutes: s.earlyLeaveGraceMinutes,
                            overtimeThresholdMinutes: s.overtimeThresholdMinutes,
                            maxPerDept: s.maxPerDept || {},
                          });
                        }}
                        disabled={loading}
                      >
                        Sửa
                      </button>
                      <button
                        className="px-3 py-1 text-[11px] border border-red-200 rounded-md text-red-700 hover:bg-red-50"
                        onClick={() => setPendingDelete(s)}
                        disabled={loading}
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

      {pendingDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 w-[360px] max-w-[90vw] p-4 space-y-3">
            <div className="text-sm font-semibold text-slate-900">Xóa ca làm?</div>
            <p className="text-xs text-slate-600">
              Bạn chắc chắn muốn xóa ca <strong>{pendingDelete.name}</strong>? Thao tác này không thể
              hoàn tác.
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
                onClick={() => deleteShift(pendingDelete.id)}
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
