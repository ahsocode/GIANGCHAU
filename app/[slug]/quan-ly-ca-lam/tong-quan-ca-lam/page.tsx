"use client";

import { AppShell } from "@/component/layout/AppShell";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type ShiftSummary = {
  shift: string;
  name: string;
  total: number;
  fullTime: number;
  temporary: number;
};

type ApiSummary = {
  items: ShiftSummary[];
  overall: { total: number; fullTime: number; temporary: number };
};

export default function ShiftOverviewPage() {
  return (
    <AppShell
      activeSection="shiftOverview"
      render={({ employees, workConfigs }) => (
        <ShiftOverviewContent fallbackEmployees={employees} workConfigs={workConfigs} />
      )}
    />
  );
}

function ShiftOverviewContent({
  fallbackEmployees,
  workConfigs,
}: {
  fallbackEmployees: { shiftCode?: string | null; employmentType?: string | null }[];
  workConfigs: { shift: number; name?: string | null }[];
}) {
  const [data, setData] = useState<ShiftSummary[]>([]);
  const [total, setTotal] = useState<{ total: number; fullTime: number; temporary: number }>({
    total: 0,
    fullTime: 0,
    temporary: 0,
  });
  const [usedFallback, setUsedFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const computeFromFallback = useCallback(() => {
    const shiftDefs = workConfigs.length
      ? workConfigs.map((c) => ({
          shift: String(c.shift),
          name: c.name || `Ca ${c.shift}`,
        }))
      : fallbackEmployees
          .map((e) => (e.shiftCode ? String(e.shiftCode) : null))
          .filter(Boolean)
          .map((code) => ({ shift: code as string, name: `Ca ${code}` }));
    const summaryMap = new Map<string, ShiftSummary>();
    shiftDefs.forEach((s) => {
      summaryMap.set(s.shift, {
        shift: s.shift,
        name: s.name,
        total: 0,
        fullTime: 0,
        temporary: 0,
      });
    });
    fallbackEmployees.forEach((e) => {
      const key = e.shiftCode ? String(e.shiftCode) : "unknown";
      const item =
        summaryMap.get(key) ||
        summaryMap.set(key, { shift: key, name: `Ca ${key}`, total: 0, fullTime: 0, temporary: 0 }).get(key)!;
      item.total += 1;
      const t = (e.employmentType || "").toUpperCase();
      if (t === "TEMPORARY" || t === "SEASONAL") item.temporary += 1;
      else item.fullTime += 1;
    });
    const items = Array.from(summaryMap.values()).sort((a, b) =>
      a.shift.localeCompare(b.shift, undefined, { numeric: true })
    );
    const overall = items.reduce(
      (acc, cur) => {
        acc.total += cur.total;
        acc.fullTime += cur.fullTime;
        acc.temporary += cur.temporary;
        return acc;
      },
      { total: 0, fullTime: 0, temporary: 0 }
    );
    setData(items);
    setTotal(overall);
    setUsedFallback(true);
  }, [fallbackEmployees, workConfigs]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/shifts/summary", { signal: controller.signal, cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Không tải được tổng quan ca làm");
        }
        const json: ApiSummary = await res.json();
        if ((json.items || []).length) {
          setData(json.items || []);
          setTotal(json.overall || { total: 0, fullTime: 0, temporary: 0 });
          setUsedFallback(false);
        } else if (fallbackEmployees.length) {
          computeFromFallback();
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Lỗi không xác định";
        setError(msg);
        if (fallbackEmployees.length) computeFromFallback();
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [fallbackEmployees, workConfigs, computeFromFallback]);

  // Nếu API chưa trả mà dữ liệu fallback đã có (từ AppShell), tự hiển thị ngay
  useEffect(() => {
    if (!loading && data.length === 0 && (fallbackEmployees.length || workConfigs.length)) {
      computeFromFallback();
    }
  }, [loading, data.length, fallbackEmployees, workConfigs, computeFromFallback]);

  // Nếu đã dùng fallback và workConfigs thay đổi (tên ca cập nhật), tính lại để bỏ "unknown"
  useEffect(() => {
    if (usedFallback && (fallbackEmployees.length || workConfigs.length)) {
      computeFromFallback();
    }
  }, [usedFallback, fallbackEmployees, workConfigs, computeFromFallback]);

  const barData = useMemo(() => {
    const labels = data.map((d) => d.name || `Ca ${d.shift}`);
    return {
      labels,
      datasets: [
        {
          label: "Chính thức",
          data: data.map((d) => d.fullTime),
          backgroundColor: "rgba(59, 130, 246, 0.8)",
        },
        {
          label: "Thời vụ",
          data: data.map((d) => d.temporary),
          backgroundColor: "rgba(250, 204, 21, 0.9)",
        },
      ],
    };
  }, [data]);

  const doughnutData = useMemo(() => {
    const labels = data.map((d) => d.name || `Ca ${d.shift}`);
    const values = data.map((d) => d.total);
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: [
            "#1d4ed8",
            "#0ea5e9",
            "#22c55e",
            "#f59e0b",
            "#f97316",
            "#6366f1",
            "#14b8a6",
            "#ef4444",
          ],
          borderWidth: 1,
        },
      ],
    };
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
              Tổng quan ca làm
            </p>
            <h2 className="text-lg font-semibold text-slate-900">Phân bổ nhân sự theo ca</h2>
            <p className="text-sm text-slate-600">
              Số nhân viên chính thức và thời vụ ở từng ca. Dữ liệu lấy từ ca hiện có và bảng nhân viên.
            </p>
          </div>
          <div className="flex gap-3">
            <SummaryChip label="Tổng nhân viên" value={total.total} color="bg-blue-50 text-blue-700" />
            <SummaryChip label="Chính thức" value={total.fullTime} color="bg-emerald-50 text-emerald-700" />
            <SummaryChip label="Thời vụ" value={total.temporary} color="bg-amber-50 text-amber-700" />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-sm rounded-md px-4 py-3">
          {error}
        </div>
      )}

      {loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-slate-500 text-sm">
          Đang tải dữ liệu...
        </div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Biểu đồ cột</h3>
              <span className="text-xs text-slate-500">Chính thức vs Thời vụ</span>
            </div>
            {data.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có dữ liệu ca làm.</p>
            ) : (
              <Bar
                data={barData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { position: "top" as const },
                    tooltip: { mode: "index" as const, intersect: false },
                  },
                  scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } },
                  },
                }}
              />
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Tỉ lệ tổng</h3>
              <span className="text-xs text-slate-500">Tất cả loại nhân viên</span>
            </div>
            {data.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>
            ) : (
              <Doughnut
                data={doughnutData}
                options={{
                  plugins: {
                    legend: { position: "bottom" as const, labels: { boxWidth: 12 } },
                  },
                  cutout: "55%",
                }}
              />
            )}
            <div className="mt-4 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between">
                <span>Chính thức</span>
                <span className="font-semibold text-slate-800">{total.fullTime}</span>
              </div>
              <div className="flex justify-between">
                <span>Thời vụ</span>
                <span className="font-semibold text-slate-800">{total.temporary}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Ca</th>
                <th className="px-3 py-2 text-left font-medium">Tổng</th>
                <th className="px-3 py-2 text-left font-medium">Chính thức</th>
                <th className="px-3 py-2 text-left font-medium">Thời vụ</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.shift} className="border-t border-slate-100">
                  <td className="px-3 py-2">{row.name || `Ca ${row.shift}`}</td>
                  <td className="px-3 py-2 font-semibold text-slate-900">{row.total}</td>
                  <td className="px-3 py-2 text-emerald-700">{row.fullTime}</td>
                  <td className="px-3 py-2 text-amber-700">{row.temporary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`px-4 py-2 rounded-lg border border-slate-100 text-sm font-semibold ${color}`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="text-base">{value}</div>
    </div>
  );
}
