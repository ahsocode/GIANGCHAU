// component/layout/AppLayout.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { DirectorSection } from "@/app/types";

type Props = {
  accountName: string;
  section: DirectorSection;
  roleKey?: string;
  menuItems?: { key: DirectorSection; label: string; group?: string | null }[];
  onNavigate: (s: DirectorSection) => void;
  onLogout: () => void;
  children: ReactNode;
};

type MenuItem = { key: DirectorSection; label: string; group?: string | null };

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
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("sidebarOpen");
    if (stored === "false") return false;
    if (stored === "true") return true;
    return true;
  });

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
        const rawGroup = (it.group ?? "").toString().trim().toLowerCase();
        if (rawGroup) return { ...it, group: rawGroup };
        if (attendanceKeyBase.has(it.key)) return { ...it, group: "attendance" };
        if (employeeKeyBase.has(it.key)) return { ...it, group: "employees" };
        if (roleKeyBase.has(it.key)) return { ...it, group: "roles" };
        if (shiftKeyBase.has(it.key)) return { ...it, group: "shift" };
        return it;
      });
  }, [menuItems, attendanceKeyBase, employeeKeyBase, roleKeyBase, shiftKeyBase]);

  // ---------- Open states (base) ----------
  const [employeeMenuOpenBase, setEmployeeMenuOpenBase] = useState(false);
  const [attendanceMenuOpenBase, setAttendanceMenuOpenBase] = useState(false);
  const [roleMenuOpenBase, setRoleMenuOpenBase] = useState(false);
  const [shiftMenuOpenBase, setShiftMenuOpenBase] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(formatNow()), 1000);
    return () => clearInterval(timer);
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

  const employeeMenuOpen = employeeMenuOpenBase || isEmployeeSection;
  const attendanceMenuOpen = attendanceMenuOpenBase || isAttendanceSection;
  const roleMenuOpen = roleMenuOpenBase || isRoleSection;
  const shiftMenuOpen = shiftMenuOpenBase || isShiftSection;

  const ATTENDANCE_GROUP_LABEL = "Cụm chấm công";

  const handleNavigateItem = (key: DirectorSection) => {
    if (!attendanceKeys.has(key)) setAttendanceMenuOpenBase(false);
    if (!employeeKeys.has(key)) setEmployeeMenuOpenBase(false);
    if (!roleKeys.has(key)) setRoleMenuOpenBase(false);
    if (!shiftKeys.has(key)) setShiftMenuOpenBase(false);
    onNavigate(key);
  };

  const seenGroups = new Set<string>();

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
        className={`fixed top-5 left-4 z-50 h-9 w-9 rounded-lg bg-white text-blue-600 shadow-lg flex items-center justify-center transition-all duration-300 hover:shadow-xl hover:bg-blue-50 border border-slate-200 ${
          sidebarOpen ? "ml-64" : "ml-0"
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
          sidebarOpen ? "w-72 translate-x-0" : "w-72 -translate-x-full"
        }`}
        aria-hidden={!sidebarOpen}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-200 bg-linear-to-br from-blue-50 to-indigo-50">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-linear-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
                <span className="text-xl font-bold text-white">TS</span>
              </div>
              <div>
                <div className="text-xs font-bold text-blue-600 uppercase tracking-wide">Thủy Sản</div>
                <div className="text-sm font-bold text-slate-800">Giang Châu</div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-5 space-y-1.5 text-sm overflow-y-auto">
            {items.map((item, idx) => {
              const group = (item.group || "").toString().trim().toLowerCase();
              const meta = groupMeta[group];

              // Render "group header" 1 lần cho mỗi group
              if (meta && !seenGroups.has(group)) {
                seenGroups.add(group);
                const groupedItems = items.filter((i) => (i.group || "").toString().trim().toLowerCase() === group);
                const isGroupActive = groupedItems.some((gi) => gi.key === section);
                const toggle = () => meta.setOpen((v) => !v);
                const isOpen = meta.isOpen;

                return (
                  <div key={`group-${group}`} className="pt-1">
                    <button
                      onClick={toggle}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isGroupActive ? "bg-blue-600 text-white shadow-md" : "text-slate-700 hover:bg-slate-100"
                      }`}
                      aria-expanded={isOpen}
                      aria-controls={`${group}-nav`}
                    >
                      <div className="flex items-center gap-2.5">
                        {meta.icon}
                        <span>{meta.label}</span>
                      </div>
                      <svg
                        className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    <div
                      id={`${group}-nav`}
                      className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-80 mt-1.5" : "max-h-0"}`}
                    >
                      <div className="space-y-1 pl-3 border-l-2 border-blue-200 ml-5">
                        {groupedItems.map((child) => (
                          <SidebarItem
                            key={child.key}
                            label={child.label}
                            active={section === child.key}
                            onClick={() => handleNavigateItem(child.key)}
                            isSubItem
                          />
                        ))}
                      </div>
                    </div>
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
                    onToggle={() => setAttendanceMenuOpenBase((v: boolean) => !v)}
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
                  />
                );
              }

              if (isEmployee) {
                return (
                  <GroupBlock
                    key="employee-group"
                    label="Quản lý nhân viên"
                    isOpen={employeeMenuOpen}
                    onToggle={() => setEmployeeMenuOpenBase((v: boolean) => !v)}
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
                  />
                );
              }

              if (isRole) {
                return (
                  <GroupBlock
                    key="role-group"
                    label="Quản lý chức vụ"
                    isOpen={roleMenuOpen}
                    onToggle={() => setRoleMenuOpenBase((v: boolean) => !v)}
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
                  />
                );
              }

              if (isShift) {
                return (
                  <GroupBlock
                    key="shift-group"
                    label="Quản lý ca làm"
                    isOpen={shiftMenuOpen}
                    onToggle={() => setShiftMenuOpenBase((v: boolean) => !v)}
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
                  />
                );
              }

              return (
                <SidebarItem
                  key={item.key}
                  label={item.label}
                  active={section === item.key}
                  onClick={() => handleNavigateItem(item.key)}
                />
              );
            })}
          </nav>

          {/* User Section */}
          <div className="px-4 py-4 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-md text-sm">
                {accountName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800 text-sm truncate">{accountName}</div>
                <div className="text-xs text-slate-500">{roleKey || "N/A"}</div>
              </div>
            </div>

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
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${sidebarOpen ? "ml-72" : "ml-0"}`}>
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
}) {
  const { label, active, onClick, isSubItem = false } = props;

  if (isSubItem) {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200 text-sm ${
          active ? "bg-blue-600 text-white font-medium shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        <span className="flex items-center gap-2">
          <span className="text-xs">•</span>
          <span>{label}</span>
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
        active ? "bg-blue-600 text-white shadow-md" : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {label}
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
}) {
  const { label, isOpen, onToggle, isActive, controlId, icon, items, section, onNavigate } = props;

  return (
    <div className="pt-1">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
          isActive ? "bg-blue-600 text-white shadow-md" : "text-slate-700 hover:bg-slate-100"
        }`}
        aria-expanded={isOpen}
        aria-controls={controlId}
      >
        <div className="flex items-center gap-2.5">
          {icon}
          <span>{label}</span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div id={controlId} className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-80 mt-1.5" : "max-h-0"}`}>
        <div className="space-y-1 pl-3 border-l-2 border-blue-200 ml-5">
          {items.map((child) => (
            <SidebarItem
              key={child.key}
              label={child.label}
              active={section === child.key}
              onClick={() => onNavigate(child.key)}
              isSubItem
            />
          ))}
        </div>
      </div>
    </div>
  );
}
