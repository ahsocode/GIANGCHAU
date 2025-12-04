// lib/hr-types.ts

export type EmploymentType = "FULL_TIME" | "TEMPORARY";
export type WorkStatus = "ACTIVE" | "INACTIVE";

export interface Employee {
  code: string;
  name: string;
  phone: string;
  email: string;
  cccd: string;
  bhxh: string;
  employmentType: EmploymentType;
  workStatus: WorkStatus;      // enum dùng cho thống kê
  workStatusLabel: string;     // nhãn hiển thị (đã dịch: "Đang làm" / "Đã nghỉ")
  startDate: string;           // vd "01/12/2025"
  department: string;
  shiftCode?: string | null;
  // Phòng ban / xưởng
}

export interface AttendanceRecord {
  employeeCode: string;
  date: string;       // yyyy-MM-dd
  checkIn?: string;   // "07:59"
  checkOut?: string;  // "17:05"
}
