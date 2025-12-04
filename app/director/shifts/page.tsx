"use client";

import { useMemo } from "react";
import { DirectorShell } from "@/component/director/DirectorShell";
import type { Employee } from "@/lib/hr-types";
import type { WorkConfig } from "../types";

type WorkShift = {
  id: string;
  label: string;
  shift: number;
};

type Props = {
  workShifts: WorkShift[];
  activeShiftId: string;
  setActiveShiftId: (id: string) => void;
  workConfig: WorkConfig | null;
  configDraft: WorkConfig;
  onDraftChange: (cfg: WorkConfig) => void;
  onSaveConfig: () => void;
  savingConfig: boolean;
  configMessage: string | null;
  employees: Employee[];
};

export default function DirectorShiftsPage() {
  return (
    <DirectorShell
      activeSection="shifts"
      render={({
        workShifts,
        activeShiftId,
        setActiveShiftId,
        workConfig,
        configDraft,
        setConfigDraft,
        handleSaveWorkConfig,
        savingConfig,
        configMessage,
        employees,
      }) => (
        <ShiftsSection
          workShifts={workShifts as WorkShift[]}
          activeShiftId={activeShiftId}
          setActiveShiftId={setActiveShiftId}
          workConfig={workConfig}
          configDraft={configDraft}
          onDraftChange={setConfigDraft}
          onSaveConfig={handleSaveWorkConfig}
          savingConfig={savingConfig}
          configMessage={configMessage}
          employees={employees}
        />
      )}
    />
  );
}

function ShiftsSection(props: Props) {
  const {
    workShifts,
    activeShiftId,
    setActiveShiftId,
    workConfig,
    configDraft,
    onDraftChange,
    onSaveConfig,
    savingConfig,
    configMessage,
    employees,
  } = props;

  const distribution = useMemo(() => {
    const counts: Record<string, number> = {};
    workShifts.forEach((s) => {
      counts[s.id] = 0;
    });
    employees.forEach((e) => {
      const id = e.shiftCode ? String(e.shiftCode) : null;
      if (id && counts[id] !== undefined) counts[id] += 1;
    });
    const total = employees.length;
    return { counts, total };
  }, [employees, workShifts]);

  const segments = workShifts.map((s) => {
    const val = distribution.counts[s.id] ?? 0;
    return { label: s.label, value: val, color: pickColor(s.shift) };
  });

  const handleTime = (
    field: "standardCheckIn" | "standardCheckOut",
    value: string
  ) => {
    onDraftChange({ ...configDraft, [field]: value });
  };

  const handleNumber = (
    field:
      | "lateGraceMinutes"
      | "earlyLeaveGraceMinutes"
      | "overtimeThresholdMinutes",
    value: number
  ) => {
    onDraftChange({ ...configDraft, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Quản lý ca làm</h2>
            <p className="text-xs text-slate-500">
              Chọn ca và điều chỉnh giờ vào / tan làm, phút trễ / về sớm, ngưỡng tăng ca.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-600">Chọn ca</span>
            <select
              className="border border-slate-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              value={activeShiftId}
              onChange={(e) => setActiveShiftId(e.target.value)}
            >
              {workShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <ChartCard title="Tỉ lệ nhân viên theo ca" total={distribution.total} segments={segments} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-3 text-xs text-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <LabeledInput
            label="Giờ vào chuẩn"
            type="time"
            value={configDraft.standardCheckIn}
            lang="vi"
            onChange={(v) => handleTime("standardCheckIn", v)}
          />
          <LabeledInput
            label="Giờ tan chuẩn"
            type="time"
            value={configDraft.standardCheckOut}
            lang="vi"
            onChange={(v) => handleTime("standardCheckOut", v)}
          />
          <LabeledInput
            label="Phút cho phép trễ"
            type="number"
            min={0}
            value={configDraft.lateGraceMinutes}
            onChangeNumber={(v) => handleNumber("lateGraceMinutes", v)}
          />
          <LabeledInput
            label="Phút cho phép về sớm"
            type="number"
            min={0}
            value={configDraft.earlyLeaveGraceMinutes}
            onChangeNumber={(v) => handleNumber("earlyLeaveGraceMinutes", v)}
          />
          <LabeledInput
            label="Phút sau giờ ra mới tính tăng ca"
            type="number"
            min={0}
            value={configDraft.overtimeThresholdMinutes}
            onChangeNumber={(v) => handleNumber("overtimeThresholdMinutes", v)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-slate-500">
            {workConfig ? (
              <span>
                Đang áp dụng: {workConfig.standardCheckIn} - {workConfig.standardCheckOut}
              </span>
            ) : (
              <span>Chưa tải được cấu hình.</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {configMessage && (
              <span className="text-[11px] text-slate-600">{configMessage}</span>
            )}
            <button
              onClick={onSaveConfig}
              disabled={savingConfig}
              className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-500 disabled:opacity-60 transition"
            >
              {savingConfig ? "Đang lưu..." : "Lưu cấu hình ca"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function pickColor(idx: number) {
  const palette = ["#3b82f6", "#10b981", "#f97316", "#8b5cf6", "#ec4899", "#06b6d4"];
  return palette[(idx - 1) % palette.length];
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
  const sum = segments.reduce((s, v) => s + v.value, 0);

  const gradient = segments
    .reduce<{ from: number; to: number; color: string }[]>((arr, s) => {
      const from = arr.length ? arr[arr.length - 1].to : 0;
      const to = from + (s.value / safeTotal) * 360;
      arr.push({ from, to, color: s.color });
      return arr;
    }, [])
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
              {s.value} ({sum > 0 ? Math.round((s.value / sum) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LabeledInput(props: {
  label: string;
  type: "text" | "time" | "number";
  value: string | number;
  onChange?: (v: string) => void;
  onChangeNumber?: (v: number) => void;
  min?: number;
  lang?: string;
}) {
  const { label, type, value, onChange, onChangeNumber, min, lang } = props;
  return (
    <label className="text-xs text-slate-600 space-y-1">
      <div>{label}</div>
      <input
        type={type}
        min={min}
        lang={lang}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        value={value}
        onChange={(e) => {
          if (type === "number" && onChangeNumber) {
            const next = parseInt(e.target.value || "0", 10);
            onChangeNumber(Number.isNaN(next) ? 0 : next);
          } else if (onChange) {
            onChange(e.target.value);
          }
        }}
      />
    </label>
  );
}
