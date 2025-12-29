"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/component/layout/AppShell";
import type { Employee } from "@/lib/hr-types";

export default function EmployeeDetailPage() {
  return (
    <AppShell
      activeSection="employees"
      render={({ employees, workConfigs }) => <EmployeeDetail employees={employees} workConfigs={workConfigs} />}
    />
  );
}

function EmployeeDetail({
  employees,
  workConfigs,
}: {
  employees: Employee[];
  workConfigs: { shift: number; name?: string | null }[];
}) {
  const params = useParams<{ slug?: string; code?: string }>();
  const router = useRouter();
  const slug = (params?.slug as string) || "";
  const codeParam = decodeURIComponent((params?.code as string) || "").toLowerCase();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/employees/${encodeURIComponent(codeParam)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Không tải được thông tin nhân viên");
        }
        const data = await res.json();
        if (!cancelled) setEmployee(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Không tải được thông tin nhân viên";
        const fallback = employees.find((e) => (e.code || "").toLowerCase() === codeParam) || null;
        if (!cancelled) {
          setEmployee(fallback);
          setError(fallback ? "Hiển thị dữ liệu tạm từ bộ nhớ cục bộ." : message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [codeParam, employees]);

  const shiftLabel = useMemo(() => {
    if (!employee?.shiftCode) return "-";
    const code = String(employee.shiftCode);
    const found = workConfigs.find((c) => String(c.shift) === code);
    return found?.name || `Ca ${code}`;
  }, [employee, workConfigs]);

  const goBack = () => {
    const target = slug ? `/${slug}/quan-ly-nhan-vien/danh-sach-nhan-vien` : "/quan-ly-nhan-vien/danh-sach-nhan-vien";
    router.push(target);
  };

  if (loading) {
    return <div className="text-sm text-slate-600">Đang tải thông tin nhân viên...</div>;
  }

  if (!employee) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
          Không tìm thấy nhân viên.
        </div>
        <button
          onClick={goBack}
          className="px-3 py-2 text-xs font-semibold rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-xs text-slate-500">Thông tin nhân viên</p>
          <h1 className="text-lg font-semibold text-slate-900">{employee.name}</h1>
          <p className="text-xs text-slate-500">Mã: {employee.code}</p>
        </div>
        <button
          onClick={goBack}
          className="px-3 py-2 text-xs font-semibold rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
        >
          ← Quay lại danh sách
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left box - Avatar and basic info */}
        <div className="bg-white border border-slate-300 rounded-lg p-6 lg:col-span-1 h-full flex flex-col">
          <div className="w-full h-[400px] bg-slate-50 border border-slate-300 rounded-lg overflow-hidden flex items-center justify-center mb-4">
            <span className="text-slate-400 text-sm">avatar</span>
          </div>
          
          <div className="space-y-2 text-sm text-slate-700 flex-1">
            <InfoLine label="Họ và tên" value={employee.name || "-"} />
            <InfoLine label="Chức vụ" value={employee.roleName || employee.roleKey || "-"} />
            <InfoLine label="Mã nhân viên" value={employee.code || "-"} />
          </div>

          <div className="mt-auto flex justify-center pt-4">
            <Barcode code={employee.code || "-"} />
          </div>
        </div>

        {/* Right box - Detailed info */}
        <div className="bg-white border border-slate-300 rounded-lg p-6 min-h-[500px] lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-800">
            <InfoLine label="Chức vụ" value={employee.roleName || employee.roleKey || "-"} />
            <InfoLine label="Loại" value={employee.employmentType === "FULL_TIME" ? "Chính thức" : "Thời vụ"} />
            <InfoLine label="Trạng thái làm việc" value={employee.workStatusLabel || (employee.workStatus === "ACTIVE" ? "Đang làm" : "Đã nghỉ")} />
            <InfoLine label="Phòng ban / xưởng" value={employee.department || "-"} />
            <InfoLine label="Ngày vào làm" value={formatDate(employee.startDate)} />
            <InfoLine label="Ca làm" value={shiftLabel} />
            <InfoLine label="Số điện thoại" value={employee.phone || "-"} />
            <InfoLine label="Email" value={employee.email || "-"} />
            <InfoLine label="CCCD" value={employee.cccd || "-"} />
            <InfoLine label="BHXH" value={employee.bhxh || "-"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0">
      <span className="text-slate-600">{label}</span>
      <span className="text-slate-900 font-medium text-right">{value || "-"}</span>
    </div>
  );
}

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function Barcode({ code }: { code: string }) {
  const safeCode = code || "-";
  const bars = useMemo(() => {
    const stripes: { x: number; width: number }[] = [];
    let cursor = 1;
    for (const ch of safeCode) {
      const val = ch.charCodeAt(0);
      for (let i = 0; i < 8; i++) {
        const bit = (val >> i) & 1;
        const width = bit ? 3 : 1;
        stripes.push({ x: cursor, width });
        cursor += width;
      }
      cursor += 2; // separator
    }
    const totalWidth = cursor + 1;
    return { stripes, totalWidth };
  }, [safeCode]);

  return (
    <div className="border border-slate-200 rounded-md bg-white p-2 inline-block">
      <svg width={bars.totalWidth} height={80} role="img" aria-label={`Mã vạch ${safeCode}`}>
        <rect width="100%" height="100%" fill="#fff" />
        {bars.stripes.map((bar, idx) => (
          <rect key={idx} x={bar.x} y={6} width={bar.width} height={64} fill="#111827" />
        ))}
      </svg>
      <div className="text-center text-xs text-slate-700 mt-1 font-medium tracking-wider">{safeCode}</div>
    </div>
  );
}
