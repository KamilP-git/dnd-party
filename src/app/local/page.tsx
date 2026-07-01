"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthPanel } from "@/components/AuthPanel";

type Campaign = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  archivedAt?: string | null;
};

type Character = {
  id: string;
  name: string;
  playerName: string;
  className: string;
  race: string;
  level: number;
  hp: number;
  armorClass: number;
  description: string;
  campaignIds?: string[];
};

type AppBackup = {
  app: "dnd-party-manager";
  version: number;
  exportedAt: string;
  data: Record<string, string>;
};

function createCampaignId(name: string) {
  const normalizedName = name
    .trim()
    .toLowerCase()
    .replaceAll(" ", "-")
    .replace(/[^a-z0-9-]/g, "");

  if (!normalizedName) {
    return crypto.randomUUID();
  }

  return normalizedName;
}

function getDefaultCampaigns(): Campaign[] {
  return [
    {
      id: "main",
      name: "Kampania główna",
      description: "Domyślna kampania testowa.",
      createdAt: new Date().toISOString(),
      archivedAt: null,
    },
  ];
}

function isAppStorageKey(key: string) {
  return (
    key === "dnd-campaigns" ||
    key === "dnd-characters" ||
    key.startsWith("dnd-rolls-")
  );
}

function getBackupFileName() {
  const date = new Date().toISOString().slice(0, 10);

  return `dnd-party-manager-backup-${date}.json`;
}

export default function HomePage() {
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    const campaignsJson = localStorage.getItem("dnd-campaigns");

    if (!campaignsJson) {
      const defaultCampaigns = getDefaultCampaigns();

      localStorage.setItem("dnd-campaigns", JSON.stringify(defaultCampaigns));
      localStorage.setItem("dnd-characters", JSON.stringify([]));
      setCampaigns(defaultCampaigns);

      return;
    }

    const savedCampaigns = JSON.parse(campaignsJson) as Campaign[];
    setCampaigns(savedCampaigns);
  }, []);

  function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("campaign-name") || "").trim();
    const description = String(formData.get("description") || "").trim();

    if (!name) {
      return;
    }

    const baseId = createCampaignId(name);

    const alreadyExists = campaigns.some((campaign) => campaign.id === baseId);

    const campaignId = alreadyExists
      ? `${baseId}-${crypto.randomUUID().slice(0, 8)}`
      : baseId;

    const newCampaign: Campaign = {
      id: campaignId,
      name,
      description,
      createdAt: new Date().toISOString(),
      archivedAt: null,
    };

    const updatedCampaigns = [...campaigns, newCampaign];

    localStorage.setItem("dnd-campaigns", JSON.stringify(updatedCampaigns));
    setCampaigns(updatedCampaigns);

    router.push(`/campaigns/${newCampaign.id}`);
  }

  function archiveCampaign(campaignId: string) {
    const updatedCampaigns = campaigns.map((campaign) => {
      if (campaign.id !== campaignId) {
        return campaign;
      }

      return {
        ...campaign,
        archivedAt: new Date().toISOString(),
      };
    });

    localStorage.setItem("dnd-campaigns", JSON.stringify(updatedCampaigns));
    setCampaigns(updatedCampaigns);
  }

  function restoreCampaign(campaignId: string) {
    const updatedCampaigns = campaigns.map((campaign) => {
      if (campaign.id !== campaignId) {
        return campaign;
      }

      return {
        ...campaign,
        archivedAt: null,
      };
    });

    localStorage.setItem("dnd-campaigns", JSON.stringify(updatedCampaigns));
    setCampaigns(updatedCampaigns);
  }

  function deleteCampaign(campaignIdToDelete: string, campaignName: string) {
    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć kampanię "${campaignName}"? Historia rzutów tej kampanii zostanie usunięta. Postacie zostaną zachowane, ale będą odpięte od tej kampanii.`,
    );

    if (!confirmed) {
      return;
    }

    const updatedCampaigns = campaigns.filter(
      (campaign) => campaign.id !== campaignIdToDelete,
    );

    localStorage.setItem("dnd-campaigns", JSON.stringify(updatedCampaigns));
    setCampaigns(updatedCampaigns);

    localStorage.removeItem(`dnd-rolls-${campaignIdToDelete}`);

    const charactersJson = localStorage.getItem("dnd-characters");

    const savedCharacters: Character[] = charactersJson
      ? JSON.parse(charactersJson)
      : [];

    const updatedCharacters = savedCharacters.map((character) => {
      const currentCampaignIds = character.campaignIds ?? ["main"];

      return {
        ...character,
        campaignIds: currentCampaignIds.filter(
          (campaignId) => campaignId !== campaignIdToDelete,
        ),
      };
    });

    localStorage.setItem("dnd-characters", JSON.stringify(updatedCharacters));
  }

  function exportAppData() {
    const data: Record<string, string> = {};

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);

      if (!key || !isAppStorageKey(key)) {
        continue;
      }

      const value = localStorage.getItem(key);

      if (value !== null) {
        data[key] = value;
      }
    }

    if (!data["dnd-campaigns"]) {
      data["dnd-campaigns"] = JSON.stringify(campaigns);
    }

    if (!data["dnd-characters"]) {
      data["dnd-characters"] = JSON.stringify([]);
    }

    const backup: AppBackup = {
      app: "dnd-party-manager",
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };

    const backupJson = JSON.stringify(backup, null, 2);
    const blob = new Blob([backupJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement("a");

    downloadLink.href = url;
    downloadLink.download = getBackupFileName();
    downloadLink.click();

    URL.revokeObjectURL(url);
  }

  async function importAppData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const fileText = await file.text();
      const parsedBackup = JSON.parse(fileText) as Partial<AppBackup>;

      if (
        !parsedBackup ||
        parsedBackup.app !== "dnd-party-manager" ||
        typeof parsedBackup.data !== "object" ||
        parsedBackup.data === null ||
        typeof parsedBackup.data["dnd-campaigns"] !== "string"
      ) {
        alert("To nie wygląda jak poprawna kopia zapasowa tej aplikacji.");
        return;
      }

      const confirmed = window.confirm(
        "Czy na pewno chcesz zaimportować tę kopię zapasową? Obecne kampanie, postacie i historie rzutów zostaną zastąpione danymi z pliku.",
      );

      if (!confirmed) {
        return;
      }

      const keysToRemove: string[] = [];

      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);

        if (key && isAppStorageKey(key)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => {
        localStorage.removeItem(key);
      });

      Object.entries(parsedBackup.data).forEach(([key, value]) => {
        if (isAppStorageKey(key) && typeof value === "string") {
          localStorage.setItem(key, value);
        }
      });

      if (!localStorage.getItem("dnd-characters")) {
        localStorage.setItem("dnd-characters", JSON.stringify([]));
      }

      const importedCampaignsJson = localStorage.getItem("dnd-campaigns");
      const importedCampaigns: Campaign[] = importedCampaignsJson
        ? JSON.parse(importedCampaignsJson)
        : [];

      setCampaigns(importedCampaigns);

      alert("Import zakończony. Dane zostały przywrócone.");
    } catch {
      alert("Nie udało się zaimportować pliku. Sprawdź, czy to poprawny JSON.");
    } finally {
      event.target.value = "";
    }
  }

  const activeCampaigns = campaigns.filter((campaign) => !campaign.archivedAt);

  const archivedCampaigns = campaigns.filter((campaign) => campaign.archivedAt);

  return (
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm text-neutral-400">D&D Party Manager</p>

              <h1 className="mt-2 text-4xl font-bold">Twoje kampanie</h1>

              <p className="mt-2 text-neutral-400">
                Wybierz kampanię, utwórz nową albo kontynuuj grę istniejącą
                postacią.
              </p>
            </div>

            <AuthPanel />
          </div>
        </header>

        <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <h2 className="text-2xl font-bold">Nowa kampania</h2>

          <form
            onSubmit={createCampaign}
            autoComplete="off"
            className="mt-4 grid gap-3"
          >
            <label className="grid gap-1">
              Nazwa kampanii
              <input
                name="campaign-name"
                required
                autoComplete="new-password"
                placeholder="np. Klątwa Strahda, Kontynuacja Ardena"
                className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white caret-white outline-none focus:border-red-700 focus:bg-neutral-800"
              />
            </label>

            <label className="grid gap-1">
              Opis kampanii
              <textarea
                name="description"
                autoComplete="off"
                placeholder="Krótki opis kampanii, opcjonalnie"
                className="min-h-24 rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white caret-white outline-none focus:border-red-700 focus:bg-neutral-800"
              />
            </label>

            <button
              type="submit"
              className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500"
            >
              Utwórz kampanię
            </button>
          </form>
        </section>

        <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <h2 className="text-2xl font-bold">Kopia zapasowa</h2>

          <p className="mt-2 text-neutral-400">
            Eksport zapisze kampanie, postacie, notatki i historie rzutów do
            pliku JSON. Import przywróci dane z takiego pliku.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={exportAppData}
              className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-500"
            >
              Eksportuj dane
            </button>

            <label
              htmlFor="backup-import"
              className="rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-300 hover:border-neutral-500"
            >
              Importuj dane
            </label>

            <input
              id="backup-import"
              type="file"
              accept="application/json,.json"
              onChange={importAppData}
              className="sr-only"
            />
          </div>

          <p className="mt-3 text-xs text-neutral-500">
            Uwaga: kopia zapasowa zapisuje dane z localStorage. Jeśli używasz
            własnych obrazków w folderze public, same pliki obrazów trzeba
            skopiować osobno.
          </p>
        </section>

        <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <h2 className="text-2xl font-bold">Aktywne kampanie</h2>

          {activeCampaigns.length === 0 ? (
            <p className="mt-4 text-neutral-400">Nie ma aktywnych kampanii.</p>
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
                      href={`/campaigns/${campaign.id}`}
                      className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-500"
                    >
                      Otwórz kampanię
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
                      Usuń kampanię
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <h2 className="text-2xl font-bold">Archiwum kampanii</h2>

          {archivedCampaigns.length === 0 ? (
            <p className="mt-4 text-neutral-400">
              Nie ma zarchiwizowanych kampanii.
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
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-300"
                    >
                      Podejrzyj
                    </Link>

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
                      Usuń kampanię
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
