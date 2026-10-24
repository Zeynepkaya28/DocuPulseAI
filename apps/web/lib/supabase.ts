"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let client: SupabaseClient | null = null;

/** Browser client (anon key only). The service role key never reaches the browser. */
export function supabase(): SupabaseClient {
  if (!client) {
    if (!SUPABASE_URL || !ANON_KEY) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı değil (.env.example)");
    }
    client = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 10 } },
    });
  }
  return client;
}

export const isSupabaseConfigured = () => Boolean(SUPABASE_URL && ANON_KEY);

export async function accessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? null;
}
