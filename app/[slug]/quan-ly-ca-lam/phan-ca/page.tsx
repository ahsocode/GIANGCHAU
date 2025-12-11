"use client";

import { AppShell } from "@/component/layout/AppShell";

export default function ShiftAssignmentPage() {
  return (
    <AppShell
      activeSection="shiftAssignment"
      render={() => (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Phân ca</h2>
          <p className="text-sm text-slate-600 mt-2">
            Trang này sẽ cho phép phân ca cho nhân viên theo bộ phận. (Placeholder)
          </p>
        </div>
      )}
    />
  );
}
