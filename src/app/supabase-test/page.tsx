"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SupabaseTestPage() {
  const [status, setStatus] = useState("Sprawdzam połączenie...");
  const [details, setDetails] = useState("");

  useEffect(() => {
    async function checkConnection() {
      const supabase = createClient();

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setStatus("Błąd połączenia z Supabase");
        setDetails(error.message);
        return;
      }

      setStatus("Połączenie z Supabase działa");
      setDetails(
        data.session
          ? "Użytkownik jest zalogowany."
          : "Brak zalogowanego użytkownika. To normalne na tym etapie.",
      );
    }

    checkConnection();
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto max-w-3xl rounded-xl border border-neutral-700 bg-neutral-900 p-6">
        <h1 className="text-3xl font-bold">Test Supabase</h1>

        <p className="mt-4 text-xl text-red-500">{status}</p>

        <p className="mt-2 text-neutral-400">{details}</p>

        <p className="mt-6 text-sm text-neutral-500">
          Jeśli widzisz komunikat, że połączenie działa, możemy przejść do
          logowania użytkowników.
        </p>
      </div>
    </main>
  );
}
