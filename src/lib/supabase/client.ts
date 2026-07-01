import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Brakuje NEXT_PUBLIC_SUPABASE_URL w pliku .env.local");
  }

  if (!supabasePublishableKey) {
    throw new Error(
      "Brakuje NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY w pliku .env.local",
    );
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}