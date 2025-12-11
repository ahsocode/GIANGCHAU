import type { AttendanceRecord, Employee } from "@/lib/hr-types";

export type DirectorSection =
  | "overview"
  | "employeesOverview"
  | "employees"
  | "employeeInfo"
  | "employeeAccounts"
  | "attendance"
  | "shiftOverview"
  | "shifts"
  | "shiftAssignment"
  | "departments"
  | "factories"
  | "roles"
  | "permissions";

export type WorkConfig = {
  standardCheckIn: string; // "08:00"
  standardCheckOut: string; // "17:00"
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  overtimeThresholdMinutes: number;
};

export type WorkConfigRecord = WorkConfig & {
  id: string;
  shift: number; // 1,2,3...
  name?: string | null;
  capacities?: WorkShiftCapacity[];
};

export type WorkShift = {
  id: string;
  shift: string;
  description?: string;
};

export type Department = {
  id: string;
  code: string;
  name: string;
  notes?: string | null;
};

export type WorkShiftCapacity = {
  id: string | number;
  workConfigId: string | number;
  departmentId: string;
  maxEmployees: number;
  department?: Department;
};

export type OverviewStats = {
  totalEmployees: number;
  totalFullTime: number;
  totalTemp: number;

  workingTotal: number;
  workingFullTime: number;
  workingTemp: number;

  lateTotal: number;
  lateFullTime: number;
  lateTemp: number;

  fullTimePresent: number;
  fullTimeLate: number;
  fullTimeAbsent: number;

  tempPresent: number;
  tempLate: number;
  tempAbsent: number;

  currentDateLabel: string | null;
};

export type AttendanceProps = {
  employees: Employee[];
  attendance: AttendanceRecord[];
};
