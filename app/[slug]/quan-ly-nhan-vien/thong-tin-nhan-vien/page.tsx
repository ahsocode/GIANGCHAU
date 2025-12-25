"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/component/layout/AppShell";

export default function EmployeeInfoRedirectPage() {
  return (
    <AppShell
      activeSection="employees"
      render={() => <RedirectToList />}
    />
  );
}

function RedirectToList() {
  const router = useRouter();
  const params = useParams();
  useEffect(() => {
    const slug = (params?.slug as string) || "";
    const target = slug ? `/${slug}/quan-ly-nhan-vien/danh-sach-nhan-vien` : "/quan-ly-nhan-vien/danh-sach-nhan-vien";
    router.replace(target);
  }, [params, router]);
  return null;
}
