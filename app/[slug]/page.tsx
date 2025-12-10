"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function SlugIndexPage() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const parts = pathname.split("/").filter(Boolean);
    const slug = parts[0] || "";
    const target = slug ? `/${slug}/tong-quan` : "/tong-quan";
    router.replace(target);
  }, [pathname, router]);
  return null;
}
