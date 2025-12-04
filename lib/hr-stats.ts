// lib/hr-stats.ts
import type { Employee, AttendanceRecord } from "./hr-types";

const SHIFT_START = "08:00";

function isLaterThan(time: string | undefined, ref: string): boolean {
  if (!time) return false;
  // giả sử format "HH:MM"
  return time.localeCompare(ref) > 0;
}

export interface DailyCounts {
  total: number;
  fullTime: number;
  temporary: number;
}

export interface DailySummary {
  working: DailyCounts;
  late: DailyCounts;
  absent: DailyCounts;
}

// Helper đếm theo loại nhân viên
function countByType(employeeCodes: string[], employees: Employee[]): DailyCounts {
  const setCodes = new Set(employeeCodes);
  const selected = employees.filter(
    (e) => e.workStatus === "ACTIVE" && setCodes.has(e.code)
  );

  const fullTime = selected.filter((e) => e.employmentType === "FULL_TIME").length;
  const temporary = selected.filter((e) => e.employmentType === "TEMPORARY").length;

  return {
    total: selected.length,
    fullTime,
    temporary,
  };
}

export function computeDailySummary(
  date: string,
  employees: Employee[],
  attendance: AttendanceRecord[]
): DailySummary {
  const activeEmployees = employees.filter((e) => e.workStatus === "ACTIVE");

  // Attendance trong ngày
  const attInDay = attendance.filter((a) => a.date === date);

  const workedCodes = Array.from(
    new Set(attInDay.map((a) => a.employeeCode))
  );

  const lateCodes = Array.from(
    new Set(
      attInDay
        .filter((a) => isLaterThan(a.checkIn, SHIFT_START))
        .map((a) => a.employeeCode)
    )
  );

  const allActiveCodes = new Set(activeEmployees.map((e) => e.code));
  const workedSet = new Set(workedCodes);
  const absentCodes: string[] = [];
  allActiveCodes.forEach((code) => {
    if (!workedSet.has(code)) absentCodes.push(code);
  });

  return {
    working: countByType(workedCodes, employees),
    late: countByType(lateCodes, employees),
    absent: countByType(absentCodes, employees),
  };
}
