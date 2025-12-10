// lib/hr-sheet.ts
import type {
  Employee,
  AttendanceRecord,
  EmploymentType,
  WorkStatus,
} from "./hr-types";

// Parser đơn giản
function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(","));
}

// ===== Helper bỏ dấu tiếng Việt để match tên cột =====

function normalizeVN(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function normalize(input: string) {
  return input.trim().toLowerCase();
}

// ===== Map từ giá trị tiếng Anh trên sheet -> enum =====
// H cột: Official / Seasonal
// I cột: Working / Retired

function mapEmploymentType(raw: string): EmploymentType {
  const v = normalize(raw);

  if (v === "official" || v === "full-time" || v === "fulltime") {
    return "FULL_TIME";
  }

  if (v === "seasonal" || v === "temporary") {
    return "TEMPORARY";
  }

  return "FULL_TIME";
}

function mapWorkStatus(raw: string): WorkStatus {
  const v = normalize(raw);

  if (v === "working" || v === "active") {
    return "ACTIVE";
  }

  if (v === "retired" || v === "inactive") {
    return "INACTIVE";
  }

  return "ACTIVE";
}

function mapWorkStatusLabel(raw: string): string {
  const status = mapWorkStatus(raw);
  return status === "ACTIVE" ? "Đang làm" : "Đã nghỉ";
}

// ===== Parse Danh sách nhân viên =====

export function parseEmployeesCsv(csv: string): Employee[] {
  const rows = parseCsv(csv);
  if (!rows.length) return [];

  const header = rows[0];
  const normalizedHeader = header.map((h) => normalizeVN(h));

  const findCol = (keywords: string[]) => {
    const normalizedKeywords = keywords.map((k) => normalizeVN(k));
    for (const key of normalizedKeywords) {
      const idx = normalizedHeader.findIndex((h) => h.includes(key));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idxCode = findCol(["mã nhân viên"]);
  const idxName = findCol(["họ và tên"]);
  const idxPhone = findCol(["sdt", "số điện thoại"]);
  const idxEmail = findCol(["gmail", "email"]);
  const idxCccd = findCol(["cccd"]);
  const idxBhxh = findCol(["bhxh"]);
  const idxRole = findCol(["chuc vu", "chức vụ", "role", "position"]);
  const idxEmpType = findCol(["trạng thái nhân viên", "employee type"]);
  const idxWorkStatus = findCol(["trạng thái đi làm", "work status"]);
  const idxStartDate = findCol(["ngày vào làm", "start date"]);
  const idxDept = findCol(["phòng ban", "xưởng", "department"]);
  const idxShift = findCol(["ca làm", "ca lam", "shift"]);

  return rows
    .slice(1)
    .filter((r) => r[idxCode])
    .map((r) => {
      const rawStatus = r[idxWorkStatus] || "";

      return {
        code: r[idxCode],
        name: r[idxName],
        roleName: idxRole !== -1 ? r[idxRole] : undefined,
        phone: r[idxPhone],
        email: r[idxEmail],
        cccd: r[idxCccd],
        bhxh: r[idxBhxh],
        employmentType: mapEmploymentType(r[idxEmpType] || ""),
        workStatus: mapWorkStatus(rawStatus),
        workStatusLabel: mapWorkStatusLabel(rawStatus),
        startDate: r[idxStartDate],
        department: r[idxDept],
        shiftCode: idxShift !== -1 ? r[idxShift] || null : null,
      };
    });
}

// ===== Parse chấm công tháng (1 dòng / nhân viên, nhiều cột ngày) =====

export function parseAttendanceCsv(csv: string): AttendanceRecord[] {
  const rows = parseCsv(csv);
  if (!rows.length) return [];

  const header = rows[0];

  const idxCode = header.findIndex((h) =>
    h.toLowerCase().includes("mã nhân viên")
  );
  const idxName = header.findIndex((h) =>
    h.toLowerCase().includes("họ và tên")
  );

  const dayColumns: { checkInCol: number; checkOutCol: number; date: string }[] =
    [];

  for (let col = idxName + 1; col < header.length; col += 2) {
    const labelIn = header[col]; // "Checkin 01/12/2025"
    if (!labelIn) continue;

    const match = labelIn.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) continue;
    const [, dd, mm, yyyy] = match;
    const isoDate = `${yyyy}-${mm}-${dd}`;

    dayColumns.push({
      checkInCol: col,
      checkOutCol: col + 1,
      date: isoDate,
    });
  }

  const records: AttendanceRecord[] = [];

  const isAbsentCell = (value: string | undefined) => {
    if (!value) return true;
    const v = normalizeVN(value);
    return v === "vang" || v === "vắng";
  };

  rows.slice(1).forEach((r) => {
    const code = r[idxCode];
    if (!code) return;

    dayColumns.forEach((day) => {
      const rawIn = r[day.checkInCol];
      const rawOut = r[day.checkOutCol];

      const checkIn = isAbsentCell(rawIn) ? "" : rawIn;
      const checkOut = isAbsentCell(rawOut) ? "" : rawOut;

      if (!checkIn && !checkOut) return;

      records.push({
        employeeCode: code,
        date: day.date,
        checkIn: checkIn || undefined,
        checkOut: checkOut || undefined,
      });
    });
  });

  return records;
}
