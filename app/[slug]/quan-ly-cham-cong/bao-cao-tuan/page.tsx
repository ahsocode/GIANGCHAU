"use client";

import { AppShell } from "@/component/layout/AppShell";

function ComingSoonCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-2">
      <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
        Báo cáo chấm công
      </p>
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-600">{description}</p>
      <div className="text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-lg p-3">
        Đang cập nhật nội dung chi tiết. Vui lòng quay lại sau.
      </div>
    </div>
  );
}

export default function AttendanceWeeklyReportPage() {
  return (
    <AppShell
      activeSection="attendanceWeeklyReport"
      render={() => (
        <ComingSoonCard
          title="Báo cáo chấm công theo tuần"
          description="Tổng hợp xu hướng đi làm, đi trễ và vắng mặt theo từng tuần."
        />
      )}
    />
  );
}
