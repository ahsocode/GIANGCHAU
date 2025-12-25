import type { DirectorSection } from "@/app/types";

export const ROLE_PERMISSIONS_STORAGE_KEY = "roleAllowedSections";

// Mặc định quyền theo role (admin/director luôn full)
export const DEFAULT_ROLE_SECTIONS: Record<string, DirectorSection[]> = {
  ADMIN: [],
  DIRECTOR: [],
  MANAGER: [],
  ACCOUNTANT: [],
  SUPERVISOR: [],
  EMPLOYEE: [],
};

function isBrowser() {
  return typeof window !== "undefined";
}

function parseStoredConfig(): Record<string, DirectorSection[]> {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(ROLE_PERMISSIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // ignore
  }
  return {};
}

export function loadRolePermissions(): Record<string, DirectorSection[]> {
  return parseStoredConfig();
}

export function saveRolePermissions(cfg: Record<string, DirectorSection[]>): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(ROLE_PERMISSIONS_STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // ignore persistence errors
  }
}

// Giữ key hợp lệ và loại bỏ quyền bị khóa
export function sanitizeRoleSections(
  roleKey: string,
  sections: DirectorSection[],
  allKeys: DirectorSection[]
): DirectorSection[] {
  const upper = roleKey.toUpperCase();
  if (upper === "ADMIN" || upper === "DIRECTOR") return allKeys;
  const allowSet = new Set(allKeys);
  return sections.filter((s) => allowSet.has(s));
}
