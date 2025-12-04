"use client";

import { useMemo, useState } from "react";
import type { AttendanceRecord, Employee } from "@/lib/hr-types";
import { DirectorShell } from "@/component/director/DirectorShell";
import type { WorkConfig } from "../types";

type AttendanceProps = {
  employees: Employee[];
  attendance: AttendanceRecord[];
  workConfig: WorkConfig | null;
};

export default function DirectorAttendancePage() {
  return (
    <DirectorShell
      activeSection="attendance"
      render={({ employees, attendance, workConfig }) => (
        <AttendanceSection
          employees={employees}
          attendance={attendance}
          workConfig={workConfig}
        />
      )}
    />
  );
}

function AttendanceSection({ employees, attendance, workConfig }: AttendanceProps) {
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const latestDate = useMemo(
    () =>
      attendance.reduce<string | null>((max, r) => {
        if (!max || r.date > max) return r.date;
        return max;
      }, null),
    [attendance]
  );

  const [selectedDate, setSelectedDate] = useState<string | null>(todayIso);

  const attMap = useMemo(() => {
    const m = new Map<string, AttendanceRecord>();
    if (!selectedDate) return m;
    attendance.forEach((r) => {
      if (r.date === selectedDate) {
        m.set(r.employeeCode, r);
      }
    });
    return m;
  }, [attendance, selectedDate]);

  const countInSelected = attMap.size;

  const formatDate = (iso?: string | null) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  const handleDateChange = (v: string) => {
    setSelectedDate(v || null);
  };

  const summary = useMemo(() => {
    let checkedIn = 0;
    let missing = 0;
    let noCheckIn = 0;
    let late = 0;
    let earlyLeave = 0;
    let overtime = 0;
    if (!selectedDate)
      return { checkedIn, missing, noCheckIn, late, earlyLeave, overtime };

    const stdIn = timeToMinutes(workConfig?.standardCheckIn) ?? 0;
    const stdOut = timeToMinutes(workConfig?.standardCheckOut);
    const lateGrace = workConfig?.lateGraceMinutes ?? 0;
    const earlyGrace = workConfig?.earlyLeaveGraceMinutes ?? 0;
    const otThreshold = workConfig?.overtimeThresholdMinutes ?? 60;

    employees.forEach((e) => {
      const rec = attMap.get(e.code);
      if (!rec) {
        missing++;
        return;
      }
      const checkInM = timeToMinutes(rec.checkIn);
      const checkOutM = timeToMinutes(rec.checkOut);
      if (rec.checkIn) {
        checkedIn++;
        if (checkInM !== null && checkInM > stdIn + lateGrace) late++;
      } else {
        noCheckIn++;
      }
      if (stdOut !== null && checkOutM !== null && checkOutM < stdOut - earlyGrace) {
        earlyLeave++;
      }
      if (stdOut !== null && checkOutM !== null && checkOutM > stdOut + otThreshold) {
        overtime++;
      }
    });
    return { checkedIn, missing, noCheckIn, late, earlyLeave, overtime };
  }, [attMap, employees, selectedDate, workConfig]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              Quản lý chấm công
            </h2>
            <p className="text-xs text-slate-500">
              Dữ liệu lấy trực tiếp từ Google Sheet chấm công.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <label className="text-slate-600">Chọn ngày</label>
            <input
              type="date"
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              value={selectedDate || ""}
              max={latestDate || todayIso}
              onChange={(e) => handleDateChange(e.target.value)}
            />
            <span className="text-[11px] text-slate-500">
              {selectedDate
                ? `Đang xem: ${formatDate(selectedDate)}`
                : "Chưa chọn ngày"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <AttendanceStat label="Tổng bản ghi" value={attendance.length} />
          <AttendanceStat label="Bản ghi ngày chọn" value={countInSelected} />
          <AttendanceStat label="Số nhân viên" value={employees.length} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <ChartCard
            title="Tình trạng chấm công"
            total={employees.length}
            segments={[
              { label: "Đã check-in", value: summary.checkedIn, color: "#22c55e" },
              { label: "Thiếu check-in", value: summary.noCheckIn, color: "#f97316" },
              { label: "Chưa có bản ghi", value: summary.missing, color: "#94a3b8" },
            ]}
          />
          <AttendanceStat label="Đi trễ" value={summary.late} />
          <AttendanceStat label="Về sớm" value={summary.earlyLeave} />
          <AttendanceStat label="Tăng ca" value={summary.overtime} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-800">
            Danh sách chấm công theo ngày
          </div>
          <div className="text-xs text-slate-500">
            {selectedDate
              ? `Ngày ${formatDate(selectedDate)}`
              : "Chọn ngày để xem dữ liệu"}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Mã NV</th>
                <th className="px-3 py-2 text-left font-medium">Họ và tên</th>
                <th className="px-3 py-2 text-left font-medium">Check-in</th>
                <th className="px-3 py-2 text-left font-medium">Check-out</th>
                <th className="px-3 py-2 text-left font-medium">Đi trễ</th>
                <th className="px-3 py-2 text-left font-medium">Về sớm</th>
                <th className="px-3 py-2 text-left font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-4 text-center text-slate-400"
                  >
                    Chưa có nhân viên nào trong danh sách.
                  </td>
                </tr>
              )}

              {employees.map((e) => {
                const rec = selectedDate ? attMap.get(e.code) : undefined;
                const checkIn = rec?.checkIn || "-";
                const checkOut = rec?.checkOut || "-";
                const status = !selectedDate
                  ? "Chọn ngày"
                  : rec
                  ? checkIn
                    ? "Đã chấm"
                    : "Không có giờ vào"
                  : "Vắng";
                const checkInM = timeToMinutes(rec?.checkIn);
                const checkOutM = timeToMinutes(rec?.checkOut);
                const stdIn = timeToMinutes(workConfig?.standardCheckIn) ?? 0;
                const stdOut = timeToMinutes(workConfig?.standardCheckOut);
                const lateGrace = workConfig?.lateGraceMinutes ?? 0;
                const earlyGrace = workConfig?.earlyLeaveGraceMinutes ?? 0;
                const isLate =
                  checkInM !== null && checkInM > stdIn + lateGrace;
                const isEarlyLeave =
                  stdOut !== null &&
                  checkOutM !== null &&
                  checkOutM < stdOut - earlyGrace;

                return (
                  <tr
                    key={e.code}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2">{e.code}</td>
                    <td className="px-3 py-2">{e.name}</td>
                    <td className="px-3 py-2">{checkIn}</td>
                    <td className="px-3 py-2">{checkOut}</td>
                    <td className="px-3 py-2">
                      {rec ? (isLate ? "Có" : "Không") : "-"}
                    </td>
                    <td className="px-3 py-2">
                      {rec ? (isEarlyLeave ? "Có" : "Không") : "-"}
                    </td>
                    <td className="px-3 py-2">{status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AttendanceStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-slate-100 rounded-lg p-3 bg-slate-50">
      <div className="text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-slate-900 mt-1">{value}</div>
    </div>
  );
}

function ChartCard({
  title,
  total,
  segments,
}: {
  title: string;
  total: number;
  segments: { label: string; value: number; color: string }[];
}) {
  const safeTotal = total > 0 ? total : 1;
  const totalSegments = segments.reduce((s, v) => s + v.value, 0);

  const gradient = segments
    .reduce<{ from: number; to: number; color: string; acc: number }[]>(
      (arr, s) => {
        const prev = arr.length ? arr[arr.length - 1].to : 0;
        const to = prev + (s.value / safeTotal) * 360;
        arr.push({ from: prev, to, color: s.color, acc: to });
        return arr;
      },
      []
    )
    .map((seg) => `${seg.color} ${seg.from.toFixed(2)}deg ${seg.to.toFixed(2)}deg`)
    .join(", ");

  return (
    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex items-center gap-4">
      <div className="relative h-24 w-24">
        <div
          className="absolute inset-0 rounded-full"
          style={{ background: `conic-gradient(${gradient})` }}
        />
        <div className="absolute inset-3 rounded-full bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-semibold text-slate-900">{total}</div>
            <div className="text-[11px] text-slate-500">Nhân viên</div>
          </div>
        </div>
      </div>
      <div className="flex-1 text-xs space-y-2">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-slate-600">{s.label}</span>
            <span className="font-semibold text-slate-900">
              {s.value} (
              {totalSegments > 0
                ? Math.round((s.value / totalSegments) * 100)
                : 0}
              %)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function timeToMinutes(time?: string | null): number | null {
  if (!time) return null;
  const [hh, mm] = time.split(":").map((v) => parseInt(v, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}
