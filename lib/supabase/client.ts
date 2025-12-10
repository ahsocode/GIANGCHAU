import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function isSupabaseEnabled(): boolean {
  const { url, key } = getEnv();
  return Boolean(url && key);
}

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const { url, key } = getEnv();

  if (!url || !key) {
    throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  client = createClient(url, key);
  return client;
}
