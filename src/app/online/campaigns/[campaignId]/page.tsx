"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AuthPanel } from "@/components/AuthPanel";
import { createDefaultOnlineCharacterData } from "@/lib/onlineCharacterTemplate";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
  data: Record<string, unknown>;
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

export default function OnlineCampaignLobbyPage() {
  const params = useParams();
  const campaignId = String(params.campaignId);

  const [campaign, setCampaign] = useState<OnlineCampaign | null>(null);
  const [characters, setCharacters] = useState<OnlineCharacter[]>([]);
  const [diceRolls, setDiceRolls] = useState<DiceRoll[]>([]);
  const [userId, setUserId] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [formula, setFormula] = useState("1d20");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("Ładuję kampanię online...");
  const [realtimeStatus, setRealtimeStatus] = useState(
    "Realtime: łączę z Supabase...",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);

  async function loadCampaignLobby() {
    const supabase = createClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setUserId("");
      setCampaign(null);
      setCharacters([]);
      setDiceRolls([]);
      setStatus("Nie jesteś zalogowany. Zaloguj się, aby widzieć kampanię.");
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
      setDiceRolls([]);
      setStatus(
        `Nie udało się wczytać kampanii: ${
          campaignError?.message ?? "Nie znaleziono kampanii."
        }`,
      );
      return;
    }

    const loadedCampaign = campaignData as OnlineCampaign;
    setCampaign(loadedCampaign);

    const { data: charactersData, error: charactersError } = await supabase
      .from("characters")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (charactersError) {
      setCharacters([]);
      setStatus(`Nie udało się wczytać postaci: ${charactersError.message}`);
      return;
    }

    const loadedCharacters = (charactersData ?? []) as OnlineCharacter[];
    setCharacters(loadedCharacters);

    const selectableCharacters = loadedCharacters.filter(
      (character) =>
        character.owner_id === userData.user.id ||
        loadedCampaign.owner_id === userData.user.id,
    );

    setSelectedCharacterId((currentSelectedCharacterId) => {
      const selectedStillExists = selectableCharacters.some(
        (character) => character.id === currentSelectedCharacterId,
      );

      if (selectedStillExists) {
        return currentSelectedCharacterId;
      }

      return selectableCharacters[0]?.id ?? "";
    });

    const { data: diceRollsData, error: diceRollsError } = await supabase
      .from("dice_rolls")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (diceRollsError) {
      setDiceRolls([]);
      setStatus(`Nie udało się wczytać rzutów: ${diceRollsError.message}`);
      return;
    }

    setDiceRolls((diceRollsData ?? []) as DiceRoll[]);
    setStatus("Kampania online została wczytana.");
  }
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
    loadCampaignLobby();
  }, [campaignId]);

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
            `Realtime: odebrano broadcast ${new Date().toLocaleTimeString(
              "pl-PL",
            )}`,
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

          setRealtimeStatus(
            `Realtime: odebrano rzut ${new Date().toLocaleTimeString("pl-PL")}`,
          );

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
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  async function createOnlineCharacter() {
    setIsLoading(true);
    setStatus("Tworzę nową postać online...");

    const supabase = createClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setStatus("Nie jesteś zalogowany.");
      setIsLoading(false);
      return;
    }

    const { error } = await supabase.from("characters").insert({
      campaign_id: campaignId,
      owner_id: userData.user.id,
      name: "Nowa postać online",
      player_name: "",
      class_name: "Klasa",
      race: "Rasa",
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
    });

    if (error) {
      setStatus(`Nie udało się utworzyć postaci: ${error.message}`);
      setIsLoading(false);
      return;
    }

    setStatus("Nowa postać online została utworzona.");
    setIsLoading(false);

    await loadCampaignLobby();
  }

  async function deleteOnlineCharacter(
    characterId: string,
    characterName: string,
  ) {
    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć postać "${characterName}"?`,
    );

    if (!confirmed) {
      return;
    }

    const supabase = createClient();

    const { error } = await supabase
      .from("characters")
      .delete()
      .eq("id", characterId);

    if (error) {
      setStatus(`Nie udało się usunąć postaci: ${error.message}`);
      return;
    }

    setStatus("Postać została usunięta.");
    await loadCampaignLobby();
  }

  async function makeRoll(rollFormula: string, rollReason?: string) {
    const rollResult = parseAndRollFormula(rollFormula);

    if (!rollResult) {
      setStatus("Niepoprawny zapis rzutu. Użyj np. 1d20, 2d6+3 albo 1d8-1.");
      return;
    }

    setIsRolling(true);
    setStatus("Rzucam kośćmi online...");

    const supabase = createClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setStatus("Nie jesteś zalogowany.");
      setIsRolling(false);
      return;
    }

    const selectedCharacter = characters.find(
      (character) => character.id === selectedCharacterId,
    );

    const { data: insertedRoll, error } = await supabase
      .from("dice_rolls")
      .insert({
        campaign_id: campaignId,
        character_id: selectedCharacter?.id ?? null,
        user_id: userData.user.id,
        character_name: selectedCharacter?.name ?? "Nieznana postać",
        formula: rollFormula,
        reason: rollReason ?? reason,
        rolls: rollResult.rolls,
        modifier: rollResult.modifier,
        total: rollResult.total,
      })
      .select("*")
      .single();

    if (error || !insertedRoll) {
      setStatus(
        `Nie udało się zapisać rzutu online: ${
          error?.message ?? "Brak danych rzutu."
        }`,
      );
      setIsRolling(false);
      return;
    }

    const savedRoll = insertedRoll as DiceRoll;

    addDiceRollToHistory(savedRoll);

    const broadcastResponse = await realtimeChannelRef.current?.send({
      type: "broadcast",
      event: "new-roll",
      payload: {
        roll: savedRoll,
      },
    });

    setRealtimeStatus(
      `Realtime: wysłano broadcast ${
        broadcastResponse === "ok" ? "OK" : String(broadcastResponse)
      }`,
    );

    setStatus("Rzut online został zapisany.");
    setIsRolling(false);
  }

  function handleCustomRoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    makeRoll(formula, reason);
    setReason("");
  }

  const isCampaignOwner = campaign?.owner_id === userId;

  const playableCharacters = characters.filter(
    (character) => character.owner_id === userId || isCampaignOwner,
  );

  return (
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto max-w-5xl">
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
                Lobby kampanii online
              </p>

              <h1 className="mt-2 text-4xl font-bold">
                {campaign?.name ?? "Kampania online"}
              </h1>

              <p className="mt-2 text-neutral-400">
                {campaign?.description || "Brak opisu kampanii."}
              </p>

              {campaign ? (
                <div className="mt-4 grid gap-2">
                  <p className="text-xs text-neutral-500">
                    ID kampanii: {campaign.id}
                  </p>

                  {isCampaignOwner ? (
                    <div className="w-fit rounded-lg border border-red-900 bg-neutral-950 px-4 py-3">
                      <p className="text-xs text-neutral-500">
                        Kod zaproszenia
                      </p>

                      <p className="mt-1 text-2xl font-bold tracking-widest text-red-500">
                        {campaign.invite_code}
                      </p>

                      <p className="mt-1 text-xs text-neutral-500">
                        Podaj ten kod znajomemu, żeby mógł dołączyć przez
                        /online/join.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <AuthPanel />
          </div>
        </header>

        <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Drużyna online</h2>

              <p className="mt-1 text-neutral-400">
                Tutaj są postacie zapisane w Supabase dla tej kampanii.
              </p>
            </div>

            <button
              type="button"
              onClick={createOnlineCharacter}
              disabled={!campaign || !userId || isLoading}
              className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
            >
              {isLoading ? "Tworzę..." : "Nowa postać online"}
            </button>
          </div>

          <p className="mt-4 text-sm text-red-500">{status}</p>

          {characters.length === 0 ? (
            <p className="mt-6 text-neutral-400">
              Nie ma jeszcze żadnych postaci online w tej kampanii.
            </p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {characters.map((character) => (
                <article
                  key={character.id}
                  className="rounded-xl border border-neutral-700 bg-neutral-800 p-4"
                >
                  <h3 className="text-xl font-bold">{character.name}</h3>

                  <p className="mt-1 text-sm text-neutral-400">
                    {character.race || "Rasa"} ·{" "}
                    {character.class_name || "Klasa"} · poziom {character.level}
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-3">
                      <p className="text-neutral-500">HP</p>
                      <p className="text-lg font-bold">
                        {character.hp}/{character.max_hp ?? character.hp}
                      </p>
                    </div>

                    <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-3">
                      <p className="text-neutral-500">KP</p>
                      <p className="text-lg font-bold">
                        {character.armor_class}
                      </p>
                    </div>

                    <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-3">
                      <p className="text-neutral-500">Szyb.</p>
                      <p className="text-lg font-bold">{character.speed}</p>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-neutral-500">
                    Właściciel postaci:{" "}
                    {character.owner_id === userId ? "Ty" : character.owner_id}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/online/campaigns/${campaignId}/play/${character.id}`}
                      className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-500"
                    >
                      Graj online
                    </Link>

                    {character.owner_id === userId || isCampaignOwner ? (
                      <button
                        type="button"
                        onClick={() =>
                          deleteOnlineCharacter(character.id, character.name)
                        }
                        className="rounded-lg border border-red-900 px-4 py-2 text-sm font-semibold text-red-400 hover:border-red-700"
                      >
                        Usuń postać
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-neutral-700 bg-neutral-900 p-6">
            <h2 className="text-2xl font-bold">Rzuty realtime</h2>

            <p className="mt-1 text-sm text-neutral-400">
              Rzuty zapisują się w Supabase i powinny pojawiać się od razu u
              innych graczy w tej kampanii.
            </p>
            <p className="mt-3 rounded-lg border border-neutral-700 bg-neutral-950 p-2 text-xs text-neutral-400">
              {realtimeStatus}
            </p>

            <label className="mt-6 grid gap-1">
              Kto rzuca?
              <select
                value={selectedCharacterId}
                onChange={(event) => setSelectedCharacterId(event.target.value)}
                disabled={playableCharacters.length === 0}
                className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white disabled:text-neutral-500"
              >
                {playableCharacters.length === 0 ? (
                  <option value="">Brak Twoich postaci</option>
                ) : (
                  playableCharacters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <div className="mt-6 grid grid-cols-3 gap-2">
              {["1d4", "1d6", "1d8", "1d10", "1d12", "1d20"].map(
                (diceFormula) => (
                  <button
                    key={diceFormula}
                    type="button"
                    onClick={() => makeRoll(diceFormula)}
                    disabled={isRolling || playableCharacters.length === 0}
                    className="rounded-lg border border-neutral-700 bg-neutral-800 p-3 font-bold text-neutral-200 disabled:cursor-not-allowed disabled:text-neutral-600"
                  >
                    {diceFormula}
                  </button>
                ),
              )}
            </div>

            <form onSubmit={handleCustomRoll} className="mt-6 grid gap-3">
              <label className="grid gap-1">
                Własny rzut
                <input
                  value={formula}
                  onChange={(event) => setFormula(event.target.value)}
                  placeholder="np. 1d20+5"
                  className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white"
                />
              </label>

              <label className="grid gap-1">
                Powód rzutu
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="np. Percepcja, atak, obrażenia"
                  className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white"
                />
              </label>

              <button
                type="submit"
                disabled={isRolling || playableCharacters.length === 0}
                className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
              >
                {isRolling ? "Rzucam..." : "Rzuć online"}
              </button>
            </form>
          </aside>

          <section className="rounded-xl border border-neutral-700 bg-neutral-900 p-6">
            <h2 className="text-2xl font-bold">Historia rzutów online</h2>

            {diceRolls.length === 0 ? (
              <p className="mt-6 text-neutral-400">
                Nie ma jeszcze żadnych rzutów online.
              </p>
            ) : (
              <div className="mt-6 grid max-h-[620px] gap-3 overflow-y-auto pr-2">
                {diceRolls.map((roll) => (
                  <article
                    key={roll.id}
                    className="rounded-xl border border-neutral-700 bg-neutral-800 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="font-bold">
                          {roll.character_name} rzuca {roll.formula}
                        </h3>

                        {roll.reason ? (
                          <p className="text-sm text-neutral-400">
                            Powód: {roll.reason}
                          </p>
                        ) : null}

                        <p className="mt-1 text-sm text-neutral-400">
                          Wyniki kości:{" "}
                          {Array.isArray(roll.rolls)
                            ? roll.rolls.join(", ")
                            : "brak danych"}
                          {roll.modifier !== 0
                            ? ` ${roll.modifier > 0 ? "+" : ""}${roll.modifier}`
                            : ""}
                        </p>

                        <p className="mt-1 text-xs text-neutral-500">
                          {new Date(roll.created_at).toLocaleString("pl-PL")}
                        </p>
                      </div>

                      <p className="text-4xl font-bold text-red-500">
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
