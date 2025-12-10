"use client";

import { useState } from "react";
import type { Employee } from "@/lib/hr-types";
import { AppShell } from "@/component/layout/AppShell";

type EmployeeTab = "all" | "fulltime" | "temporary";

export default function EmployeesListPage() {
  return (
    <AppShell
      activeSection="employees"
      render={({ employeeTab, setEmployeeTab, filteredEmployees }) => (
        <EmployeesSection
          tab={employeeTab}
          onTabChange={setEmployeeTab}
          employees={filteredEmployees}
        />
      )}
    />
  );
}

function EmployeesSection(props: {
  tab: EmployeeTab;
  onTabChange: (tab: EmployeeTab) => void;
  employees: Employee[];
}) {
  const { tab, onTabChange, employees } = props;
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );

  const getShiftLabel = (e: Employee) =>
    e.shiftCode ? `Ca ${e.shiftCode}` : "-";

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200">
          <EmployeeTabButton
            label="Tất cả"
            active={tab === "all"}
            onClick={() => onTabChange("all")}
          />
          <EmployeeTabButton
            label="Nhân viên chính thức"
            active={tab === "fulltime"}
            onClick={() => onTabChange("fulltime")}
          />
          <EmployeeTabButton
            label="Nhân viên thời vụ"
            active={tab === "temporary"}
            onClick={() => onTabChange("temporary")}
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">
              Danh sách nhân viên {" "}
              {tab === "all"
                ? "(tất cả)"
                : tab === "fulltime"
                ? "(chính thức)"
                : "(thời vụ)"}
            </h2>
            <div className="text-xs text-slate-400">Dữ liệu lấy từ Supabase</div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Mã NV</th>
                  <th className="px-3 py-2 text-left font-medium">Họ và tên</th>
                  <th className="px-3 py-2 text-left font-medium">Chức vụ</th>
                  <th className="px-3 py-2 text-left font-medium">Loại</th>
                  <th className="px-3 py-2 text-left font-medium">Bộ phận</th>
                  <th className="px-3 py-2 text-left font-medium">Ca làm</th>
                  <th className="px-3 py-2 text-left font-medium">
                    Trạng thái làm việc
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-4 text-center text-slate-400"
                    >
                      Chưa có nhân viên nào trong danh sách.
                    </td>
                  </tr>
                )}

                {employees.map((e) => (
                  <tr
                    key={e.code}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    <td className="px-3 py-2">{e.code}</td>
                    <td className="px-3 py-2">{e.name}</td>
                    <td className="px-3 py-2">{e.roleName || e.roleKey || "-"}</td>
                    <td className="px-3 py-2">
                      {e.employmentType === "FULL_TIME"
                        ? "Chính thức"
                        : "Thời vụ"}
                    </td>
                    <td className="px-3 py-2">{e.department}</td>
                    <td className="px-3 py-2">{getShiftLabel(e)}</td>
                    <td className="px-3 py-2">
                      {e.workStatusLabel ||
                        (e.workStatus === "ACTIVE" ? "Đang làm" : "Đã nghỉ")}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        className="px-3 py-1 rounded-md text-[11px] font-medium bg-blue-600 text-white hover:bg-blue-500 transition"
                        onClick={() => setSelectedEmployee(e)}
                      >
                        Xem chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedEmployee && (
        <EmployeeDetailModal
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </>
  );
}

function EmployeeTabButton(props: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const { label, active, onClick } = props;
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-xs border-b-2 -mb-px transition ${
        active
          ? "border-blue-600 text-blue-600 font-medium"
          : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200"
      }`}
    >
      {label}
    </button>
  );
}

function EmployeeDetailModal(props: {
  employee: Employee;
  onClose: () => void;
}) {
  const { employee, onClose } = props;

  const shiftLabel = employee.shiftCode ? `Ca ${employee.shiftCode}` : "-";

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-[420px] max-w-[90vw]">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">Thông tin nhân viên</div>
            <div className="text-sm font-semibold text-slate-900">
              {employee.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <div className="px-4 py-4 space-y-3 text-xs text-slate-700">
          <DetailRow label="Mã nhân viên" value={employee.code} />
          <DetailRow label="Chức vụ" value={employee.roleName || employee.roleKey || "-"} />
          <DetailRow
            label="Loại"
            value={
              employee.employmentType === "FULL_TIME" ? "Chính thức" : "Thời vụ"
            }
          />
          <DetailRow label="Phòng ban / xưởng" value={employee.department} />
          <DetailRow
            label="Trạng thái làm việc"
            value={
              employee.workStatusLabel ||
              (employee.workStatus === "ACTIVE" ? "Đang làm" : "Đã nghỉ")
            }
          />
          <DetailRow label="Ngày vào làm" value={employee.startDate || "-"} />
          <DetailRow label="Số điện thoại" value={employee.phone || "-"} />
          <DetailRow label="Email" value={employee.email || "-"} />
          <DetailRow label="CCCD" value={employee.cccd || "-"} />
          <DetailRow label="BHXH" value={employee.bhxh || "-"} />
          <DetailRow label="Ca làm" value={shiftLabel} />
        </div>

        <div className="px-4 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow(props: { label: string; value: string }) {
  const { label, value } = props;
  return (
    <div className="flex justify-between gap-4">
      <div className="text-slate-500">{label}</div>
      <div className="font-medium text-slate-900 text-right wrap-break-word">
        {value}
      </div>
    </div>
  );
}
