import type { AttendanceRecord, Employee } from "@/lib/hr-types";

export type DirectorSection = "overview" | "employees" | "attendance" | "shifts";

export type WorkConfig = {
  standardCheckIn: string; // "08:00"
  standardCheckOut: string; // "17:00"
  lateGraceMinutes: number;
  earlyLeaveGraceMinutes: number;
  overtimeThresholdMinutes: number;
};

export type WorkShift = {
  id: string;      
  shift: string;   
  description?: string;
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
