"use client";

import { AppShell } from "@/component/layout/AppShell";

function ComingSoonCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-2">
      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
        Chỉnh sửa chấm công
      </p>
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-600">{description}</p>
      <div className="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg p-3">
        Đang cập nhật giao diện điều chỉnh chấm công.
      </div>
    </div>
  );
}

export default function AttendanceEditPage() {
  return (
    <AppShell
      activeSection="attendanceEdit"
      render={() => (
        <ComingSoonCard
          title="Chỉnh sửa chấm công"
          description="Thao tác duyệt và cập nhật bản ghi chấm công sẽ hiển thị tại đây."
        />
      )}
    />
  );
}
