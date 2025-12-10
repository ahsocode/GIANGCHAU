// component/layout/AppLayout.tsx
"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { DirectorSection } from "@/app/types";

type Props = {
  accountName: string;
  section: DirectorSection;
  roleKey?: string;
  menuItems?: { key: DirectorSection; label: string }[];
  onNavigate: (s: DirectorSection) => void;
  onLogout: () => void;
  children: ReactNode;
};

export function AppLayout(props: Props) {
  const {
    accountName,
    section,
    roleKey,
    menuItems,
    onNavigate,
    onLogout,
    children,
  } = props;
  const defaultMenu: { key: DirectorSection; label: string }[] = [
    { key: "overview", label: "Tổng quan" },
    { key: "departments", label: "Quản lý bộ phận" },
    { key: "employeesOverview", label: "Tổng quan nhân viên" },
    { key: "employees", label: "Danh sách nhân viên" },
    { key: "attendance", label: "Quản lý chấm công" },
    { key: "shifts", label: "Quản lý ca làm" },
  ];
  const items = menuItems && menuItems.length ? menuItems : defaultMenu;
  const formatNow = () => {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const weekdays = ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"];
    return `${weekdays[d.getDay()]} ${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}:${pad(d.getSeconds())} ${pad(d.getDate())}/${pad(
      d.getMonth() + 1
    )}/${d.getFullYear()}`;
  };

  const [now, setNow] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [employeeMenuOpen, setEmployeeMenuOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(formatNow());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const employeeKeys = new Set<DirectorSection>([
    "employeesOverview",
    "employees",
  ]);
  const employeeItems = items.filter((i) => employeeKeys.has(i.key));
  const firstEmployeeIndex = items.findIndex((i) => employeeKeys.has(i.key));
  const isEmployeeSection =
    section === "employees" || section === "employeesOverview";

  useEffect(() => {
    setEmployeeMenuOpen(isEmployeeSection);
  }, [isEmployeeSection]);

  const handleNavigateItem = (key: DirectorSection) => {
    if (!employeeKeys.has(key)) setEmployeeMenuOpen(false);
    onNavigate(key);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 relative">
      {/* Toggle Button - Luôn hiển thị, không phụ thuộc sidebar */}
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
                <div className="text-xs font-bold text-blue-600 uppercase tracking-wide">
                  Thủy Sản
                </div>
                <div className="text-sm font-bold text-slate-800">
                  Giang Châu
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-5 space-y-1.5 text-sm overflow-y-auto">
            {items.map((item, idx) => {
              const isEmployee = employeeKeys.has(item.key);
              if (!isEmployee) {
                return (
                  <SidebarItem
                    key={item.key}
                    label={item.label}
                    active={section === item.key}
                    onClick={() => handleNavigateItem(item.key)}
                  />
                );
              }

              if (idx !== firstEmployeeIndex) return null;

              return (
                <div key="employee-group" className="pt-1">
                  <button
                    onClick={() => setEmployeeMenuOpen((v) => !v)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isEmployeeSection
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                    aria-expanded={employeeMenuOpen}
                    aria-controls="employee-nav"
                  >
                    <div className="flex items-center gap-2.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>Quản lý nhân viên</span>
                    </div>
                    <svg
                      className={`w-4 h-4 transition-transform duration-200 ${
                        employeeMenuOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <div
                    id="employee-nav"
                    className={`overflow-hidden transition-all duration-300 ${
                      employeeMenuOpen ? "max-h-40 mt-1.5" : "max-h-0"
                    }`}
                  >
                    <div className="space-y-1 pl-3 border-l-2 border-blue-200 ml-5">
                      {employeeItems.map((child) => (
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
            })}
          </nav>

          {/* User Section */}
          <div className="px-4 py-4 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-md text-sm">
                {accountName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-slate-800 text-sm truncate">
                  {accountName}
                </div>
                <div className="text-xs text-slate-500">
                  {roleKey || "N/A"}
                </div>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-all duration-200 flex items-center justify-center gap-2 border border-red-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content - Thêm margin-left khi sidebar mở */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
        sidebarOpen ? "ml-72" : "ml-0"
      }`}>
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4 shadow-sm">
          <div className={`transition-all duration-300 ${sidebarOpen ? "ml-12" : "ml-12"}`}>
            <h1 className="text-lg font-bold text-slate-800">
              Quản trị nhân sự &amp; chấm công
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Hệ thống nội bộ Thủy Sản Giang Châu
            </p>
          </div>
          <div className="text-xs text-slate-600 text-right">
            <div className="font-medium mb-1">
              <span className="text-slate-500">Vai trò:</span>{" "}
              <span className="text-blue-600 font-semibold">{roleKey || "N/A"}</span>
            </div>
            <div
              className="text-[11px] text-slate-500 font-mono"
              suppressHydrationWarning
            >
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
          active
            ? "bg-blue-600 text-white font-medium shadow-sm"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
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
        active
          ? "bg-blue-600 text-white shadow-md"
          : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}
