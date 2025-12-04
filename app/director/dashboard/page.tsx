"use client";

import { useMemo, useState } from "react";
import { DirectorShell } from "@/component/director/DirectorShell";
import type { AttendanceRecord, Employee } from "@/lib/hr-types";
import type { WorkConfig } from "../types";

type WorkShift = {
  id: string;
  label: string;
  shift: number;
};

type RangeType = "day" | "week" | "month";

type DashboardProps = {
  employees: Employee[];
  attendance: AttendanceRecord[];
  workShifts: WorkShift[];
  workConfigs: (WorkConfig & { shift?: number; id?: string })[];
};

export default function DirectorDashboardPage() {
  return (
    <DirectorShell
      activeSection="overview"
      render={({ employees, attendance, workShifts, workConfigs }) => (
        <DashboardSection
          employees={employees}
          attendance={attendance}
          workShifts={workShifts as WorkShift[]}
          workConfigs={workConfigs}
        />
      )}
    />
  );
}

function DashboardSection({ employees, attendance, workShifts, workConfigs }: DashboardProps) {
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [rangeType, setRangeType] = useState<RangeType>("day");
  const [selectedDay, setSelectedDay] = useState<string>(todayIso);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    todayIso.slice(0, 7)
  );
  const [shiftFilter, setShiftFilter] = useState<string>("all");
  const [empTypeFilter, setEmpTypeFilter] = useState<"all" | "FULL_TIME" | "TEMPORARY">("all");
  const weekStart = useMemo(() => startOfWeek(new Date(selectedDay)), [selectedDay]);
  const weekEnd = useMemo(() => endOfWeek(new Date(selectedDay)), [selectedDay]);

  const employeeMap = useMemo(() => {
    const m = new Map<string, Employee>();
    employees.forEach((e) => m.set(e.code, e));
    return m;
  }, [employees]);

  const dateInRange = (date: string) => {
    const d = new Date(date);
    if (rangeType === "day") {
      return date === selectedDay;
    }
    if (rangeType === "week") {
      return d >= weekStart && d <= weekEnd;
    }
    if (!selectedMonth) return false;
    const [y, m] = selectedMonth.split("-").map((v) => parseInt(v, 10));
    return d.getFullYear() === y && d.getMonth() + 1 === m;
  };

  const todayDate = useMemo(() => new Date(todayIso), [todayIso]);

  const dateRangeList = useMemo(() => {
    const dates: string[] = [];
    let start: Date;
    let end: Date;
    if (rangeType === "day") {
        const day = new Date(selectedDay);
        if (day > todayDate) return [];
        return [selectedDay];
    }
    if (rangeType === "week") {
      start = new Date(weekStart);
      end = new Date(weekEnd);
    } else {
      const [y, m] = selectedMonth.split("-").map((v) => parseInt(v, 10));
      start = new Date(y, m - 1, 1);
      end = endOfMonth(start);
    }
    if (end > todayDate) end = new Date(todayDate);
    if (start > end) return [];
    for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
      dates.push(new Date(cur).toISOString().slice(0, 10));
    }
    return dates;
  }, [rangeType, selectedDay, selectedMonth, weekStart, weekEnd, todayDate]);

  const getConfigForEmployee = useMemo(
    () => (e: Employee): WorkConfig => {
      const code = e.shiftCode ? String(e.shiftCode) : null;
      const found = workConfigs.find((c) => String(c.shift ?? c.id) === code);
      const fallback = workConfigs[0];
      return {
        standardCheckIn: found?.standardCheckIn || fallback?.standardCheckIn || "08:00",
        standardCheckOut: found?.standardCheckOut || fallback?.standardCheckOut || "17:00",
        lateGraceMinutes: found?.lateGraceMinutes ?? fallback?.lateGraceMinutes ?? 5,
        earlyLeaveGraceMinutes: found?.earlyLeaveGraceMinutes ?? fallback?.earlyLeaveGraceMinutes ?? 5,
        overtimeThresholdMinutes: found?.overtimeThresholdMinutes ?? fallback?.overtimeThresholdMinutes ?? 60,
      };
    },
    [workConfigs]
  );

  const summary = useMemo(() => {
    const activeEmployees = employees.filter((e) => e.workStatus === "ACTIVE");
    const filteredByShift =
      shiftFilter === "all"
        ? activeEmployees
        : activeEmployees.filter((e) => String(e.shiftCode ?? "") === shiftFilter);
    const filtered =
      empTypeFilter === "all"
        ? filteredByShift
        : filteredByShift.filter((e) => e.employmentType === empTypeFilter);

    const activeSet = new Set(filtered.map((e) => e.code));

    const recordsInRange = attendance.filter(
      (r) => activeSet.has(r.employeeCode) && dateInRange(r.date)
    );

    type Slot = {
      present: boolean;
      late: boolean;
      early: boolean;
      ot: boolean;
      hasCheckOut: boolean;
    };

    const slotMap = new Map<string, Slot>();
    // Khởi tạo slot mặc định vắng cho tất cả nhân viên trong khoảng ngày
    filtered.forEach((emp) => {
      dateRangeList.forEach((d) => {
        const key = `${emp.code}-${d}`;
        slotMap.set(key, {
          present: false,
          late: false,
          early: false,
          ot: false,
          hasCheckOut: false,
        });
      });
    });

    const checkoutRows: AttendanceRecord[] = [];

    recordsInRange.forEach((r) => {
      const emp = employeeMap.get(r.employeeCode);
      if (!emp) return;
      const cfg = getConfigForEmployee(emp);
      const stdIn = timeToMinutes(cfg.standardCheckIn) ?? 0;
      const stdOut = timeToMinutes(cfg.standardCheckOut);
      const lateGrace = cfg.lateGraceMinutes ?? 0;
      const earlyGrace = cfg.earlyLeaveGraceMinutes ?? 0;
      const otThreshold = cfg.overtimeThresholdMinutes ?? 60;

      const key = `${r.employeeCode}-${r.date}`;
      const slot = slotMap.get(key);
      if (!slot) return; // ngoài phạm vi

      const checkInM = timeToMinutes(r.checkIn);
      if (checkInM !== null) {
        slot.present = true;
        if (checkInM > stdIn + lateGrace) slot.late = true;
      }

      const checkOutM = timeToMinutes(r.checkOut);
      if (checkOutM !== null && stdOut !== null) {
        slot.hasCheckOut = true;
        checkoutRows.push(r);
        if (checkOutM < stdOut - earlyGrace) slot.early = true;
        else if (checkOutM > stdOut + otThreshold) slot.ot = true;
      }

      slotMap.set(key, slot);
    });

    let late = 0;
    let onTime = 0;
    let earlyLeave = 0;
    let onTimeLeave = 0;
    let overtime = 0;
    const presentCodes = new Set<string>();
    let presentSlots = 0;

    slotMap.forEach((slot, key) => {
      const [code] = key.split("-");
      if (slot.present) {
        presentCodes.add(code);
        presentSlots++;
      }
      if (slot.present) {
        if (slot.late) late++;
        else onTime++;
      }

      if (slot.early) earlyLeave++;
      else if (slot.ot) overtime++;
      else if (slot.hasCheckOut) onTimeLeave++;
    });

    const expectedSlots = filtered.length * dateRangeList.length;
    const absent = Math.max(0, expectedSlots - presentSlots);

    const absentEmployees: { code: string; name: string; shift?: string; absentDays: number }[] = [];
    filtered.forEach((emp) => {
      const presentDays = Array.from(slotMap.entries()).filter(
        ([k, slot]) => k.startsWith(emp.code + "-") && slot.present
      ).length;
      const absentDays = Math.max(0, dateRangeList.length - presentDays);
      if (absentDays > 0) {
        absentEmployees.push({
          code: emp.code,
          name: emp.name,
          shift: emp.shiftCode ? `Ca ${emp.shiftCode}` : "-",
          absentDays,
        });
      }
    });

    return {
      totalEmployees: filtered.length,
      present: presentCodes.size,
      presentSlots,
      late,
      onTime,
      absent,
      earlyLeave,
      onTimeLeave,
      overtime,
      checkoutRows,
      records: recordsInRange,
      presentEmployees: presentCodes,
      absentEmployees,
    };
  }, [
    attendance,
    employees,
    shiftFilter,
    empTypeFilter,
    dateInRange,
    getConfigForEmployee,
    dateRangeList.length,
    employeeMap,
    dateRangeList,
  ]);

  const lateRows = summary.records.filter((r) => {
    const emp = employeeMap.get(r.employeeCode);
    if (!emp) return false;
    const cfg = getConfigForEmployee(emp);
    const stdIn = timeToMinutes(cfg.standardCheckIn) ?? 0;
    const lateGrace = cfg.lateGraceMinutes ?? 0;
    const checkInM = timeToMinutes(r.checkIn);
    return checkInM !== null && checkInM > stdIn + lateGrace;
  });

  const earlyRows = summary.checkoutRows.filter((r) => {
    const emp = employeeMap.get(r.employeeCode);
    if (!emp) return false;
    const cfg = getConfigForEmployee(emp);
    const stdOut = timeToMinutes(cfg.standardCheckOut);
    const earlyGrace = cfg.earlyLeaveGraceMinutes ?? 0;
    const checkOutM = timeToMinutes(r.checkOut);
    return stdOut !== null && checkOutM !== null && checkOutM < stdOut - earlyGrace;
  });

  const overtimeRows = summary.checkoutRows.filter((r) => {
    const emp = employeeMap.get(r.employeeCode);
    if (!emp) return false;
    const cfg = getConfigForEmployee(emp);
    const stdOut = timeToMinutes(cfg.standardCheckOut);
    const ot = cfg.overtimeThresholdMinutes ?? 60;
    const checkOutM = timeToMinutes(r.checkOut);
    return stdOut !== null && checkOutM !== null && checkOutM > stdOut + ot;
  });

  const percent = (value: number, total: number) => (total > 0 ? Math.round((value / total) * 100) : 0);
  const totalCheckInBase = summary.onTime + summary.late + summary.absent;
  const totalCheckOutBase = summary.onTimeLeave + summary.earlyLeave + summary.overtime + summary.absent;

  const formatDate = (iso?: string | null) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 flex flex-wrap gap-3 items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Tổng quan chấm công</h2>
          <p className="text-xs text-slate-500">Theo ngày / tuần / tháng và lọc theo ca.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs items-center">
          <label className="flex items-center gap-1 text-slate-600">
            <span>Phạm vi</span>
            <select
              className="border border-slate-200 rounded-md px-2 py-1"
              value={rangeType}
              onChange={(e) => setRangeType(e.target.value as RangeType)}
            >
              <option value="day">Ngày</option>
              <option value="week">Tuần</option>
              <option value="month">Tháng</option>
            </select>
          </label>
          {rangeType !== "month" ? (
            <input
              type="date"
              className="border border-slate-200 rounded-md px-2 py-1"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value || todayIso)}
            />
          ) : (
            <input
              type="month"
              className="border border-slate-200 rounded-md px-2 py-1"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value || todayIso.slice(0, 7))}
            />
          )}
          {rangeType === "week" && (
            <div className="flex items-center gap-2 text-slate-500">
              <div className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-[11px] font-semibold border border-blue-100">
                Bắt đầu: {formatDate(weekStart.toISOString().slice(0, 10))}
              </div>
              <div className="px-2 py-1 bg-blue-600 text-white rounded-md text-[11px] font-semibold">
                Kết thúc: {formatDate(weekEnd.toISOString().slice(0, 10))}
              </div>
            </div>
          )}
          {rangeType === "month" && (
            <span className="text-slate-500">
              Tháng: {selectedMonth}
            </span>
          )}
          <label className="flex items-center gap-1 text-slate-600">
            <span>Ca</span>
            <select
              className="border border-slate-200 rounded-md px-2 py-1"
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
            >
              <option value="all">Tất cả</option>
              {workShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1 text-slate-600">
            <span>Loại NV</span>
            <select
              className="border border-slate-200 rounded-md px-2 py-1"
              value={empTypeFilter}
              onChange={(e) =>
                setEmpTypeFilter(e.target.value as "all" | "FULL_TIME" | "TEMPORARY")
              }
            >
              <option value="all">Tất cả</option>
              <option value="FULL_TIME">Chính thức</option>
              <option value="TEMPORARY">Thời vụ</option>
            </select>
          </label>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Nhân viên đang lọc" value={summary.totalEmployees} />
        <StatCard label="Đi làm" value={summary.present} />
        <StatCard label="Vắng" value={summary.absent} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Check-in</h3>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <MiniStat label="Đúng giờ" value={summary.onTime} />
            <MiniStat label="Đi trễ" value={summary.late} />
            <MiniStat label="Vắng" value={summary.absent} />
          </div>
          <ProgressBar
            label="Tỉ lệ đúng giờ"
            percent={percent(summary.onTime, totalCheckInBase)}
            color="bg-emerald-500"
          />
          <ProgressBar
            label="Tỉ lệ đi trễ"
            percent={percent(summary.late, totalCheckInBase)}
            color="bg-orange-500"
          />
          <ProgressBar
            label="Tỉ lệ vắng"
            percent={percent(summary.absent, totalCheckInBase)}
            color="bg-slate-500"
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">Check-out</h3>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <MiniStat label="Đúng giờ" value={summary.onTimeLeave} />
            <MiniStat label="Về sớm" value={summary.earlyLeave} />
            <MiniStat label="Tăng ca" value={summary.overtime} />
          </div>
          <ProgressBar
            label="Tỉ lệ đúng giờ"
            percent={percent(summary.onTimeLeave, totalCheckOutBase)}
            color="bg-blue-600"
          />
          <ProgressBar
            label="Tỉ lệ về sớm"
            percent={percent(summary.earlyLeave, totalCheckOutBase)}
            color="bg-amber-500"
          />
          <ProgressBar
            label="Tỉ lệ tăng ca"
            percent={percent(summary.overtime, totalCheckOutBase)}
            color="bg-purple-500"
          />
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Chi tiết đi trễ</h3>
        <SimpleTable
          rows={lateRows}
          employeeMap={employeeMap}
          formatDate={formatDate}
          getConfigForEmployee={getConfigForEmployee}
          type="late"
        />
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Chi tiết về sớm</h3>
        <SimpleTable
          rows={earlyRows}
          employeeMap={employeeMap}
          formatDate={formatDate}
          getConfigForEmployee={getConfigForEmployee}
          type="early"
        />
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Chi tiết tăng ca</h3>
        <SimpleTable
          rows={overtimeRows}
          employeeMap={employeeMap}
          formatDate={formatDate}
          getConfigForEmployee={getConfigForEmployee}
          type="ot"
        />
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Chi tiết nghỉ/vắng</h3>
        <AbsentTable
          rows={summary.absentEmployees}
          formatDate={formatDate}
          rangeLabel={
            rangeType === "day"
              ? formatDate(selectedDay)
              : rangeType === "week"
              ? `${formatDate(startOfWeek(new Date(selectedDay)).toISOString().slice(0, 10))} - ${formatDate(
                  endOfWeek(new Date(selectedDay)).toISOString().slice(0, 10)
                )}`
              : `${selectedMonth}`
          }
        />
      </section>
    </div>
  );
}

function SimpleTable({
  rows,
  employeeMap,
  formatDate,
  getConfigForEmployee,
  type,
}: {
  rows: AttendanceRecord[];
  employeeMap: Map<string, Employee>;
  formatDate: (v?: string | null) => string;
  getConfigForEmployee: (e: Employee) => WorkConfig;
  type: "late" | "early" | "ot";
}) {
  const labelMap = {
    late: "Đi trễ",
    early: "Về sớm",
    ot: "Tăng ca",
  } as const;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Ngày</th>
            <th className="px-3 py-2 text-left font-medium">Mã NV</th>
            <th className="px-3 py-2 text-left font-medium">Họ và tên</th>
            <th className="px-3 py-2 text-left font-medium">Ca</th>
            <th className="px-3 py-2 text-left font-medium">Check-in</th>
            <th className="px-3 py-2 text-left font-medium">Check-out</th>
            <th className="px-3 py-2 text-left font-medium">{labelMap[type]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-4 text-center text-slate-400">
                Không có dữ liệu.
              </td>
            </tr>
          )}
          {rows.map((r, idx) => {
            const emp = employeeMap.get(r.employeeCode);
            if (!emp) return null;
            const cfg = getConfigForEmployee(emp);
            const stdIn = timeToMinutes(cfg.standardCheckIn) ?? 0;
            const stdOut = timeToMinutes(cfg.standardCheckOut);
            const lateGrace = cfg.lateGraceMinutes ?? 0;
            const earlyGrace = cfg.earlyLeaveGraceMinutes ?? 0;
            const ot = cfg.overtimeThresholdMinutes ?? 60;
            const checkInM = timeToMinutes(r.checkIn);
            const checkOutM = timeToMinutes(r.checkOut);
            const shiftLabel = emp.shiftCode ? `Ca ${emp.shiftCode}` : "-";

            let desc = "";
            if (type === "late") {
              const minutesLate =
                checkInM !== null ? Math.max(0, checkInM - (stdIn + lateGrace)) : 0;
              desc = minutesLate ? `${minutesLate} phút` : "-";
            } else if (type === "early" && stdOut !== null && checkOutM !== null) {
              const minutesEarly = Math.max(0, (stdOut - earlyGrace) - checkOutM);
              desc = minutesEarly ? `${minutesEarly} phút` : "-";
            } else if (type === "ot" && stdOut !== null && checkOutM !== null) {
              const minutesOT = Math.max(0, checkOutM - (stdOut + ot));
              desc = minutesOT ? `${minutesOT} phút` : "-";
            }

            return (
              <tr key={`${r.employeeCode}-${r.date}-${idx}`} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2">{formatDate(r.date)}</td>
                <td className="px-3 py-2">{emp.code}</td>
                <td className="px-3 py-2">{emp.name}</td>
                <td className="px-3 py-2">{shiftLabel}</td>
                <td className="px-3 py-2">{r.checkIn || "-"}</td>
                <td className="px-3 py-2">{r.checkOut || "-"}</td>
                <td className="px-3 py-2">{desc}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AbsentTable({
  rows,
  formatDate,
  rangeLabel,
}: {
  rows: { code: string; name: string; shift?: string; absentDays: number }[];
  formatDate: (v?: string | null) => string;
  rangeLabel: string;
}) {
  return (
    <div className="overflow-x-auto">
      <div className="text-xs text-slate-500 mb-2">Khoảng: {rangeLabel}</div>
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Mã NV</th>
            <th className="px-3 py-2 text-left font-medium">Họ và tên</th>
            <th className="px-3 py-2 text-left font-medium">Ca</th>
            <th className="px-3 py-2 text-left font-medium">Số ngày vắng</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                Không có nhân viên vắng trong khoảng này.
              </td>
            </tr>
          )}
          {rows.map((e) => (
            <tr key={e.code} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-2">{e.code}</td>
              <td className="px-3 py-2">{e.name}</td>
              <td className="px-3 py-2">{e.shift || "-"}</td>
              <td className="px-3 py-2">{e.absentDays}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <div className="text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function ProgressBar(props: {
  label: string;
  percent: number;
  color: string;
  helperText?: string;
}) {
  const { label, percent, color, helperText } = props;
  const safePercent = Math.min(100, Math.max(0, percent));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>{label}</span>
        <span className="font-semibold text-slate-900">
          {safePercent}%
          {helperText ? ` · ${helperText}` : ""}
        </span>
      </div>
      <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${safePercent}%` }}
        />
      </div>
    </div>
  );
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // ISO week start Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function endOfMonth(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function timeToMinutes(time?: string | null): number | null {
  if (!time) return null;
  const [hh, mm] = time.split(":").map((v) => parseInt(v, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}
