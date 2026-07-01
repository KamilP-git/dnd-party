"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/AuthPanel";
import { createClient } from "@/lib/supabase/client";
import { createDefaultOnlineCharacterData } from "@/lib/onlineCharacterTemplate";

type OnlineCampaign = {
  id: string;
  name: string;
  description: string;
  notes: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
  archived_at: string | null;
};

type OnlineCharacter = {
  id: string;
  campaign_id: string;
  owner_id: string;
  name: string;
  player_name: string;
  class_name: string;
  race: string;
  level: number;
  hp: number;
  max_hp: number | null;
  temporary_hp: number;
  armor_class: number;
  initiative: number;
  speed: number;
  hit_dice: number;
  portrait_url: string;
  description: string;
  data: unknown;
  created_at: string;
  updated_at: string;
};

type DiceRoll = {
  id: string;
  campaign_id: string;
  character_id: string | null;
  user_id: string;
  character_name: string;
  formula: string;
  reason: string;
  rolls: number[];
  modifier: number;
  total: number;
  created_at: string;
};

function rollDie(sides: number) {
  return Math.floor(Math.random() * sides) + 1;
}

function parseAndRollFormula(formula: string) {
  const cleanedFormula = formula.replaceAll(" ", "").toLowerCase();
  const match = cleanedFormula.match(/^(\d*)d(\d+)([+-]\d+)?$/);

  if (!match) {
    return null;
  }

  const diceCount = Number(match[1] || 1);
  const diceSides = Number(match[2]);
  const modifier = Number(match[3] || 0);

  if (diceCount <= 0 || diceSides <= 0 || diceCount > 100) {
    return null;
  }

  const rolls = Array.from({ length: diceCount }, () => rollDie(diceSides));
  const total = rolls.reduce((sum, roll) => sum + roll, 0) + modifier;

  return {
    rolls,
    modifier,
    total,
  };
}

function formatDate(dateText: string) {
  return new Date(dateText).toLocaleString("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function OnlineCampaignLobbyPage() {
  const params = useParams();
  const router = useRouter();

  const campaignId = String(params.campaignId);

  const [campaign, setCampaign] = useState<OnlineCampaign | null>(null);
  const [characters, setCharacters] = useState<OnlineCharacter[]>([]);
  const [diceRolls, setDiceRolls] = useState<DiceRoll[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [formula, setFormula] = useState("1d20");
  const [reason, setReason] = useState("");

  const [status, setStatus] = useState("Ładuję lobby kampanii...");
  const [realtimeStatus, setRealtimeStatus] = useState(
    "Realtime: łączę z Supabase...",
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [isRolling, setIsRolling] = useState(false);

  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  const isCampaignOwner = Boolean(
    campaign && userId && campaign.owner_id === userId,
  );

  const myCharacters = useMemo(() => {
    if (!userId) {
      return [];
    }

    return characters.filter((character) => character.owner_id === userId);
  }, [characters, userId]);

  const otherCharacters = useMemo(() => {
    if (!userId) {
      return characters;
    }

    return characters.filter((character) => character.owner_id !== userId);
  }, [characters, userId]);

  const playableCharacters = useMemo(() => {
    if (isCampaignOwner) {
      return characters;
    }

    return myCharacters;
  }, [characters, myCharacters, isCampaignOwner]);

  async function loadCampaignLobby() {
    setIsLoading(true);
    setStatus("Ładuję lobby kampanii...");

    const supabase = createClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setUserId(null);
      setCampaign(null);
      setCharacters([]);
      setDiceRolls([]);
      setStatus("Musisz być zalogowany, żeby otworzyć kampanię online.");
      setIsLoading(false);
      return;
    }

    setUserId(userData.user.id);

    const { data: campaignData, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaignData) {
      setCampaign(null);
      setCharacters([]);
      setStatus(
        `Nie udało się pobrać kampanii: ${
          campaignError?.message ?? "brak danych"
        }`,
      );
      setIsLoading(false);
      return;
    }

    const { data: characterData, error: characterError } = await supabase
      .from("characters")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true });

    if (characterError) {
      setCampaign(campaignData as OnlineCampaign);
      setCharacters([]);
      setStatus(`Nie udało się pobrać postaci: ${characterError.message}`);
      setIsLoading(false);
      return;
    }

    const loadedCharacters = (characterData ?? []) as OnlineCharacter[];

    const { data: rollData, error: rollError } = await supabase
      .from("dice_rolls")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (rollError) {
      setDiceRolls([]);
    } else {
      setDiceRolls((rollData ?? []) as DiceRoll[]);
    }

    setCampaign(campaignData as OnlineCampaign);
    setCharacters(loadedCharacters);

    const isOwner = campaignData.owner_id === userData.user.id;
    const firstPlayableCharacter = isOwner
      ? loadedCharacters[0]
      : loadedCharacters.find(
          (character) => character.owner_id === userData.user.id,
        );

    setSelectedCharacterId(firstPlayableCharacter?.id ?? "");

    setStatus("Lobby kampanii zostało wczytane.");
    setIsLoading(false);
  }

  useEffect(() => {
    loadCampaignLobby();
  }, [campaignId]);

  function addDiceRollToHistory(newRoll: DiceRoll) {
    setDiceRolls((currentRolls) => {
      const alreadyExists = currentRolls.some((roll) => roll.id === newRoll.id);

      if (alreadyExists) {
        return currentRolls;
      }

      return [newRoll, ...currentRolls].slice(0, 50);
    });
  }

  useEffect(() => {
    const supabase = createClient();

    setRealtimeStatus("Realtime: łączę z Supabase...");

    const channel = supabase
      .channel(`campaign-dice-${campaignId}`, {
        config: {
          broadcast: {
            self: true,
            ack: true,
          },
        },
      })
      .on(
        "broadcast",
        {
          event: "new-roll",
        },
        (payload) => {
          const newRoll = payload.payload?.roll as DiceRoll | undefined;

          if (!newRoll) {
            return;
          }

          if (newRoll.campaign_id !== campaignId) {
            return;
          }

          setRealtimeStatus(
            `Realtime: odebrano rzut ${new Date().toLocaleTimeString("pl-PL")}`,
          );

          addDiceRollToHistory(newRoll);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "dice_rolls",
        },
        (payload) => {
          const newRoll = payload.new as DiceRoll;

          if (newRoll.campaign_id !== campaignId) {
            return;
          }

          addDiceRollToHistory(newRoll);
        },
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === "SUBSCRIBED") {
          realtimeChannelRef.current = channel;
          setRealtimeStatus("Realtime: połączono");
          return;
        }

        if (subscriptionStatus === "CHANNEL_ERROR") {
          setRealtimeStatus("Realtime: błąd kanału");
          return;
        }

        if (subscriptionStatus === "TIMED_OUT") {
          setRealtimeStatus("Realtime: przekroczono czas połączenia");
          return;
        }

        if (subscriptionStatus === "CLOSED") {
          setRealtimeStatus("Realtime: połączenie zamknięte");
          return;
        }

        setRealtimeStatus(`Realtime: ${subscriptionStatus}`);
      });

    return () => {
      realtimeChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [campaignId]);

  async function createOnlineCharacter() {
    if (!userId) {
      setStatus("Musisz być zalogowany, żeby stworzyć postać.");
      return;
    }

    setIsCreatingCharacter(true);
    setStatus("Tworzę Twoją postać online...");

    const supabase = createClient();

    const { data, error } = await supabase
      .from("characters")
      .insert({
        campaign_id: campaignId,
        owner_id: userId,
        name: "Nowa postać online",
        player_name: "",
        class_name: "",
        race: "",
        level: 1,
        hp: 10,
        max_hp: 10,
        temporary_hp: 0,
        armor_class: 10,
        initiative: 0,
        speed: 30,
        hit_dice: 1,
        portrait_url: "",
        description: "",
        data: createDefaultOnlineCharacterData(),
      })
      .select("*")
      .single();

    if (error || !data) {
      setStatus(`Nie udało się stworzyć postaci: ${error?.message}`);
      setIsCreatingCharacter(false);
      return;
    }

    setStatus("Postać została stworzona. Otwieram kartę...");
    setIsCreatingCharacter(false);

    router.push(`/online/campaigns/${campaignId}/play/${data.id}`);
  }

  async function deleteOnlineCharacter(characterIdToDelete: string) {
    const characterToDelete = characters.find(
      (character) => character.id === characterIdToDelete,
    );

    if (!characterToDelete || !userId) {
      return;
    }

    const canDelete =
      characterToDelete.owner_id === userId || campaign?.owner_id === userId;

    if (!canDelete) {
      setStatus("Nie masz uprawnień do usunięcia tej postaci.");
      return;
    }

    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć postać „${characterToDelete.name}”?`,
    );

    if (!confirmed) {
      return;
    }

    setStatus("Usuwam postać...");

    const supabase = createClient();

    const { error } = await supabase
      .from("characters")
      .delete()
      .eq("id", characterIdToDelete)
      .eq("campaign_id", campaignId);

    if (error) {
      setStatus(`Nie udało się usunąć postaci: ${error.message}`);
      return;
    }

    setCharacters((currentCharacters) =>
      currentCharacters.filter(
        (character) => character.id !== characterIdToDelete,
      ),
    );

    if (selectedCharacterId === characterIdToDelete) {
      setSelectedCharacterId("");
    }

    setStatus("Postać została usunięta.");
  }

  async function makeRoll(rollFormula: string, rollReason: string) {
    if (!userId) {
      setStatus("Musisz być zalogowany, żeby rzucać online.");
      return;
    }

    const selectedCharacter = playableCharacters.find(
      (character) => character.id === selectedCharacterId,
    );

    if (!selectedCharacter) {
      setStatus("Najpierw wybierz postać, która wykonuje rzut.");
      return;
    }

    const rollResult = parseAndRollFormula(rollFormula);

    if (!rollResult) {
      setStatus("Niepoprawny zapis rzutu. Użyj np. 1d20, 2d6+3 albo 1d8-1.");
      return;
    }

    setIsRolling(true);
    setStatus("Zapisuję rzut online...");

    const supabase = createClient();

    const { data: insertedRoll, error } = await supabase
      .from("dice_rolls")
      .insert({
        campaign_id: campaignId,
        character_id: selectedCharacter.id,
        user_id: userId,
        character_name: selectedCharacter.name,
        formula: rollFormula,
        reason: rollReason,
        rolls: rollResult.rolls,
        modifier: rollResult.modifier,
        total: rollResult.total,
      })
      .select("*")
      .single();

    if (error || !insertedRoll) {
      setStatus(`Nie udało się zapisać rzutu: ${error?.message}`);
      setIsRolling(false);
      return;
    }

    const savedRoll = insertedRoll as DiceRoll;

    addDiceRollToHistory(savedRoll);

    await realtimeChannelRef.current?.send({
      type: "broadcast",
      event: "new-roll",
      payload: {
        roll: savedRoll,
      },
    });

    setStatus("Rzut online został zapisany.");
    setRealtimeStatus(
      `Realtime: wysłano rzut ${new Date().toLocaleTimeString("pl-PL")}`,
    );
    setIsRolling(false);
  }

  async function handleCustomRoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await makeRoll(formula, reason);

    setReason("");
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <p className="text-neutral-300">{status}</p>
        </div>
      </main>
    );
  }

  if (!campaign) {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
        <div className="mx-auto max-w-6xl rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <p className="text-red-500">{status}</p>

          <Link
            href="/online"
            className="mt-4 inline-block rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-300"
          >
            Wróć do kampanii online
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
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
                Lobby kampanii
              </p>

              <h1 className="mt-2 text-4xl font-bold">{campaign.name}</h1>

              {campaign.description ? (
                <p className="mt-3 max-w-3xl text-neutral-300">
                  {campaign.description}
                </p>
              ) : (
                <p className="mt-3 max-w-3xl text-neutral-400">
                  Brak opisu kampanii.
                </p>
              )}
            </div>

            <AuthPanel />
          </div>
        </header>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <p className="rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-sm text-red-400">
            {status}
          </p>

          <p className="rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-sm text-neutral-400">
            {realtimeStatus}
          </p>
        </div>

        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <article className="rounded-2xl border border-red-950 bg-red-950/20 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-400">
              Postać gracza
            </p>

            <h2 className="mt-3 text-3xl font-bold">Stwórz swoją postać</h2>

            <p className="mt-3 text-neutral-300">
              Każdy gracz powinien stworzyć własną postać. Po stworzeniu od razu
              otworzy się karta postaci online.
            </p>

            <button
              type="button"
              onClick={createOnlineCharacter}
              disabled={isCreatingCharacter}
              className="mt-6 rounded-lg border border-red-700 bg-red-950/40 px-5 py-3 font-semibold text-red-300 hover:bg-red-950 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
            >
              {isCreatingCharacter ? "Tworzę..." : "Stwórz swoją postać"}
            </button>
          </article>

          <article className="rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
            {isCampaignOwner ? (
              <>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-400">
                  Kod zaproszenia
                </p>

                <div className="mt-4 rounded-xl border border-red-900 bg-neutral-950 p-5 text-center">
                  <p className="text-4xl font-black tracking-[0.25em] text-red-300">
                    {campaign.invite_code}
                  </p>
                </div>

                <p className="mt-4 text-sm text-neutral-400">
                  Podaj ten kod graczom. Gracz wchodzi na stronę główną, klika
                  „Dołącz do kampanii” i wpisuje kod.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
                  Status
                </p>

                <h2 className="mt-3 text-2xl font-bold">Jesteś w kampanii</h2>

                <p className="mt-3 text-neutral-400">
                  Możesz stworzyć swoją postać albo otworzyć istniejącą kartę.
                </p>
              </>
            )}
          </article>
        </section>

        <section className="mt-6 rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Twoje postacie</h2>

              <p className="mt-1 text-sm text-neutral-400">
                Te postacie możesz edytować. Właściciel kampanii może zarządzać
                wszystkimi postaciami.
              </p>
            </div>

            <button
              type="button"
              onClick={createOnlineCharacter}
              disabled={isCreatingCharacter}
              className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
            >
              {isCreatingCharacter ? "Tworzę..." : "Nowa postać"}
            </button>
          </div>

          {myCharacters.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-neutral-700 p-8 text-center">
              <p className="text-neutral-400">
                Nie masz jeszcze postaci w tej kampanii.
              </p>

              <button
                type="button"
                onClick={createOnlineCharacter}
                disabled={isCreatingCharacter}
                className="mt-4 rounded-lg border border-red-700 px-5 py-3 font-semibold text-red-500 disabled:text-neutral-600"
              >
                Stwórz pierwszą postać
              </button>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {myCharacters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  campaignId={campaignId}
                  canDelete={
                    character.owner_id === userId ||
                    campaign.owner_id === userId
                  }
                  onDelete={() => deleteOnlineCharacter(character.id)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
          <h2 className="text-2xl font-bold">Postacie w kampanii</h2>

          <p className="mt-1 text-sm text-neutral-400">
            Lista wszystkich widocznych postaci w tej kampanii.
          </p>

          {characters.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-neutral-700 p-6 text-center text-neutral-400">
              W kampanii nie ma jeszcze żadnych postaci.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {otherCharacters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  campaignId={campaignId}
                  canDelete={
                    character.owner_id === userId ||
                    campaign.owner_id === userId
                  }
                  onDelete={() => deleteOnlineCharacter(character.id)}
                />
              ))}

              {otherCharacters.length === 0 ? (
                <p className="rounded-xl border border-neutral-700 bg-neutral-950 p-5 text-neutral-400">
                  Nie ma jeszcze postaci innych graczy.
                </p>
              ) : null}
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
            <h2 className="text-2xl font-bold">Rzuty realtime</h2>

            <p className="mt-2 text-sm text-neutral-400">
              Rzuty z lobby i z kart postaci trafiają do tej samej historii.
            </p>

            {playableCharacters.length === 0 ? (
              <p className="mt-5 rounded-xl border border-neutral-700 bg-neutral-950 p-4 text-sm text-neutral-400">
                Najpierw stwórz postać, żeby rzucać.
              </p>
            ) : (
              <form onSubmit={handleCustomRoll} className="mt-5 grid gap-4">
                <label className="grid gap-1 text-sm">
                  Kto rzuca?
                  <select
                    value={selectedCharacterId}
                    onChange={(event) =>
                      setSelectedCharacterId(event.target.value)
                    }
                    className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
                  >
                    {playableCharacters.map((character) => (
                      <option key={character.id} value={character.id}>
                        {character.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {["1d4", "1d6", "1d8", "1d10", "1d12", "1d20"].map(
                    (quickFormula) => (
                      <button
                        key={quickFormula}
                        type="button"
                        disabled={isRolling}
                        onClick={() => makeRoll(quickFormula, reason)}
                        className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-3 text-sm font-bold hover:border-red-700 disabled:text-neutral-600"
                      >
                        {quickFormula}
                      </button>
                    ),
                  )}
                </div>

                <label className="grid gap-1 text-sm">
                  Własny rzut
                  <input
                    value={formula}
                    onChange={(event) => setFormula(event.target.value)}
                    placeholder="np. 1d20+5"
                    className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  Powód rzutu
                  <input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="np. Percepcja, atak, obrażenia"
                    className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isRolling}
                  className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
                >
                  {isRolling ? "Rzucam..." : "Rzuć online"}
                </button>
              </form>
            )}
          </aside>

          <section className="rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
            <h2 className="text-2xl font-bold">Historia rzutów online</h2>

            {diceRolls.length === 0 ? (
              <p className="mt-5 text-neutral-400">
                Nie ma jeszcze żadnych rzutów online.
              </p>
            ) : (
              <div className="mt-5 grid gap-3">
                {diceRolls.map((roll) => (
                  <article
                    key={roll.id}
                    className="rounded-xl border border-neutral-700 bg-neutral-800 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold">
                          {roll.character_name} rzuca {roll.formula}
                        </p>

                        {roll.reason ? (
                          <p className="mt-1 text-sm text-neutral-400">
                            {roll.reason}
                          </p>
                        ) : null}

                        <p className="mt-1 text-xs text-neutral-500">
                          Kości: {roll.rolls.join(", ")}
                          {roll.modifier !== 0
                            ? ` ${roll.modifier > 0 ? "+" : ""}${roll.modifier}`
                            : ""}
                        </p>

                        <p className="mt-1 text-xs text-neutral-600">
                          {formatDate(roll.created_at)}
                        </p>
                      </div>

                      <p className="text-4xl font-black text-red-500">
                        {roll.total}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function CharacterCard({
  character,
  campaignId,
  canDelete,
  onDelete,
}: {
  character: OnlineCharacter;
  campaignId: string;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-xl border border-neutral-700 bg-neutral-800 p-4">
      <div className="flex gap-4">
        <div className="h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-neutral-700 bg-neutral-950">
          {character.portrait_url ? (
            <img
              src={character.portrait_url}
              alt={character.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl">
              🧙
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl font-bold">{character.name}</h3>

          <p className="mt-1 text-sm text-neutral-400">
            {character.race || "Rasa"} · {character.class_name || "Klasa"} ·
            poziom {character.level}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-2">
              <p className="text-xs text-neutral-500">HP</p>
              <p className="font-bold">
                {character.hp}/{character.max_hp ?? character.hp}
              </p>
            </div>

            <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-2">
              <p className="text-xs text-neutral-500">KP</p>
              <p className="font-bold">{character.armor_class}</p>
            </div>

            <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-2">
              <p className="text-xs text-neutral-500">Szyb.</p>
              <p className="font-bold">{character.speed}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/online/campaigns/${campaignId}/play/${character.id}`}
          className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-500"
        >
          Graj online
        </Link>

        {canDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg border border-red-900 px-4 py-2 text-sm font-semibold text-red-400"
          >
            Usuń postać
          </button>
        ) : null}
      </div>
    </article>
  );
}
