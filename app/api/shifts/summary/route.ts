import { NextResponse } from "next/server";
import { prisma, isPrismaEnabled } from "@/lib/prisma/client";
import { isSupabaseEnabled, getSupabaseClient } from "@/lib/supabase/client";
import { fetchEmployeesFromSupabase } from "@/lib/supabase/hr";

type SummaryItem = {
  shift: string;
  name: string;
  total: number;
  fullTime: number;
  temporary: number;
};

export async function GET() {
  // 1) lấy danh sách ca
  let shifts: { shift: string; name: string }[] = [];
  if (isPrismaEnabled()) {
    try {
      const cfgs = await prisma.workConfig.findMany({
        orderBy: { shift: "asc" },
        select: { shift: true, name: true },
      });
      shifts = cfgs.map((c) => ({
        shift: String(c.shift),
        name: c.name || `Ca ${c.shift}`,
      }));
    } catch (err) {
      console.warn("Không lấy được workConfigs bằng Prisma, sẽ thử Supabase.", err);
    }
  }
  if (!shifts.length && isSupabaseEnabled()) {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from("work_configs").select("shift,name").order("shift");
      if (Array.isArray(data)) {
        shifts = data.map((c: { shift?: number | string | null; name?: string | null }) => {
          const val = c.shift != null ? String(c.shift) : "";
          return {
            shift: val,
            name: c.name || (c.shift != null ? `Ca ${c.shift}` : "Ca"),
          };
        });
      }
    } catch (err) {
      console.warn("Không lấy được work_configs bằng Supabase", err);
    }
  }

  // 2) lấy nhân viên
  let employees: { shiftCode?: string | null; employmentType?: string | null }[] = [];
  if (isPrismaEnabled()) {
    try {
      const accounts = await prisma.account.findMany({
        where: { NOT: { roleKey: "ADMIN" } },
        select: {
          detail: { select: { shiftCode: true, employmentType: true } },
        },
      });
      employees = accounts.map((a) => ({
        shiftCode: a.detail?.shiftCode || null,
        employmentType: a.detail?.employmentType || null,
      }));
    } catch (err) {
      console.warn("Không lấy được accounts bằng Prisma, fallback Supabase.", err);
    }
  }
  if (!employees.length && isSupabaseEnabled()) {
    try {
      const supabase = getSupabaseClient();
      const list = await fetchEmployeesFromSupabase(supabase);
      employees = list.map((e) => ({
        shiftCode: e.shiftCode,
        employmentType: e.employmentType,
      }));
    } catch (err) {
      console.warn("Không lấy được employees bằng Supabase", err);
    }
  }

  const summaryMap = new Map<string, SummaryItem>();
  // init shifts
  shifts.forEach((s) => {
    summaryMap.set(s.shift, {
      shift: s.shift,
      name: s.name,
      total: 0,
      fullTime: 0,
      temporary: 0,
    });
  });

  // aggregate employees
  employees.forEach((e) => {
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

  return NextResponse.json({ items, overall });
}
