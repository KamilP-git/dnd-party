"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type OnlineCampaign = {
  id: string;
  name: string;
  description: string;
  notes: string;
  owner_id: string;
  created_at: string;
  archived_at: string | null;
};

export default function SupabaseDbTestPage() {
  const [status, setStatus] = useState("Sprawdzam bazę...");
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [campaigns, setCampaigns] = useState<OnlineCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  async function loadData() {
    const supabase = createClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setStatus("Nie jesteś zalogowany. Najpierw zaloguj się na /auth.");
      setUserEmail("");
      setUserId("");
      setCampaigns([]);
      return;
    }

    setUserEmail(userData.user.email ?? "");
    setUserId(userData.user.id);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profileData) {
      setStatus(
        `Błąd profilu użytkownika: ${
          profileError?.message ?? "Nie znaleziono profilu."
        }`,
      );
      return;
    }

    const { data: campaignsData, error: campaignsError } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (campaignsError) {
      setStatus(`Błąd pobierania kampanii: ${campaignsError.message}`);
      return;
    }

    setCampaigns((campaignsData ?? []) as OnlineCampaign[]);
    setStatus("Baza działa. Możesz tworzyć i odczytywać kampanie online.");
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createTestCampaign() {
    setIsLoading(true);
    setStatus("Tworzę testową kampanię online...");

    const supabase = createClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setStatus("Nie jesteś zalogowany. Najpierw zaloguj się na /auth.");
      setIsLoading(false);
      return;
    }

    const { data: newCampaign, error: campaignError } = await supabase
      .from("campaigns")
      .insert({
        name: "Testowa kampania online",
        description: "Kampania utworzona z testu Supabase.",
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
        `Kampania powstała, ale nie udało się dodać członkostwa: ${memberError.message}`,
      );
      setIsLoading(false);
      return;
    }

    setStatus("Utworzono testową kampanię online.");
    setIsLoading(false);

    await loadData();
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm text-neutral-300 underline">
          Wróć do strony głównej
        </Link>

        <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <h1 className="text-3xl font-bold">Test bazy Supabase</h1>

          <p className="mt-4 text-red-500">{status}</p>

          {userEmail ? (
            <div className="mt-4 rounded-lg border border-neutral-700 bg-neutral-950 p-4 text-sm text-neutral-300">
              <p>
                Zalogowany jako:{" "}
                <span className="font-semibold text-white">{userEmail}</span>
              </p>

              <p className="mt-1 text-xs text-neutral-500">
                ID użytkownika: {userId}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={createTestCampaign}
            disabled={isLoading}
            className="mt-6 rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
          >
            {isLoading ? "Tworzę..." : "Utwórz testową kampanię online"}
          </button>
        </section>

        <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <h2 className="text-2xl font-bold">Kampanie z Supabase</h2>

          {campaigns.length === 0 ? (
            <p className="mt-4 text-neutral-400">
              Nie ma jeszcze kampanii online widocznych dla tego użytkownika.
            </p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {campaigns.map((campaign) => (
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

                  <p className="mt-1 text-xs text-neutral-500">
                    Owner ID: {campaign.owner_id}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
