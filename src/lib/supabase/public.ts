import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public pages read only published, public rows, exactly as an anonymous visitor
// does, so they need no session: without cookies the pages can be prerendered
// and served from the CDN. The admin keeps the cookie client (server.ts).
let client: SupabaseClient | null = null;
export function createPublicClient() {
  client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  return client;
}
