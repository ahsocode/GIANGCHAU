"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/component/layout/AppShell";
import type { AttendanceRecord, Employee } from "@/lib/hr-types";
import type { WorkConfig } from "@/app/types";

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

export default function DashboardPage() {
  return (
    <AppShell
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

    const codes = new Set(filtered.map((e) => e.code));
    const recordsInRange = attendance.filter(
      (a) => codes.has(a.employeeCode) && dateInRange(a.date)
    );

    const workedCodes = new Set(recordsInRange.map((a) => a.employeeCode));
    const lateCodes = new Set(
      recordsInRange
        .filter((a) => {
          const e = employeeMap.get(a.employeeCode);
          const cfg = e ? getConfigForEmployee(e) : workConfigs[0];
          const stdIn = timeToMinutes(cfg?.standardCheckIn) ?? 0;
          const lateGrace = cfg?.lateGraceMinutes ?? 0;
          const checkInM = timeToMinutes(a.checkIn);
          return checkInM !== null && checkInM > stdIn + lateGrace;
        })
        .map((a) => a.employeeCode)
    );

    const total = filtered.length;
    const worked = workedCodes.size;
    const late = lateCodes.size;
    const absent = total - worked;

    return { total, worked, late, absent };
  }, [
    attendance,
    employees,
    employeeMap,
    empTypeFilter,
    getConfigForEmployee,
    dateInRange,
    shiftFilter,
    workConfigs,
  ]);

  const formatDate = (iso?: string | null) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Tổng quan</h2>
            <p className="text-xs text-slate-500">
              Thống kê chấm công theo ngày/tuần/tháng, lọc theo ca & loại nhân viên.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <select
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              value={rangeType}
              onChange={(e) => setRangeType(e.target.value as RangeType)}
            >
              <option value="day">Ngày</option>
              <option value="week">Tuần</option>
              <option value="month">Tháng</option>
            </select>
            {rangeType === "day" && (
              <input
                type="date"
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
              />
            )}
            {rangeType === "week" && (
              <input
                type="date"
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
              />
            )}
            {rangeType === "month" && (
              <input
                type="month"
                className="border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <OverviewCard label="Tổng nhân viên" value={summary.total} />
          <OverviewCard label="Đã chấm công" value={summary.worked} />
          <OverviewCard label="Đi trễ" value={summary.late} />
          <OverviewCard label="Vắng" value={summary.absent} />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-600">Ca:</span>
            <select
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
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
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-600">Loại NV:</span>
            <select
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              value={empTypeFilter}
              onChange={(e) =>
                setEmpTypeFilter(e.target.value as "all" | "FULL_TIME" | "TEMPORARY")
              }
            >
              <option value="all">Tất cả</option>
              <option value="FULL_TIME">Chính thức</option>
              <option value="TEMPORARY">Thời vụ</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewCard(props: { label: string; value: number }) {
  const { label, value } = props;
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold text-slate-900 mt-1">{value}</div>
    </div>
  );
}

// utils
function timeToMinutes(time?: string | null): number | null {
  if (!time) return null;
  const [hh, mm] = time.split(":").map((v) => parseInt(v, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0-6
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // về thứ 2
  return new Date(d.setDate(diff));
}

function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
