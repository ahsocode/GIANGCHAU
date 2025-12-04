// component/director/DirectorLayout.tsx
"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { DirectorSection } from "@/app/director/types";

type Props = {
  accountName: string;
  section: DirectorSection;
  onNavigate: (s: DirectorSection) => void;
  onLogout: () => void;
  children: ReactNode;
};

const MENU: { key: DirectorSection; label: string }[] = [
  { key: "overview", label: "Tổng quan" },
  { key: "employees", label: "Quản lý nhân viên" },
  { key: "attendance", label: "Quản lý chấm công" },
  { key: "shifts", label: "Quản lý ca làm" },
];

export function DirectorLayout(props: Props) {
  const { accountName, section, onNavigate, onLogout, children } = props;
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

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(formatNow());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-200">
          <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
            Thủy Sản
          </div>
          <div className="text-sm font-bold text-slate-900">
            Giang Châu – Admin
          </div>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1 text-sm">
          {MENU.map((item) => (
            <SidebarItem
              key={item.key}
              label={item.label}
              active={section === item.key}
              onClick={() => onNavigate(item.key)}
            />
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-slate-200 text-xs text-slate-500">
          <div className="font-medium text-slate-700 truncate">
            {accountName}
          </div>
          <button
            onClick={onLogout}
            className="mt-1 text-xs text-red-500 hover:underline"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col">
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold">
              Thủy Sản Giang Châu – Director Dashboard
            </h1>
            <p className="text-xs text-slate-500">
              Hệ thống chấm công &amp; quản lý nhân sự nội bộ
            </p>
          </div>
          <div className="text-xs text-slate-500 text-right">
            <div>
              Vai trò:{" "}
              <span className="font-medium text-slate-700">Director</span>
            </div>
            <div
              className="text-[11px] text-slate-600"
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
}) {
  const { label, active, onClick } = props;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md transition text-sm ${
        active
          ? "bg-blue-600 text-white font-medium"
          : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}
