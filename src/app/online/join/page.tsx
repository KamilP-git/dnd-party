"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthPanel } from "@/components/AuthPanel";

export default function JoinOnlineCampaignPage() {
  const router = useRouter();

  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function joinCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("");
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const inviteCode = String(formData.get("inviteCode") || "")
      .trim()
      .toUpperCase();

    if (!inviteCode) {
      setStatus("Wpisz kod zaproszenia.");
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setStatus("Musisz być zalogowany, żeby dołączyć do kampanii.");
      setIsLoading(false);
      return;
    }

    const { data: campaignId, error } = await supabase.rpc(
      "join_campaign_by_code",
      {
        invite_code_to_join: inviteCode,
      },
    );

    if (error || !campaignId) {
      setStatus(
        `Nie udało się dołączyć do kampanii: ${
          error?.message ?? "Nie znaleziono kampanii."
        }`,
      );
      setIsLoading(false);
      return;
    }

    setStatus("Dołączono do kampanii. Przenoszę do lobby...");
    router.push(`/online/campaigns/${campaignId}`);
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Link
                href="/online"
                className="text-sm text-neutral-300 underline"
              >
                Wróć do kampanii online
              </Link>

              <p className="mt-4 text-sm text-neutral-400">
                Dołączanie do kampanii
              </p>

              <h1 className="mt-2 text-4xl font-bold">
                Dołącz przez kod zaproszenia
              </h1>

              <p className="mt-2 text-neutral-400">
                Wpisz kod otrzymany od właściciela kampanii.
              </p>
            </div>

            <AuthPanel />
          </div>
        </header>

        <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <form onSubmit={joinCampaign} className="grid gap-4">
            <label className="grid gap-1">
              Kod zaproszenia
              <input
                name="inviteCode"
                required
                autoComplete="off"
                placeholder="np. A9F3B2C1"
                className="rounded-lg border border-neutral-700 bg-neutral-800 p-3 text-lg font-bold uppercase tracking-widest text-white caret-white outline-none focus:border-red-700 focus:bg-neutral-800"
              />
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
            >
              {isLoading ? "Dołączam..." : "Dołącz do kampanii"}
            </button>
          </form>

          {status ? (
            <p className="mt-4 rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-sm text-red-500">
              {status}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
