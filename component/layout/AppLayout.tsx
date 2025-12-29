// component/layout/AppLayout.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { DirectorSection } from "@/app/types";

type Props = {
  accountName: string;
  section: DirectorSection;
  roleKey?: string;
  menuItems?: { key: DirectorSection; label: string; group?: string | null; path?: string }[];
  onNavigate: (s: DirectorSection) => void;
  onLogout: () => void;
  children: ReactNode;
};

type MenuItem = { key: DirectorSection; label: string; group?: string | null; path?: string };

const DEFAULT_MENU: MenuItem[] = [
  { key: "overview", label: "Tổng quan" },
  { key: "departments", label: "Quản lý bộ phận" },
  { key: "employeesOverview", label: "Tổng quan nhân viên", group: "employees" },
  { key: "employees", label: "Danh sách nhân viên", group: "employees" },
  { key: "attendanceOverview", label: "Tổng quan chấm công", group: "attendance" },
  { key: "attendanceDailyReport", label: "Báo cáo chấm công theo ngày", group: "attendance" },
  { key: "attendanceWeeklyReport", label: "Báo cáo chấm công theo tuần", group: "attendance" },
  { key: "attendanceMonthlyReport", label: "Báo cáo chấm công theo tháng", group: "attendance" },
  { key: "attendanceEdit", label: "Chỉnh sửa chấm công", group: "attendance" },
  { key: "shifts", label: "Quản lý ca làm", group: "shift" },
];

const GROUP_STORAGE_KEY = "sidebarGroupOpen";

export function AppLayout(props: Props) {
  const { accountName, section, roleKey, menuItems, onNavigate, onLogout, children } = props;

  const formatNow = () => {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const weekdays = ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"];
    return `${weekdays[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(
      d.getSeconds()
    )} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  const [now, setNow] = useState<string>("");
  // Keep initial render deterministic for SSR; hydrate actual preference on mount.
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  // ---------- Keys sets ----------
  const attendanceKeyBase = useMemo(
    () =>
      new Set<DirectorSection>([
        "attendanceOverview",
        "attendanceDailyReport",
        "attendanceWeeklyReport",
        "attendanceMonthlyReport",
        "attendanceEdit",
      ]),
    []
  );

  const employeeKeyBase = useMemo(
    () =>
      new Set<DirectorSection>([
        "employeesOverview",
        "employees",
        "employeeInfo",
        "employeeAccounts",
      ]),
    []
  );

  const roleKeyBase = useMemo(() => new Set<DirectorSection>(["roles", "permissions"]), []);
  const shiftKeyBase = useMemo(
    () => new Set<DirectorSection>(["shiftOverview", "shifts", "shiftAssignment"]),
    []
  );

  // ---------- Normalize items ----------
  const items: MenuItem[] = useMemo(() => {
    const normalizeText = (value: unknown) => {
      if (value == null) return "";
      return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
    };

    const detectCanonicalGroup = (value: unknown) => {
      const normalized = normalizeText(value);
      if (!normalized) return null;
      if (normalized.includes("attendance") || normalized.includes("cham-cong") || normalized.includes("cham cong")) {
        return "attendance";
      }
      if (
        normalized.includes("employee") ||
        normalized.includes("nhan-vien") ||
        normalized.includes("nhan vien") ||
        normalized.includes("nhan-su") ||
        normalized.includes("nhan su")
      ) {
        return "employees";
      }
      if (
        normalized.includes("role") ||
        normalized.includes("permission") ||
        normalized.includes("chuc-vu") ||
        normalized.includes("chuc vu") ||
        normalized.includes("he-thong") ||
        normalized.includes("he thong")
      ) {
        return "roles";
      }
      if (
        normalized.includes("shift") ||
        normalized.includes("ca-lam") ||
        normalized.includes("ca lam") ||
        normalized.includes("phan-ca") ||
        normalized.includes("phan ca")
      ) {
        return "shift";
      }
      return null;
    };

    const base = menuItems && menuItems.length > 0 ? menuItems : DEFAULT_MENU;
    const seen = new Set<string>();
    return base
      .filter((it) => {
        const key = String(it.key || "").toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((it) => {
        const primaryPathSegment = typeof it.path === "string" ? it.path.split("/")[0] : "";
        const canonicalGroup =
          detectCanonicalGroup(it.key) ||
          (attendanceKeyBase.has(it.key) ? "attendance" : null) ||
          (employeeKeyBase.has(it.key) ? "employees" : null) ||
          (roleKeyBase.has(it.key) ? "roles" : null) ||
          (shiftKeyBase.has(it.key) ? "shift" : null) ||
          detectCanonicalGroup(primaryPathSegment) ||
          detectCanonicalGroup(it.group);

        return canonicalGroup ? { ...it, group: canonicalGroup } : it;
      });
  }, [menuItems, attendanceKeyBase, employeeKeyBase, roleKeyBase, shiftKeyBase]);

  useEffect(() => {
    const timer = setInterval(() => setNow(formatNow()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("sidebarOpen");
    const frame = requestAnimationFrame(() => {
      if (stored === "false") setSidebarOpen(false);
      else if (stored === "true") setSidebarOpen(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("sidebarOpen", sidebarOpen ? "true" : "false");
  }, [sidebarOpen]);

  // ---------- Build key sets from items too (không phụ thuộc hardcode) ----------
  const attendanceKeys = useMemo(() => {
    const set = new Set<DirectorSection>([...attendanceKeyBase]);
    items.filter((i) => (i.group || "").toString().trim().toLowerCase() === "attendance")
      .forEach((i) => set.add(i.key));
    return set;
  }, [items, attendanceKeyBase]);

  const employeeKeys = useMemo(() => {
    const set = new Set<DirectorSection>([...employeeKeyBase]);
    items.filter((i) => (i.group || "").toString().trim().toLowerCase() === "employees")
      .forEach((i) => set.add(i.key));
    return set;
  }, [items, employeeKeyBase]);

  const roleKeys = useMemo(() => {
    const set = new Set<DirectorSection>([...roleKeyBase]);
    items.filter((i) => (i.group || "").toString().trim().toLowerCase() === "roles")
      .forEach((i) => set.add(i.key));
    return set;
  }, [items, roleKeyBase]);

  const shiftKeys = useMemo(() => {
    const set = new Set<DirectorSection>([...shiftKeyBase]);
    items.filter((i) => (i.group || "").toString().trim().toLowerCase() === "shift")
      .forEach((i) => set.add(i.key));
    return set;
  }, [items, shiftKeyBase]);

  const attendanceItems = items.filter((i) => attendanceKeys.has(i.key));
  const firstAttendanceIndex = items.findIndex((i) => attendanceKeys.has(i.key));
  const isAttendanceSection = attendanceKeys.has(section);

  const employeeItems = items.filter((i) => employeeKeys.has(i.key));
  const firstEmployeeIndex = items.findIndex((i) => employeeKeys.has(i.key));
  const isEmployeeSection = employeeKeys.has(section);

  const roleItems = items.filter((i) => roleKeys.has(i.key));
  const firstRoleIndex = items.findIndex((i) => roleKeys.has(i.key));
  const isRoleSection = roleKeys.has(section);

  const shiftItems = items.filter((i) => shiftKeys.has(i.key));
  const firstShiftIndex = items.findIndex((i) => shiftKeys.has(i.key));
  const isShiftSection = shiftKeys.has(section);

  // ---------- Open states (base) ----------
  const readStoredGroups = () => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(GROUP_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as Record<string, boolean>;
    } catch {
      // ignore
    }
    return {};
  };

  const initialGroupState = readStoredGroups();

  const [employeeMenuOpenBase, setEmployeeMenuOpenBase] = useState<boolean>(
    initialGroupState.employees ?? isEmployeeSection
  );
  const [attendanceMenuOpenBase, setAttendanceMenuOpenBase] = useState<boolean>(
    initialGroupState.attendance ?? isAttendanceSection
  );
  const [roleMenuOpenBase, setRoleMenuOpenBase] = useState<boolean>(initialGroupState.roles ?? isRoleSection);
  const [shiftMenuOpenBase, setShiftMenuOpenBase] = useState<boolean>(initialGroupState.shift ?? isShiftSection);

  const employeeMenuOpen = employeeMenuOpenBase || isEmployeeSection;
  const attendanceMenuOpen = attendanceMenuOpenBase || isAttendanceSection;
  const roleMenuOpen = roleMenuOpenBase || isRoleSection;
  const shiftMenuOpen = shiftMenuOpenBase || isShiftSection;

  const ATTENDANCE_GROUP_LABEL = "Cụm chấm công";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload = {
      employees: employeeMenuOpenBase,
      attendance: attendanceMenuOpenBase,
      roles: roleMenuOpenBase,
      shift: shiftMenuOpenBase,
    };
    try {
      localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore persistence error
    }
  }, [employeeMenuOpenBase, attendanceMenuOpenBase, roleMenuOpenBase, shiftMenuOpenBase]);

  const setExclusiveOpen = (
    group: "employees" | "attendance" | "roles" | "shift",
    mode: "toggle" | "open" = "toggle"
  ) => {
    const handler = (current: boolean, target: typeof group) => {
      if (group !== target) return false;
      if (mode === "open") return true;
      return !current;
    };

    setEmployeeMenuOpenBase((v) => handler(v, "employees"));
    setAttendanceMenuOpenBase((v) => handler(v, "attendance"));
    setRoleMenuOpenBase((v) => handler(v, "roles"));
    setShiftMenuOpenBase((v) => handler(v, "shift"));
  };

  const handleNavigateItem = (key: DirectorSection) => {
    if (attendanceKeys.has(key)) setExclusiveOpen("attendance", "open");
    else if (employeeKeys.has(key)) setExclusiveOpen("employees", "open");
    else if (roleKeys.has(key)) setExclusiveOpen("roles", "open");
    else if (shiftKeys.has(key)) setExclusiveOpen("shift", "open");
    else {
      setAttendanceMenuOpenBase(false);
      setEmployeeMenuOpenBase(false);
      setRoleMenuOpenBase(false);
      setShiftMenuOpenBase(false);
    }
    onNavigate(key);
  };

  const seenGroups = new Set<string>();

  const iconMap: Record<string, ReactNode> = {
    overview: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9-9 9-9-9z" />
      </svg>
    ),
    departments: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19h16M4 11h16M4 5h16M8 11V5m8 6V5M8 19v-8m8 8v-8" />
      </svg>
    ),
    employees: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
    ),
    attendance: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V5m8 2V5m-9 8h6m-9 6h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    shift: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m5-3a8 8 0 11-16 0 8 8 0 0116 0z" />
      </svg>
    ),
    roles: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 11c0-1.105.895-2 2-2s2 .895 2 2-.895 2-2 2-.895-2-2-2zm-7 0c0-1.105.895-2 2-2s2 .895 2 2-.895 2-2 2-.895-2-2-2zm7 6c0-1.105.895-2 2-2s2 .895 2 2-.895 2-2 2-.895-2-2-2zm-7 0c0-1.105.895-2 2-2s2 .895 2 2-.895 2-2 2-.895-2-2-2z"
        />
      </svg>
    ),
  };

  const groupMeta: Record<
    string,
    { label: string; isOpen: boolean; setOpen: (v: boolean | ((p: boolean) => boolean)) => void; icon: ReactNode }
  > = {
    employees: {
      label: "Quản lý nhân viên",
      isOpen: employeeMenuOpen,
      setOpen: setEmployeeMenuOpenBase,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    attendance: {
      label: ATTENDANCE_GROUP_LABEL,
      isOpen: attendanceMenuOpen,
      setOpen: setAttendanceMenuOpenBase,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 7h14M5 17h14" />
        </svg>
      ),
    },
    roles: {
      label: "Quản lý chức vụ",
      isOpen: roleMenuOpen,
      setOpen: setRoleMenuOpenBase,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 11c0-1.105.895-2 2-2s2 .895 2 2-.895 2-2 2-.895-2-2-2zm-7 0c0-1.105.895-2 2-2s2 .895 2 2-.895 2-2 2-.895-2-2-2zm7 6c0-1.105.895-2 2-2s2 .895 2 2-.895 2-2 2-.895-2-2-2zm-7 0c0-1.105.895-2 2-2s2 .895 2 2-.895 2-2 2-.895-2-2-2z"
          />
        </svg>
      ),
    },
    shift: {
      label: "Quản lý ca làm",
      isOpen: shiftMenuOpen,
      setOpen: setShiftMenuOpenBase,
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8h18M3 16h18M7 4h2m6 0h2m-8 16h2m6 0h2" />
        </svg>
      ),
    },
  };

  return (
    <div className="min-h-screen flex bg-slate-50 relative">
      {/* Toggle Button */}
      <button
        onClick={() => setSidebarOpen((v) => !v)}
        className={`fixed top-5 left-3 z-50 h-9 w-9 rounded-lg bg-white text-blue-600 shadow-lg flex items-center justify-center transition-all duration-300 hover:shadow-xl hover:bg-blue-50 border border-slate-200 ${
          sidebarOpen ? "translate-x-60" : "translate-x-10"
        }`}
        aria-pressed={sidebarOpen}
        aria-label={sidebarOpen ? "Ẩn sidebar" : "Hiện sidebar"}
      >
        <svg
          className={`w-5 h-5 transition-transform duration-300 ${sidebarOpen ? "" : "rotate-180"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        className={`bg-white flex flex-col transition-all duration-300 ease-in-out shadow-lg border-r border-slate-200 fixed left-0 top-0 bottom-0 z-40 ${
          sidebarOpen ? "w-72" : "w-16"
        }`}
        aria-hidden={false}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div
            className={`border-b border-slate-200 bg-linear-to-br from-blue-50 to-indigo-50 ${
              sidebarOpen ? "px-6 py-5" : "px-3 py-4"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-linear-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
                <span className="text-xl font-bold text-white">TS</span>
              </div>
              {sidebarOpen && (
                <div>
                  <div className="text-xs font-bold text-blue-600 uppercase tracking-wide">Thủy Sản</div>
                  <div className="text-sm font-bold text-slate-800">Giang Châu</div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 ${sidebarOpen ? "px-4" : "px-2"} py-5 space-y-1.5 text-sm overflow-y-auto`}>
            {items.map((item, idx) => {
              const group = (item.group || "").toString().trim().toLowerCase();
              const meta = groupMeta[group];

              // Render "group header" 1 lần cho mỗi group
              if (meta && !seenGroups.has(group)) {
                seenGroups.add(group);
                const groupedItems = items.filter((i) => (i.group || "").toString().trim().toLowerCase() === group);
                const isGroupActive = groupedItems.some((gi) => gi.key === section);
                const toggle = () => {
                  if (!sidebarOpen) {
                    setSidebarOpen(true);
                    setExclusiveOpen(group as "employees" | "attendance" | "roles" | "shift", "open");
                    return;
                  }
                  setExclusiveOpen(group as "employees" | "attendance" | "roles" | "shift");
                };
                const isOpen = meta.isOpen;

                return (
                  <div key={`group-${group}`} className="pt-1">
                    <button
                      onClick={toggle}
                      className={`w-full flex items-center ${
                        sidebarOpen ? "justify-between px-4" : "justify-center px-2"
                      } py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isGroupActive ? "bg-blue-600 text-white shadow-md" : "text-slate-700 hover:bg-slate-100"
                      }`}
                      aria-expanded={isOpen}
                      aria-controls={`${group}-nav`}
                      title={meta.label}
                    >
                      <div className={`flex items-center ${sidebarOpen ? "gap-2.5" : "gap-0"}`}>
                        {meta.icon}
                        {sidebarOpen && <span>{meta.label}</span>}
                      </div>
                      {sidebarOpen && (
                        <svg
                          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>

                    {sidebarOpen && (
                      <div
                        id={`${group}-nav`}
                        className={`overflow-hidden transition-all duration-300 ${
                          isOpen ? "max-h-80 mt-1.5" : "max-h-0"
                        }`}
                      >
                        <div className="space-y-1 pl-3 border-l-2 border-blue-200 ml-5">
                          {groupedItems.map((child) => (
                            <SidebarItem
                              key={child.key}
                              label={child.label}
                              active={section === child.key}
                              onClick={() => handleNavigateItem(child.key)}
                              isSubItem
                              icon={iconMap[group] || iconMap.attendance}
                              collapsed={!sidebarOpen}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              // Nếu item thuộc group đã render header rồi thì skip item rời rạc
              const isAttendance = attendanceKeys.has(item.key);
              const isEmployee = employeeKeys.has(item.key);
              const isRole = roleKeys.has(item.key);
              const isShift = shiftKeys.has(item.key);

              const shouldSkipGroup =
                (isAttendance && idx !== firstAttendanceIndex) ||
                (isEmployee && idx !== firstEmployeeIndex) ||
                (isRole && idx !== firstRoleIndex) ||
                (isShift && idx !== firstShiftIndex);

              if (shouldSkipGroup) return null;

              // Fallback group block (an toàn) nếu vì lý do nào đó meta không chạy
              if (isAttendance) {
                return (
                  <GroupBlock
                    key="attendance-group"
                    label={ATTENDANCE_GROUP_LABEL}
                    isOpen={attendanceMenuOpen}
                    onToggle={() => {
                      if (!sidebarOpen) {
                        setSidebarOpen(true);
                        setExclusiveOpen("attendance", "open");
                      } else {
                        setExclusiveOpen("attendance");
                      }
                    }}
                    isActive={isAttendanceSection}
                    controlId="attendance-nav"
                    icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 7h14M5 17h14" />
                      </svg>
                    }
                    items={attendanceItems}
                    section={section}
                    onNavigate={handleNavigateItem}
                    collapsed={!sidebarOpen}
                    iconMap={iconMap}
                  />
                );
              }

              if (isEmployee) {
                return (
                  <GroupBlock
                    key="employee-group"
                    label="Quản lý nhân viên"
                    isOpen={employeeMenuOpen}
                    onToggle={() => {
                      if (!sidebarOpen) {
                        setSidebarOpen(true);
                        setExclusiveOpen("employees", "open");
                      } else {
                        setExclusiveOpen("employees");
                      }
                    }}
                    isActive={isEmployeeSection}
                    controlId="employee-nav"
                    icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                      </svg>
                    }
                    items={employeeItems}
                    section={section}
                    onNavigate={handleNavigateItem}
                    collapsed={!sidebarOpen}
                    iconMap={iconMap}
                  />
                );
              }

              if (isRole) {
                return (
                  <GroupBlock
                    key="role-group"
                    label="Quản lý chức vụ"
                    isOpen={roleMenuOpen}
                    onToggle={() => {
                      if (!sidebarOpen) {
                        setSidebarOpen(true);
                        setExclusiveOpen("roles", "open");
                      } else {
                        setExclusiveOpen("roles");
                      }
                    }}
                    isActive={isRoleSection}
                    controlId="role-nav"
                    icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 11c0-1.105.895-2 2-2s2 .895 2 2-.895 2-2 2-.895-2-2-2zm-7 0c0-1.105.895-2 2-2s2 .895 2 2-.895 2-2 2-.895-2-2-2zm7 6c0-1.105.895-2 2-2s2 .895 2 2-.895 2-2 2-.895-2-2-2zm-7 0c0-1.105.895-2 2-2s2 .895 2 2-.895 2-2 2-.895-2-2-2z"
                        />
                      </svg>
                    }
                    items={roleItems}
                    section={section}
                    onNavigate={handleNavigateItem}
                    collapsed={!sidebarOpen}
                    iconMap={iconMap}
                  />
                );
              }

              if (isShift) {
                return (
                  <GroupBlock
                    key="shift-group"
                    label="Quản lý ca làm"
                    isOpen={shiftMenuOpen}
                    onToggle={() => {
                      if (!sidebarOpen) {
                        setSidebarOpen(true);
                        setExclusiveOpen("shift", "open");
                      } else {
                        setExclusiveOpen("shift");
                      }
                    }}
                    isActive={isShiftSection}
                    controlId="shift-nav"
                    icon={
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8h18M3 16h18M7 4h2m6 0h2m-8 16h2m6 0h2" />
                      </svg>
                    }
                    items={shiftItems}
                    section={section}
                    onNavigate={handleNavigateItem}
                    collapsed={!sidebarOpen}
                    iconMap={iconMap}
                  />
                );
              }

              return (
                <SidebarItem
                  key={item.key}
                  label={item.label}
                  active={section === item.key}
                  onClick={() => handleNavigateItem(item.key)}
                  icon={iconMap[item.key] || iconMap.overview}
                  collapsed={!sidebarOpen}
                />
              );
            })}
          </nav>

          {/* User Section */}
          <div className="px-4 py-4 border-t border-slate-200 bg-slate-50">
            <div className={`flex items-center ${sidebarOpen ? "gap-3 mb-3" : "justify-center mb-2"}`}>
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-md text-sm">
                {accountName.charAt(0).toUpperCase()}
              </div>
              {sidebarOpen && (
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 text-sm truncate">{accountName}</div>
                  <div className="text-xs text-slate-500">{roleKey || "N/A"}</div>
                </div>
              )}
            </div>

            {sidebarOpen && (
              <button
                onClick={onLogout}
                className="w-full px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-all duration-200 flex items-center justify-center gap-2 border border-red-200"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Đăng xuất
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarOpen ? "ml-72" : "ml-16"}`}>
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4 shadow-sm">
          <div className={`transition-all duration-300 ml-12`}>
            <h1 className="text-lg font-bold text-slate-800">Quản trị nhân sự &amp; chấm công</h1>
            <p className="text-xs text-slate-500 mt-0.5">Hệ thống nội bộ Thủy Sản Giang Châu</p>
          </div>

          <div className="text-xs text-slate-600 text-right">
            <div className="font-medium mb-1">
              <span className="text-slate-500">Vai trò:</span>{" "}
              <span className="text-blue-600 font-semibold">{roleKey || "N/A"}</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono" suppressHydrationWarning>
              {now}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function SidebarItem(props: {
  label: string;
  active: boolean;
  onClick: () => void;
  isSubItem?: boolean;
  icon?: ReactNode;
  collapsed?: boolean;
}) {
  const { label, active, onClick, isSubItem = false, icon, collapsed = false } = props;

  if (isSubItem) {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
          active ? "bg-blue-600 text-white font-medium shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
        title={label}
      >
        <span className="flex items-center gap-2 min-w-0">
          {icon ? <span className="text-xs">{icon}</span> : <span className="text-xs">•</span>}
          {!collapsed && <span className="whitespace-normal wrap-break-word leading-5">{label}</span>}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full ${collapsed ? "justify-center px-0" : "justify-start px-4"} py-2.5 rounded-lg transition-all duration-200 text-sm font-medium flex items-center gap-2 ${
        active ? "bg-blue-600 text-white shadow-md" : "text-slate-700 hover:bg-slate-100"
      }`}
      title={label}
    >
      {icon && <span className="ml-1">{icon}</span>}
      {!collapsed && <span className="whitespace-normal wrap-break-word leading-5">{label}</span>}
    </button>
  );
}

function GroupBlock(props: {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  isActive: boolean;
  controlId: string;
  icon: ReactNode;
  items: { key: DirectorSection; label: string }[];
  section: DirectorSection;
  onNavigate: (s: DirectorSection) => void;
  collapsed?: boolean;
  iconMap: Record<string, ReactNode>;
}) {
  const { label, isOpen, onToggle, isActive, controlId, icon, items, section, onNavigate, collapsed = false, iconMap } = props;

  return (
    <div className="pt-1">
      <button
        onClick={onToggle}
        className={`w-full flex items-center ${collapsed ? "justify-center px-0" : "justify-between px-4"} py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          isActive ? "bg-blue-600 text-white shadow-md" : "text-slate-700 hover:bg-slate-100"
        }`}
        aria-expanded={isOpen}
        aria-controls={controlId}
        title={label}
      >
        <div className={`flex items-center ${collapsed ? "gap-0" : "gap-2.5"}`}>
          {icon}
          {!collapsed && <span>{label}</span>}
        </div>
        {!collapsed && (
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {!collapsed && (
        <div id={controlId} className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-80 mt-1.5" : "max-h-0"}`}>
          <div className="space-y-1 pl-3 border-l-2 border-blue-200 ml-5">
            {items.map((child) => (
              <SidebarItem
                key={child.key}
                label={child.label}
                active={section === child.key}
                onClick={() => onNavigate(child.key)}
                isSubItem
                icon={iconMap[child.key] || iconMap.overview}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
