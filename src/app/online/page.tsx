"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthPanel } from "@/components/AuthPanel";

type OnlineCampaign = {
  id: string;
  name: string;
  description: string;
  notes: string;
  owner_id: string;
  created_at: string;
  archived_at: string | null;
};

export default function OnlineCampaignsPage() {
  const [campaigns, setCampaigns] = useState<OnlineCampaign[]>([]);
  const [status, setStatus] = useState("Ładuję kampanie online...");
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadCampaigns() {
    const supabase = createClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setUserId("");
      setCampaigns([]);
      setStatus(
        "Nie jesteś zalogowany. Zaloguj się, aby widzieć kampanie online.",
      );
      return;
    }

    setUserId(userData.user.id);

    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setStatus(`Nie udało się pobrać kampanii: ${error.message}`);
      return;
    }

    setCampaigns((data ?? []) as OnlineCampaign[]);
    setStatus("Kampanie online zostały wczytane.");
  }

  useEffect(() => {
    loadCampaigns();
  }, []);

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;

    setIsLoading(true);
    setStatus("Tworzę kampanię online...");

    const formData = new FormData(form);

    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim();

    if (!name) {
      setStatus("Podaj nazwę kampanii.");
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setStatus("Nie jesteś zalogowany.");
      setIsLoading(false);
      return;
    }

    const { data: newCampaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        name,
        description,
        owner_id: userData.user.id,
      })
      .select("*")
      .single();

    if (campaignError || !newCampaign) {
      setStatus(
        `Nie udało się utworzyć kampanii: ${
          campaignError?.message ?? "Brak danych kampanii."
        }`,
      );
      setIsLoading(false);
      return;
    }

    const { error: memberError } = await supabase
      .from("campaign_members")
      .insert({
        campaign_id: newCampaign.id,
        user_id: userData.user.id,
        role: "owner",
      });

    if (memberError) {
      setStatus(
        `Kampania powstała, ale nie udało się dodać właściciela do członków: ${memberError.message}`,
      );
      setIsLoading(false);
      return;
    }

    form.reset();

    setStatus("Kampania online została utworzona.");
    setIsLoading(false);

    await loadCampaigns();
  }

  async function archiveCampaign(campaignId: string) {
    const supabase = createClient();

    const { error } = await supabase
      .from("campaigns")
      .update({
        archived_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    if (error) {
      setStatus(`Nie udało się zarchiwizować kampanii: ${error.message}`);
      return;
    }

    await loadCampaigns();
  }

  async function restoreCampaign(campaignId: string) {
    const supabase = createClient();

    const { error } = await supabase
      .from("campaigns")
      .update({
        archived_at: null,
      })
      .eq("id", campaignId);

    if (error) {
      setStatus(`Nie udało się przywrócić kampanii: ${error.message}`);
      return;
    }

    await loadCampaigns();
  }

  async function deleteCampaign(campaignId: string, campaignName: string) {
    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć kampanię "${campaignName}"? Usunięcie kampanii online usunie też jej przyszłe postacie i rzuty.`,
    );

    if (!confirmed) {
      return;
    }

    const supabase = createClient();

    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", campaignId);

    if (error) {
      setStatus(`Nie udało się usunąć kampanii: ${error.message}`);
      return;
    }

    await loadCampaigns();
  }

  const activeCampaigns = campaigns.filter((campaign) => !campaign.archived_at);
  const archivedCampaigns = campaigns.filter(
    (campaign) => campaign.archived_at,
  );

  return (
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Link href="/" className="text-sm text-neutral-300 underline">
                Wróć do lokalnej strony głównej
              </Link>

              <p className="mt-4 text-sm text-neutral-400">
                D&D Party Manager Online
              </p>

              <h1 className="mt-2 text-4xl font-bold">Kampanie online</h1>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/online/images"
                  className="rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-300 hover:border-neutral-500"
                >
                  Wspólna biblioteka grafik
                </Link>
              </div>
              <p className="mt-2 text-neutral-400">
                To jest pierwsza wersja kampanii zapisanych w Supabase.
              </p>
            </div>

            <AuthPanel />
          </div>
        </header>

        <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <h2 className="text-2xl font-bold">Nowa kampania online</h2>
          <div className="mt-4">
            <Link
              href="/online/join"
              className="inline-flex rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-300 hover:border-neutral-500"
            >
              Dołącz do kampanii przez kod
            </Link>
          </div>
          {!userId ? (
            <p className="mt-4 text-neutral-400">
              Musisz być zalogowany, aby tworzyć kampanie online.
            </p>
          ) : (
            <form onSubmit={createCampaign} className="mt-4 grid gap-3">
              <label className="grid gap-1">
                Nazwa kampanii
                <input
                  name="name"
                  required
                  autoComplete="off"
                  placeholder="np. Klątwa Strahda"
                  className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white caret-white outline-none focus:border-red-700 focus:bg-neutral-800"
                />
              </label>

              <label className="grid gap-1">
                Opis kampanii
                <textarea
                  name="description"
                  placeholder="Krótki opis kampanii"
                  className="min-h-24 rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white caret-white outline-none focus:border-red-700 focus:bg-neutral-800"
                />
              </label>

              <button
                type="submit"
                disabled={isLoading}
                className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
              >
                {isLoading ? "Tworzę..." : "Utwórz kampanię online"}
              </button>
            </form>
          )}

          <p className="mt-4 text-sm text-red-500">{status}</p>
        </section>

        <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <h2 className="text-2xl font-bold">Aktywne kampanie online</h2>

          {activeCampaigns.length === 0 ? (
            <p className="mt-4 text-neutral-400">
              Nie ma aktywnych kampanii online.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {activeCampaigns.map((campaign) => (
                <article
                  key={campaign.id}
                  className="rounded-xl border border-neutral-700 bg-neutral-800 p-4"
                >
                  <h3 className="text-xl font-bold">{campaign.name}</h3>

                  <p className="mt-2 text-sm text-neutral-400">
                    {campaign.description || "Brak opisu."}
                  </p>

                  <p className="mt-4 text-xs text-neutral-500">
                    ID kampanii: {campaign.id}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/online/campaigns/${campaign.id}`}
                      className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-500"
                    >
                      Otwórz lobby
                    </Link>

                    <button
                      type="button"
                      onClick={() => archiveCampaign(campaign.id)}
                      className="rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-400 hover:border-neutral-500"
                    >
                      Archiwizuj
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteCampaign(campaign.id, campaign.name)}
                      className="rounded-lg border border-red-900 px-4 py-2 text-sm font-semibold text-red-400 hover:border-red-700"
                    >
                      Usuń
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <h2 className="text-2xl font-bold">Archiwum online</h2>

          {archivedCampaigns.length === 0 ? (
            <p className="mt-4 text-neutral-400">
              Nie ma zarchiwizowanych kampanii online.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {archivedCampaigns.map((campaign) => (
                <article
                  key={campaign.id}
                  className="rounded-xl border border-neutral-700 bg-neutral-800 p-4 opacity-75"
                >
                  <h3 className="text-xl font-bold">{campaign.name}</h3>

                  <p className="mt-2 text-sm text-neutral-400">
                    {campaign.description || "Brak opisu."}
                  </p>

                  <p className="mt-4 text-xs text-neutral-500">
                    ID kampanii: {campaign.id}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => restoreCampaign(campaign.id)}
                      className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-500"
                    >
                      Przywróć
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteCampaign(campaign.id, campaign.name)}
                      className="rounded-lg border border-red-900 px-4 py-2 text-sm font-semibold text-red-400 hover:border-red-700"
                    >
                      Usuń
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
