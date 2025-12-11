"use client";

import { useEffect } from "react";
import { ensurePatchedFetch } from "@/lib/fetch-patch";

export function ClientBootstrap() {
  useEffect(() => {
    ensurePatchedFetch();
  }, []);

  return null;
}
