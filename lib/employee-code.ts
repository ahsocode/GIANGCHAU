// Helper to generate employee code: GC + short role + YY + MM + sequence (3 digits)
type Params = {
  shortRole: string; // ví dụ: "GD"
  startDate?: string | null; // ngày vào làm, yyyy-MM-dd
  existingCodes?: string[]; // danh sách mã đã tồn tại để xác định stt trong tháng
};

function normalizeShortRole(value: string) {
  return (value || "").replace(/\s+/g, "").toUpperCase();
}

function parseDate(input?: string | null): Date {
  if (!input) return new Date();
  const parts = input.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts.map((p) => parseInt(p, 10));
    if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
      return new Date(y, m - 1, d);
    }
  }
  return new Date();
}

function nextSequence(prefix: string, existingCodes: string[] = []): string {
  const re = new RegExp(`^${prefix}(\\d{3})$`, "i");
  const max = existingCodes.reduce((cur, code) => {
    const m = code.match(re);
    if (!m) return cur;
    const seq = parseInt(m[1], 10);
    return Number.isNaN(seq) ? cur : Math.max(cur, seq);
  }, 0);

  const next = Math.min(max + 1, 999);
  return String(next).padStart(3, "0");
}

export function generateEmployeeCode(params: Params): string {
  const { shortRole, startDate, existingCodes } = params;
  const normalizedRole = normalizeShortRole(shortRole);
  const date = parseDate(startDate);
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const prefix = `GC${normalizedRole}${yy}${mm}`;
  const seq = nextSequence(prefix, existingCodes);
  return `${prefix}${seq}`;
}

export type GenerateEmployeeCodeParams = Params;
