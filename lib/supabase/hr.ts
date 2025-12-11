import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "./client";
import type { AttendanceRecord, Employee, EmploymentType, WorkStatus } from "../hr-types";
import type { WorkConfig, WorkConfigRecord } from "@/app/types";

function normalize(input?: string | null) {
  return (input || "").trim().toUpperCase();
}

function mapEmploymentType(raw?: string | null): EmploymentType {
  const v = normalize(raw);
  if (v === "TEMPORARY" || v === "SEASONAL") return "TEMPORARY";
  return "FULL_TIME";
}

function mapWorkStatus(raw?: string | null): WorkStatus {
  const v = normalize(raw);
  if (v === "INACTIVE" || v === "RETIRED") return "INACTIVE";
  return "ACTIVE";
}

function toWorkStatusLabel(status: WorkStatus): string {
  return status === "ACTIVE" ? "Đang làm" : "Đã nghỉ";
}

type Row = Record<string, unknown>;

const getString = (obj: Row, key: string) => {
  const v = obj[key];
  return typeof v === "string" ? v : "";
};

function mapEmployeeRow(row: Row): Employee {
  // Support both old employees table and new accounts + account_details shape
  const detail = (row.account_details as Row | undefined) || (row.detail as Row | undefined) || {};
  const workStatus = mapWorkStatus(
    getString(detail, "work_status") || getString(row, "work_status")
  );
  const employmentType = mapEmploymentType(
    getString(detail, "employment_type") || getString(row, "employment_type")
  );

  const roleKeyRaw =
    getString(row, "role_key") || getString(row, "role") || getString(detail, "role_key");
  const roleKey = roleKeyRaw ? roleKeyRaw.toUpperCase() : undefined;
  const roleTranslations: Record<string, string> = {
    DIRECTOR: "Giám đốc",
    ADMIN: "Quản trị",
    MANAGER: "Quản lý",
    ACCOUNTANT: "Kế toán",
    SUPERVISOR: "Giám sát",
    EMPLOYEE: "Nhân viên",
    TEMPORARY: "Nhân viên thời vụ",
  };
  const translatedRole = roleKey ? roleTranslations[roleKey] : undefined;
  const roleName =
    getString(row, "role_name") ||
    getString(detail, "position") ||
    getString(detail, "role_name") ||
    translatedRole ||
    undefined;

  return {
    // cố gắng luôn có mã duy nhất để render key
    code:
      getString(row, "employee_code") ||
      getString(row, "code") ||
      getString(row, "account_id") ||
      getString(row, "id") ||
      getString(row, "email") ||
      "",
    name: getString(row, "full_name") || getString(row, "name") || "",
    roleKey,
    roleName,
    phone: getString(row, "phone") || "",
    email: getString(row, "email") || "",
    cccd: getString(detail, "cccd") || getString(row, "cccd") || "",
    bhxh: getString(detail, "bhxh") || getString(row, "bhxh") || "",
    employmentType,
    workStatus,
    workStatusLabel: toWorkStatusLabel(workStatus),
    startDate: getString(detail, "start_date") || getString(row, "start_date") || "",
    department: getString(detail, "department") || getString(row, "department") || "",
    shiftCode:
      getString(detail, "shift_code") ||
      getString(row, "shift_code") ||
      null,
  };
}

function mapAttendanceRow(row: Row): AttendanceRecord {
  return {
    employeeCode: getString(row, "employee_code") || getString(row, "account_id"),
    date: getString(row, "date"),
    checkIn: getString(row, "check_in") || undefined,
    checkOut: getString(row, "check_out") || undefined,
  };
}

function mapWorkConfigRow(row: Row): WorkConfigRecord {
  return {
    id: String(getString(row, "id") || ""),
    shift: Number(row.shift ?? 1),
    name: getString(row, "name") || `Ca ${row.shift ?? ""}`,
    standardCheckIn: getString(row, "standard_check_in") || "08:00",
    standardCheckOut: getString(row, "standard_check_out") || "17:00",
    lateGraceMinutes: Number(row.late_grace_minutes ?? 5),
    earlyLeaveGraceMinutes: Number(row.early_leave_grace_minutes ?? 5),
    overtimeThresholdMinutes: Number(row.overtime_threshold_minutes ?? 60),
  };
}

export async function fetchEmployeesFromSupabase(
  client: SupabaseClient = getSupabaseClient()
): Promise<Employee[]> {
  // Try new accounts + account_details structure first
  const withDetail = await client
    .from("accounts")
    .select(
      "employee_code,full_name,phone,email,role,account_details(department,position,cccd,bhxh,employment_type,work_status,start_date,end_date,shift_code)"
    )
    .order("employee_code");

  if (!withDetail.error) {
    return (withDetail.data || []).map(mapEmployeeRow);
  }

  // Fallback: accounts without join (for environments chưa có account_details)
  const plainAccounts = await client
    .from("accounts")
    .select("employee_code,full_name,phone,email,role")
    .order("employee_code");

  if (!plainAccounts.error) {
    return (plainAccounts.data || []).map(mapEmployeeRow);
  }

  // Legacy fallback: old employees table (only nếu accounts không tồn tại)
  const legacy = await client
    .from("employees")
    .select(
      "code,name,role_key,role_name,phone,email,cccd,bhxh,employment_type,work_status,start_date,department,shift_code"
    )
    .order("code");

  if (legacy.error) {
    // bubble up the first error to indicate root cause
    throw new Error(withDetail.error?.message || plainAccounts.error?.message || legacy.error.message);
  }

  return (legacy.data || []).map(mapEmployeeRow);
}

export async function fetchAttendanceFromSupabase(
  client: SupabaseClient = getSupabaseClient()
): Promise<AttendanceRecord[]> {
  const { data, error } = await client
    .from("attendance_records")
    .select("account_id,date,check_in,check_out");

  if (error) {
    // fallback nếu cột account_id chưa có
    const legacy = await client
      .from("attendance_records")
      .select("employee_code,date,check_in,check_out");

    if (legacy.error) {
      throw new Error(legacy.error.message);
    }

    return (legacy.data || []).map(mapAttendanceRow);
  }

  return (data || []).map(mapAttendanceRow);
}

export async function fetchWorkConfigsFromSupabase(
  client: SupabaseClient = getSupabaseClient()
): Promise<WorkConfigRecord[]> {
  const { data, error } = await client
    .from("work_configs")
    .select(
      "id,shift,name,standard_check_in,standard_check_out,late_grace_minutes,early_leave_grace_minutes,overtime_threshold_minutes"
    )
    .order("shift");

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(mapWorkConfigRow);
}

export type WorkConfigUpdateInput = Pick<
  WorkConfig,
  | "standardCheckIn"
  | "standardCheckOut"
  | "lateGraceMinutes"
  | "earlyLeaveGraceMinutes"
  | "overtimeThresholdMinutes"
>;

export async function updateWorkConfigInSupabase(
  id: string,
  payload: WorkConfigUpdateInput,
  client: SupabaseClient = getSupabaseClient()
): Promise<WorkConfigRecord> {
  const { data, error } = await client
    .from("work_configs")
    .update({
      standard_check_in: payload.standardCheckIn,
      standard_check_out: payload.standardCheckOut,
      late_grace_minutes: payload.lateGraceMinutes,
      early_leave_grace_minutes: payload.earlyLeaveGraceMinutes,
      overtime_threshold_minutes: payload.overtimeThresholdMinutes,
    })
    .eq("id", id)
    .select(
      "id,shift,standard_check_in,standard_check_out,late_grace_minutes,early_leave_grace_minutes,overtime_threshold_minutes"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapWorkConfigRow(data);
}
