const SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
const SUPABASE_ANON_KEY_ENV = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(`Missing ${SUPABASE_URL_ENV}.`);
  }
  return url;
}

export function getSupabasePublishableKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(`Missing ${SUPABASE_KEY_ENV} (or legacy ${SUPABASE_ANON_KEY_ENV}).`);
  }
  return key;
}
