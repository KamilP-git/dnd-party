"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  display_name: string;
  created_at: string;
};

export default function AccountPage() {
  const [userEmail, setUserEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);

  const [status, setStatus] = useState("Ładuję konto...");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadAccount() {
    setIsLoading(true);
    setStatus("Ładuję konto...");

    const supabase = createClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setUserEmail("");
      setProfile(null);
      setDisplayName("");
      setStatus("Musisz być zalogowany, żeby edytować konto.");
      setIsLoading(false);
      return;
    }

    setUserEmail(userData.user.email ?? "");

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profileData) {
      setProfile(null);
      setDisplayName("");
      setStatus(
        `Nie udało się pobrać profilu: ${
          profileError?.message ?? "brak danych"
        }`,
      );
      setIsLoading(false);
      return;
    }

    setProfile(profileData as Profile);
    setDisplayName(profileData.display_name ?? "");
    setStatus("Konto zostało wczytane.");
    setIsLoading(false);
  }

  useEffect(() => {
    void loadAccount();
  }, []);

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile) {
      setStatus("Nie wczytano profilu.");
      return;
    }

    const cleanedDisplayName = displayName.trim();

    if (!cleanedDisplayName) {
      setStatus("Nick nie może być pusty.");
      return;
    }

    setIsSaving(true);
    setStatus("Zapisuję nick...");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: cleanedDisplayName,
      })
      .eq("id", profile.id)
      .select("*")
      .single();

    if (error || !data) {
      setStatus(
        `Nie udało się zapisać nicku: ${
          error?.message ?? "brak danych po zapisie"
        }`,
      );
      setIsSaving(false);
      return;
    }

    setProfile(data as Profile);
    setDisplayName(data.display_name ?? "");
    setStatus("Nick został zapisany.");
    setIsSaving(false);
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-3 text-sm">
                <Link href="/" className="text-neutral-300 underline">
                  Strona główna
                </Link>

                <span className="text-neutral-600">/</span>

                <Link href="/online" className="text-neutral-300 underline">
                  Kampanie online
                </Link>
              </div>

              <p className="mt-6 text-sm font-semibold uppercase tracking-[0.25em] text-red-500">
                Konto
              </p>

              <h1 className="mt-2 text-4xl font-bold">Ustawienia konta</h1>

              <p className="mt-3 text-neutral-400">
                Tutaj ustawiasz nick widoczny dla innych graczy w kampaniach.
              </p>
            </div>

            <AuthPanel />
          </div>
        </header>

        <p className="mt-4 rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-sm text-red-400">
          {status}
        </p>

        <section className="mt-6 rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
          {isLoading ? (
            <p className="text-neutral-400">Ładuję...</p>
          ) : !profile ? (
            <div>
              <h2 className="text-2xl font-bold">Nie jesteś zalogowany</h2>

              <p className="mt-3 text-neutral-400">
                Zaloguj się, żeby edytować swój nick.
              </p>

              <Link
                href="/auth?next=/account"
                className="mt-5 inline-block rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500"
              >
                Zaloguj się
              </Link>
            </div>
          ) : (
            <form onSubmit={saveAccount} className="grid gap-5">
              <label className="grid gap-1 text-sm">
                Email logowania
                <input
                  value={userEmail}
                  disabled
                  className="rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-neutral-500"
                />
              </label>

              <label className="grid gap-1 text-sm">
                Nick widoczny dla innych
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="np. Kamil"
                  className="rounded-lg border border-neutral-700 bg-neutral-800 p-3 text-white caret-white outline-none focus:border-red-700"
                />
              </label>

              <button
                type="submit"
                disabled={isSaving}
                className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
              >
                {isSaving ? "Zapisuję..." : "Zapisz nick"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
