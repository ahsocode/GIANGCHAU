import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serverClient: SupabaseClient | null = null;

function getEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function isSupabaseServerEnabled(): boolean {
  const { url, serviceKey, anonKey } = getEnv();
  return Boolean(url && (serviceKey || anonKey));
}

export function getSupabaseServerClient(): SupabaseClient {
  if (serverClient) return serverClient;

  const { url, serviceKey, anonKey } = getEnv();
  const key = serviceKey || anonKey;

  if (!url || !key) {
    throw new Error("Thiếu cấu hình Supabase (URL hoặc Service Role Key)");
  }

  serverClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return serverClient;
}
