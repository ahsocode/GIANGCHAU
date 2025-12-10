"use client";

import { useMemo } from "react";
import { AppShell } from "@/component/layout/AppShell";
import type { Employee } from "@/lib/hr-types";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

type RoleBucket = {
  roleLabel: string;
  total: number;
  fullTime: number;
  temp: number;
};

export default function EmployeeOverviewPage() {
  return (
    <AppShell
      activeSection="employeesOverview"
      render={({ employees }) => {
        const { roleBuckets, totals } = buildRoleBuckets(employees);

        return (
          <div className="space-y-6">
            <HeaderStats totals={totals} />
            <RoleTable buckets={roleBuckets} grandTotal={totals.total} />
            <Charts buckets={roleBuckets} grandTotal={totals.total} />
          </div>
        );
      }}
    />
  );
}

function buildRoleBuckets(employees: Employee[]) {
  const buckets = new Map<string, RoleBucket>();
  let total = 0;
  let totalFullTime = 0;
  let totalTemp = 0;

  employees.forEach((e) => {
    const label = e.roleName || e.roleKey || "Khác";
    const existing = buckets.get(label) || {
      roleLabel: label,
      total: 0,
      fullTime: 0,
      temp: 0,
    };

    existing.total += 1;
    total += 1;
    if (e.employmentType === "FULL_TIME") {
      existing.fullTime += 1;
      totalFullTime += 1;
    } else {
      existing.temp += 1;
      totalTemp += 1;
    }
    buckets.set(label, existing);
  });

  const roleBuckets = Array.from(buckets.values()).sort(
    (a, b) => b.total - a.total
  );

  return { roleBuckets, totals: { total, totalFullTime, totalTemp } };
}

function HeaderStats({ totals }: { totals: { total: number; totalFullTime: number; totalTemp: number } }) {
  const cards = [
    {
      label: "Tổng nhân viên",
      value: totals.total,
      color: "bg-blue-50 text-blue-700 border border-blue-100",
    },
    {
      label: "Nhân viên chính thức",
      value: totals.totalFullTime,
      color: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    },
    {
      label: "Nhân viên thời vụ",
      value: totals.totalTemp,
      color: "bg-amber-50 text-amber-700 border border-amber-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`${c.color} rounded-lg p-4 shadow-sm flex flex-col gap-1`}
        >
          <div className="text-xs font-medium uppercase tracking-wide text-slate-600">
            {c.label}
          </div>
          <div className="text-2xl font-bold">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function RoleTable({ buckets, grandTotal }: { buckets: RoleBucket[]; grandTotal: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">
          Phân bố nhân viên theo chức vụ
        </h2>
        <span className="text-xs text-slate-500">Tổng: {grandTotal}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Chức vụ</th>
              <th className="px-3 py-2 text-right font-medium">Tổng</th>
              <th className="px-3 py-2 text-right font-medium">Chính thức</th>
              <th className="px-3 py-2 text-right font-medium">Thời vụ</th>
              <th className="px-3 py-2 text-left font-medium">Tỷ lệ</th>
            </tr>
          </thead>
          <tbody>
            {buckets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-slate-400">
                  Chưa có dữ liệu nhân viên.
                </td>
              </tr>
            )}
            {buckets.map((b) => {
              const ratio = grandTotal ? Math.round((b.total / grandTotal) * 100) : 0;
              return (
                <tr key={b.roleLabel} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">{b.roleLabel}</td>
                  <td className="px-3 py-2 text-right">{b.total}</td>
                  <td className="px-3 py-2 text-right text-emerald-700">{b.fullTime}</td>
                  <td className="px-3 py-2 text-right text-amber-700">{b.temp}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 bg-blue-500"
                          style={{ width: `${ratio}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-500 w-10 text-right">
                        {ratio}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Charts({ buckets, grandTotal }: { buckets: RoleBucket[]; grandTotal: number }) {
  const top = buckets.slice(0, 6);
  const doughnutData = useMemo(() => {
    const labels = top.map((b) => b.roleLabel);
    const data = top.map((b) => b.total);
    const colors = ["#1d4ed8", "#f59e0b", "#10b981", "#0ea5e9", "#ec4899", "#6366f1"];
    return {
      labels,
      datasets: [
        {
          label: "Số lượng",
          data,
          backgroundColor: labels.map((_, idx) => colors[idx % colors.length]),
          borderWidth: 0,
        },
      ],
    };
  }, [top]);

  const stackedData = useMemo(() => {
    const labels = top.map((b) => b.roleLabel);
    return {
      labels,
      datasets: [
        {
          label: "Chính thức",
          data: top.map((b) => b.fullTime),
          backgroundColor: "#10b981",
          stack: "status",
        },
        {
          label: "Thời vụ",
          data: top.map((b) => b.temp),
          backgroundColor: "#f59e0b",
          stack: "status",
        },
      ],
    };
  }, [top]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">Biểu đồ nhanh</h3>
        <span className="text-xs text-slate-500">Top 6 chức vụ</span>
      </div>
      {top.length === 0 && (
        <div className="text-sm text-slate-500">Không có dữ liệu để hiển thị.</div>
      )}

      {top.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Tỷ trọng theo chức vụ</h4>
            <Doughnut data={doughnutData} />
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <h4 className="text-xs font-semibold text-slate-600 mb-2">Chính thức vs thời vụ</h4>
            <Bar
              data={stackedData}
              options={{
                responsive: true,
                plugins: { legend: { position: "top" as const } },
                scales: {
                  x: { stacked: true, grid: { display: false } },
                  y: { stacked: true, beginAtZero: true, grid: { color: "#e2e8f0" } },
                },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
