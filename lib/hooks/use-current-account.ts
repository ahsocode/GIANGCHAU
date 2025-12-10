"use client";

import { useEffect, useState } from "react";

export interface CurrentAccount {
  id: string;
  fullName?: string;
  role?: string;
  roleSlug?: string;
  slug?: string;
  allowedSections?: string[];
  permissions?: string[];
  [key: string]: unknown;
}

export function useCurrentAccount() {
  const [account, setAccount] = useState<CurrentAccount | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const raw = typeof window !== "undefined" ? localStorage.getItem("currentAccount") : null;
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        setAccount(parsed);
      } catch {
        setAccount(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const updateAccount = (next: CurrentAccount | null) => {
    setAccount(next);
    if (typeof window === "undefined") return;
    if (next) {
      localStorage.setItem("currentAccount", JSON.stringify(next));
    } else {
      localStorage.removeItem("currentAccount");
    }
  };

  return { account, updateAccount };
}
