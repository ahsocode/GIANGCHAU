// component/layout/AppShell.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AttendanceRecord, Employee } from "@/lib/hr-types";
import type {
  DirectorSection,
  OverviewStats,
  WorkConfig,
  WorkConfigRecord,
} from "@/app/types";
import {
  DEFAULT_ROLE_SECTIONS,
  loadRolePermissions,
  sanitizeRoleSections,
  ROLE_PERMISSIONS_STORAGE_KEY,
} from "@/lib/role-permissions";
import {
  fetchAttendanceFromSupabase,
  fetchEmployeesFromSupabase,
  fetchWorkConfigsFromSupabase,
  updateWorkConfigInSupabase,
} from "@/lib/supabase/hr";
import { getSupabaseClient, isSupabaseEnabled } from "@/lib/supabase/client";
import { AppLayout } from "./AppLayout";

type WorkShift = {
  id: string; // "1"
  label: string; // "Ca 1"
  shift: number;
};

type NavItem = { key: DirectorSection; label: string; path: string };

const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "Tổng quan", path: "tong-quan" },
  { key: "departments", label: "Quản lý bộ phận", path: "quan-ly-bo-phan" },
  {
    key: "employeesOverview",
    label: "Tổng quan nhân viên",
    path: "quan-ly-nhan-vien/tong-quan-nhan-vien",
  },
  {
    key: "employees",
    label: "Danh sách nhân viên",
    path: "quan-ly-nhan-vien/danh-sach-nhan-vien",
  },
  {
    key: "employeeInfo",
    label: "Thông tin nhân viên",
    path: "quan-ly-nhan-vien/thong-tin-nhan-vien",
  },
  {
    key: "employeeAccounts",
    label: "Quản lý tài khoản",
path: "quan-ly-nhan-vien/quan-ly-tai-khoan",
  },
  { key: "attendance", label: "Quản lý chấm công", path: "quan-ly-cham-cong" },
  { key: "shiftOverview", label: "Tổng quan ca làm", path: "quan-ly-ca-lam/tong-quan-ca-lam" },
  { key: "shifts", label: "Ca làm", path: "quan-ly-ca-lam/ca-lam" },
  { key: "shiftAssignment", label: "Phân ca", path: "quan-ly-ca-lam/phan-ca" },
  { key: "permissions", label: "Phân quyền", path: "quan-ly-chuc-vu/phan-quyen" },
  { key: "roles", label: "Chức vụ", path: "quan-ly-chuc-vu/chuc-vu" },
];

const ALL_KEYS = NAV_ITEMS.map((i) => i.key);

const ROLE_SECTIONS: Record<string, DirectorSection[]> = {
  ADMIN: ALL_KEYS,
  DIRECTOR: ALL_KEYS,
  ...DEFAULT_ROLE_SECTIONS,
};

function resolveSections(
  roleKey?: string,
  custom?: string[],
  overrides?: Record<string, DirectorSection[]>
): DirectorSection[] {
  const upper = (roleKey || "").toUpperCase();
  if (upper === "ADMIN" || upper === "DIRECTOR") return ALL_KEYS;

  const cleanedCustom = (custom || [])
    .map((k) => (k || "").toLowerCase())
    .filter(Boolean);
  if (cleanedCustom.length) {
    const set = new Set(cleanedCustom);
    const filtered = NAV_ITEMS.filter((n) => set.has(n.key.toLowerCase())).map((n) => n.key);
    if (filtered.length) return filtered;
  }

  const override = overrides?.[upper];
  if (override && override.length) {
    return sanitizeRoleSections(upper, override, ALL_KEYS);
  }

  const defaults = ROLE_SECTIONS[upper];
  if (defaults && defaults.length) return defaults;

  return [];
}

export type AppShellRenderProps = {
  overviewStats: OverviewStats;

  // Cấu hình giờ làm theo ca
  workConfig: WorkConfig | null;
  configDraft: WorkConfig;
  setConfigDraft: (cfg: WorkConfig) => void;
  handleSaveWorkConfig: () => void;
  savingConfig: boolean;
  configMessage: string | null;

  // Ca làm
  workShifts: WorkShift[];
  activeShiftId: string;
  setActiveShiftId: (id: string) => void;
  workConfigs: WorkConfigRecord[];

  // Nhân sự & chấm công
  employees: Employee[];
  attendance: AttendanceRecord[];
  employeeTab: "all" | "fulltime" | "temporary";
  setEmployeeTab: (tab: "all" | "fulltime" | "temporary") => void;
  filteredEmployees: Employee[];
};

export function AppShell(props: {
  activeSection: DirectorSection;
  render: (p: AppShellRenderProps) => ReactNode;
}) {
  const { activeSection, render } = props;
  const router = useRouter();
  const pathname = usePathname();

  const [accountName, setAccountName] = useState<string>("");
  const [roleKey, setRoleKey] = useState<string>("DIRECTOR");
  const [accountSections, setAccountSections] = useState<string[] | undefined>(undefined);
  const [roleOverrides, setRoleOverrides] = useState<Record<string, DirectorSection[]>>({});
  const [allowedSections, setAllowedSections] = useState<DirectorSection[]>([]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [employeeTab, setEmployeeTab] = useState<
    "all" | "fulltime" | "temporary"
  >("all");

  const [workConfigs, setWorkConfigs] = useState<WorkConfigRecord[]>([]);
  const [activeShiftId, setActiveShiftId] = useState<string>("1");

  const [workConfig, setWorkConfig] = useState<WorkConfig | null>(null);
  const [configDraft, setConfigDraft] = useState<WorkConfig>({
    standardCheckIn: "08:00",
    standardCheckOut: "17:00",
    lateGraceMinutes: 5,
    earlyLeaveGraceMinutes: 5,
    overtimeThresholdMinutes: 60,
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function applyWorkConfigs(cfgs: WorkConfigRecord[]) {
    setWorkConfigs(cfgs);
    if (!cfgs.length) return;

    const minShift = cfgs.reduce<number>(
      (min, c) => (c.shift < min ? c.shift : min),
      cfgs[0].shift
    );

  const defaultShiftId = String(minShift);
  setActiveShiftId(defaultShiftId);

    const activeCfg =
      cfgs.find((c) => String(c.shift) === defaultShiftId) || cfgs[0];
    const baseCfg: WorkConfig = {
      standardCheckIn: activeCfg.standardCheckIn,
      standardCheckOut: activeCfg.standardCheckOut,
      lateGraceMinutes: activeCfg.lateGraceMinutes,
      earlyLeaveGraceMinutes: activeCfg.earlyLeaveGraceMinutes,
      overtimeThresholdMinutes: activeCfg.overtimeThresholdMinutes,
    };
    setWorkConfig(baseCfg);
    setConfigDraft(baseCfg);
  }

  // Auth guard
  useEffect(() => {
    const raw =
      typeof window !== "undefined"
        ? localStorage.getItem("currentAccount")
        : null;

    if (!raw) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("currentAccount");
        localStorage.removeItem(ROLE_PERMISSIONS_STORAGE_KEY);
        localStorage.removeItem("sidebarOpen");
      }
      router.replace("/login");
      return;
    }

    try {
      const acc = JSON.parse(raw);
      setAccountName(acc.fullName || "Người dùng");
      const resolvedRole = acc.role || acc.roleKey || "DIRECTOR";
      setRoleKey(resolvedRole);

      const customSections: string[] | undefined =
        Array.isArray(acc.allowedSections) && acc.allowedSections.length
          ? acc.allowedSections
          : Array.isArray(acc.permissions)
          ? acc.permissions
          : undefined;
      setAccountSections(customSections);
      setAllowedSections(resolveSections(resolvedRole, customSections, roleOverrides));
    } catch {
      setAccountName("Người dùng");
      setRoleKey("DIRECTOR");
      setAccountSections(undefined);
      setAllowedSections(resolveSections("DIRECTOR", undefined, roleOverrides));
    }
  }, [router, roleOverrides]);

  useEffect(() => {
    async function loadRoleAccess() {
      try {
        const res = await fetch("/api/permissions/sections", { cache: "no-store" });
        if (!res.ok) throw new Error("Không tải được cấu hình phân quyền");
        const data = await res.json();
        if (data?.roleAccess) {
          setRoleOverrides(data.roleAccess);
          return;
        }
      } catch (err) {
        console.warn("Không tải được roleAccess từ API, dùng fallback localStorage.", err);
      }
      setRoleOverrides(loadRolePermissions());
    }

    loadRoleAccess();
  }, []);

  useEffect(() => {
    setAllowedSections(resolveSections(roleKey, accountSections, roleOverrides));
  }, [roleKey, accountSections, roleOverrides]);

  // Load data
  useEffect(() => {
    async function loadAll() {
      try {
        setError(null);

        if (!isSupabaseEnabled()) {
          throw new Error("Thiếu cấu hình Supabase (URL/ANON KEY)");
        }

        const supabase = getSupabaseClient();
        const [empList, attList, cfgs] = await Promise.all([
          fetchEmployeesFromSupabase(supabase),
          fetchAttendanceFromSupabase(supabase),
          fetchWorkConfigsFromSupabase(supabase),
        ]);

        const filteredEmp = empList.filter(
          (e) => (e.roleKey || "").toUpperCase() !== "ADMIN"
        );
        setEmployees(filteredEmp);
        setAttendance(attList);
        applyWorkConfigs(cfgs);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Không tải được dữ liệu";
        console.error(err);
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, []);

  // Khi đổi ca → sync workConfig + draft
  useEffect(() => {
    if (!workConfigs.length) return;
    const found = workConfigs.find(
      (c) => String(c.shift) === activeShiftId
    );
    if (!found) return;

    const cfg: WorkConfig = {
      standardCheckIn: found.standardCheckIn,
      standardCheckOut: found.standardCheckOut,
      lateGraceMinutes: found.lateGraceMinutes,
      earlyLeaveGraceMinutes: found.earlyLeaveGraceMinutes,
      overtimeThresholdMinutes: found.overtimeThresholdMinutes,
    };
    setWorkConfig(cfg);
    setConfigDraft(cfg);
  }, [activeShiftId, workConfigs]);

  const effectiveSections = useMemo(() => {
    const base = allowedSections.length ? [...allowedSections] : ALL_KEYS;
    if (!base.includes(activeSection)) base.push(activeSection);
    return base;
  }, [allowedSections, activeSection]);

  const menuItems = useMemo(() => {
    const allowSet = new Set(effectiveSections);
    return NAV_ITEMS.filter((n) => allowSet.has(n.key));
  }, [effectiveSections]);

  const workShifts: WorkShift[] = useMemo(
    () =>
      workConfigs.map((cfg) => ({
        id: String(cfg.shift),
        label: `Ca ${cfg.shift}`,
        shift: cfg.shift,
      })),
    [workConfigs]
  );

  const overviewStats: OverviewStats = useMemo(() => {
    const active = employees.filter(
      (e) =>
        e.workStatus === "ACTIVE" &&
        e.roleKey !== "DIRECTOR" &&
        e.roleKey !== "ADMIN"
    );

    let currentDate: string | null = null;
    if (attendance.length) {
      currentDate = attendance.reduce(
        (max, r) => (max === null || r.date > max ? r.date : max),
        null as string | null
      );
    }

    const recordsByCode = new Map<string, AttendanceRecord>();
    if (currentDate) {
      attendance.forEach((r) => {
        if (r.date === currentDate) recordsByCode.set(r.employeeCode, r);
      });
    }

    const stdIn = timeToMinutes(workConfig?.standardCheckIn);
    const lateGrace = workConfig?.lateGraceMinutes ?? 0;

    function classify(e: Employee): "present" | "late" | "absent" {
      const rec = recordsByCode.get(e.code);
      if (!rec) return "absent";
      const checkInM = timeToMinutes(rec.checkIn);
      if (checkInM == null || stdIn == null) return "present";
      if (checkInM > stdIn + lateGrace) return "late";
      return "present";
    }

    let workingTotal = 0,
      workingFullTime = 0,
      workingTemp = 0;
    let lateTotal = 0,
      lateFullTime = 0,
      lateTemp = 0;
    let ftPresent = 0,
      ftLate = 0,
      ftAbsent = 0;
    let tpPresent = 0,
      tpLate = 0,
      tpAbsent = 0;

    active.forEach((e) => {
      const status = classify(e);
      const isFT = e.employmentType === "FULL_TIME";

      const isWorking = status === "present" || status === "late";
      if (isWorking) {
        workingTotal++;
        if (isFT) workingFullTime++;
        else workingTemp++;
      }

      if (status === "late") {
        lateTotal++;
        if (isFT) lateFullTime++;
        else lateTemp++;
      }

      if (isFT) {
        if (status === "present") ftPresent++;
        else if (status === "late") ftLate++;
        else ftAbsent++;
      } else {
        if (status === "present") tpPresent++;
        else if (status === "late") tpLate++;
        else tpAbsent++;
      }
    });

    return {
      totalEmployees: employees.length,
      totalFullTime: employees.filter(
        (e) => e.employmentType === "FULL_TIME"
      ).length,
      totalTemp: employees.filter(
        (e) => e.employmentType === "TEMPORARY"
      ).length,
      workingTotal,
      workingFullTime,
      workingTemp,
      lateTotal,
      lateFullTime,
      lateTemp,
      fullTimePresent: ftPresent,
      fullTimeLate: ftLate,
      fullTimeAbsent: ftAbsent,
      tempPresent: tpPresent,
      tempLate: tpLate,
      tempAbsent: tpAbsent,
      currentDateLabel: currentDate ? formatVNDate(currentDate) : null,
    };
  }, [attendance, employees, workConfig]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (e.roleKey === "ADMIN") return false;
      if (employeeTab === "fulltime") return e.employmentType === "FULL_TIME";
      if (employeeTab === "temporary") return e.employmentType === "TEMPORARY";
      return true;
    });
  }, [employees, employeeTab]);

  async function handleSaveWorkConfig() {
    setConfigMessage(null);

    const target = workConfigs.find(
      (c) => String(c.shift) === activeShiftId
    );
    if (!target) {
      setConfigMessage("Không tìm thấy cấu hình cho ca đang chọn.");
      return;
    }

    const payload = {
      standardCheckIn: configDraft.standardCheckIn,
      standardCheckOut: configDraft.standardCheckOut,
      lateGraceMinutes: configDraft.lateGraceMinutes,
      earlyLeaveGraceMinutes: configDraft.earlyLeaveGraceMinutes,
      overtimeThresholdMinutes: configDraft.overtimeThresholdMinutes,
    };

    try {
      setSavingConfig(true);

      if (!isSupabaseEnabled()) {
        throw new Error("Thiếu cấu hình Supabase (URL/ANON KEY)");
      }

      const supabase = getSupabaseClient();
      const updated = await updateWorkConfigInSupabase(
        target.id,
        payload,
        supabase
      );

      setWorkConfigs((prev) =>
        prev.map((c) => (c.id === target.id ? updated : c))
      );

      const cfg: WorkConfig = {
        standardCheckIn: updated.standardCheckIn,
        standardCheckOut: updated.standardCheckOut,
        lateGraceMinutes: updated.lateGraceMinutes,
        earlyLeaveGraceMinutes: updated.earlyLeaveGraceMinutes,
        overtimeThresholdMinutes: updated.overtimeThresholdMinutes,
      };
      setWorkConfig(cfg);
      setConfigDraft(cfg);

      setConfigMessage(`Đã lưu cấu hình cho ca ${updated.shift}.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Không thể lưu cấu hình";
      setConfigMessage(message);
    } finally {
      setSavingConfig(false);
    }
  }

  const handleNavigate = (s: DirectorSection) => {
    const allowSet = new Set(effectiveSections);
    if (!allowSet.has(s)) return;
    const found = NAV_ITEMS.find((n) => n.key === s);
    const parts = pathname.split("/").filter(Boolean);
    const slug = parts[0] || "";
    const path = found ? `/${slug}/${found.path}` : `/${slug}/tong-quan`;
    router.push(path);
  };

  function handleLogout() {
    localStorage.removeItem("currentAccount");
    localStorage.removeItem(ROLE_PERMISSIONS_STORAGE_KEY);
    localStorage.removeItem("sidebarOpen");
    router.replace("/login");
  }

  return (
    <AppLayout
      accountName={accountName}
      section={activeSection}
      roleKey={roleKey}
      menuItems={menuItems}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    >
      {loading && <div>Đang tải dữ liệu...</div>}
      {error && (
        <div className="text-red-600 bg-red-50 border border-red-100 p-2 rounded text-sm">
          {error}
        </div>
      )}

      {!loading &&
        !error &&
        render({
          overviewStats,
          workConfig,
          configDraft,
          setConfigDraft,
          handleSaveWorkConfig,
          savingConfig,
          configMessage,
          workShifts,
          activeShiftId,
          setActiveShiftId,
          workConfigs,
          employees,
          attendance,
          employeeTab,
          setEmployeeTab,
          filteredEmployees,
        })}
    </AppLayout>
  );
}

// helpers
function timeToMinutes(time?: string | null): number | null {
  if (!time) return null;
  const [hh, mm] = time.split(":").map((v) => parseInt(v, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

function formatVNDate(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
