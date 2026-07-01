"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CharacterCard } from "@/components/CharacterCard";
import { EditableText } from "@/components/EditableText";

type CampaignTab = "party" | "dice" | "notes";

type Campaign = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  archivedAt?: string | null;
  notes?: string;
};

type CharacterStats = {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
};

type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  description: string;
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
  inventory?: InventoryItem[];
  stats?: CharacterStats;
  campaignIds?: string[];
};

function getCharacterCampaignIds(character: Character) {
  if (character.campaignIds) {
    return character.campaignIds;
  }

  return ["main"];
}

type DiceRoll = {
  id: string;
  campaignId: string;
  characterName: string;
  formula: string;
  reason: string;
  rolls: number[];
  modifier: number;
  total: number;
  createdAt: string;
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

export default function CampaignPage() {
  const params = useParams();
  const campaignId = String(params.campaignId);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<CampaignTab>("party");
  const [characters, setCharacters] = useState<Character[]>([]);
  const [allCharacters, setAllCharacters] = useState<Character[]>([]);
  const [isAttachCharacterOpen, setIsAttachCharacterOpen] = useState(false);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [diceRolls, setDiceRolls] = useState<DiceRoll[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [formula, setFormula] = useState("1d20");
  const [reason, setReason] = useState("");

  useEffect(() => {
    const campaignsJson = localStorage.getItem("dnd-campaigns");

    const savedCampaigns: Campaign[] = campaignsJson
      ? JSON.parse(campaignsJson)
      : [];

    const foundCampaign = savedCampaigns.find(
      (savedCampaign) => savedCampaign.id === campaignId,
    );

    if (foundCampaign) {
      setCampaign(foundCampaign);
    } else {
      const fallbackCampaign: Campaign = {
        id: campaignId,
        name: campaignId,
        description: "",
        createdAt: new Date().toISOString(),
      };

      const updatedCampaigns = [...savedCampaigns, fallbackCampaign];

      localStorage.setItem("dnd-campaigns", JSON.stringify(updatedCampaigns));
      setCampaign(fallbackCampaign);
    }

    const charactersJson = localStorage.getItem("dnd-characters");

    const savedCharacters: Character[] = charactersJson
      ? JSON.parse(charactersJson)
      : [];

    const normalizedCharacters = savedCharacters.map((character) => ({
      ...character,
      campaignIds: getCharacterCampaignIds(character),
    }));

    localStorage.setItem(
      "dnd-characters",
      JSON.stringify(normalizedCharacters),
    );

    setAllCharacters(normalizedCharacters);

    const campaignCharacters = normalizedCharacters.filter((character) =>
      getCharacterCampaignIds(character).includes(campaignId),
    );

    setCharacters(campaignCharacters);

    if (campaignCharacters.length > 0) {
      setSelectedCharacterId(campaignCharacters[0].id);
    } else {
      setSelectedCharacterId("");
    }

    const rollsJson = localStorage.getItem(`dnd-rolls-${campaignId}`);
    const savedRolls: DiceRoll[] = rollsJson ? JSON.parse(rollsJson) : [];
    setDiceRolls(savedRolls);
  }, [campaignId]);

  function updateCampaignTextField(
    field: "name" | "description",
    value: string,
  ) {
    if (!campaign) {
      return;
    }

    const nextValue = field === "name" ? value.trim() : value;

    if (field === "name" && !nextValue) {
      return;
    }

    const campaignsJson = localStorage.getItem("dnd-campaigns");

    const savedCampaigns: Campaign[] = campaignsJson
      ? JSON.parse(campaignsJson)
      : [];

    const updatedCampaign: Campaign = {
      ...campaign,
      [field]: nextValue,
    };

    const updatedCampaigns = savedCampaigns.map((savedCampaign) => {
      if (savedCampaign.id === campaignId) {
        return updatedCampaign;
      }

      return savedCampaign;
    });

    localStorage.setItem("dnd-campaigns", JSON.stringify(updatedCampaigns));
    setCampaign(updatedCampaign);
  }

  function updateCampaignNotes(value: string) {
    if (!campaign) {
      return;
    }

    const campaignsJson = localStorage.getItem("dnd-campaigns");

    const savedCampaigns: Campaign[] = campaignsJson
      ? JSON.parse(campaignsJson)
      : [];

    const updatedCampaign: Campaign = {
      ...campaign,
      notes: value,
    };

    const updatedCampaigns = savedCampaigns.map((savedCampaign) => {
      if (savedCampaign.id === campaignId) {
        return updatedCampaign;
      }

      return savedCampaign;
    });

    localStorage.setItem("dnd-campaigns", JSON.stringify(updatedCampaigns));
    setCampaign(updatedCampaign);
  }

  function createEmptyCharacter() {
    const newCharacter: Character = {
      id: crypto.randomUUID(),
      name: "Nowa postać",
      playerName: "",
      className: "Klasa",
      race: "Rasa",
      level: 1,
      hp: 10,
      armorClass: 10,
      description: "",
      inventory: [],
      stats: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      campaignIds: [campaignId],
    };

    const charactersJson = localStorage.getItem("dnd-characters");

    const savedCharacters: Character[] = charactersJson
      ? JSON.parse(charactersJson)
      : [];

    const updatedCharacters = [...savedCharacters, newCharacter];

    localStorage.setItem("dnd-characters", JSON.stringify(updatedCharacters));

    setAllCharacters(updatedCharacters);

    const campaignCharacters = updatedCharacters.filter((character) =>
      getCharacterCampaignIds(character).includes(campaignId),
    );

    setCharacters(campaignCharacters);
    setSelectedCharacterId(newCharacter.id);

    router.push(`/campaigns/${campaignId}/play/${newCharacter.id}`);
  }

  function attachExistingCharacter(characterIdToAttach: string) {
    const updatedCharacters = allCharacters.map((character) => {
      if (character.id !== characterIdToAttach) {
        return character;
      }

      const currentCampaignIds = getCharacterCampaignIds(character);

      return {
        ...character,
        campaignIds: currentCampaignIds.includes(campaignId)
          ? currentCampaignIds
          : [...currentCampaignIds, campaignId],
      };
    });

    localStorage.setItem("dnd-characters", JSON.stringify(updatedCharacters));
    setAllCharacters(updatedCharacters);

    const campaignCharacters = updatedCharacters.filter((character) =>
      getCharacterCampaignIds(character).includes(campaignId),
    );

    setCharacters(campaignCharacters);
    setSelectedCharacterId(characterIdToAttach);
    setIsAttachCharacterOpen(false);

    router.push(`/campaigns/${campaignId}/play/${characterIdToAttach}`);
  }

  function detachCharacterFromCampaign(
    characterIdToDetach: string,
    characterName: string,
  ) {
    const confirmed = window.confirm(
      `Czy na pewno chcesz odpiąć postać "${characterName}" od tej kampanii? Postać nie zostanie usunięta.`,
    );

    if (!confirmed) {
      return;
    }

    const updatedCharacters = allCharacters.map((character) => {
      if (character.id !== characterIdToDetach) {
        return character;
      }

      const currentCampaignIds = getCharacterCampaignIds(character);

      return {
        ...character,
        campaignIds: currentCampaignIds.filter(
          (currentCampaignId) => currentCampaignId !== campaignId,
        ),
      };
    });

    localStorage.setItem("dnd-characters", JSON.stringify(updatedCharacters));
    setAllCharacters(updatedCharacters);

    const campaignCharacters = updatedCharacters.filter((character) =>
      getCharacterCampaignIds(character).includes(campaignId),
    );

    setCharacters(campaignCharacters);

    setSelectedCharacterId((currentSelectedCharacterId) => {
      const selectedCharacterStillExists = campaignCharacters.some(
        (character) => character.id === currentSelectedCharacterId,
      );

      if (selectedCharacterStillExists) {
        return currentSelectedCharacterId;
      }

      return campaignCharacters[0]?.id ?? "";
    });
  }

  function deleteCharacterForever(
    characterIdToDelete: string,
    characterName: string,
  ) {
    const confirmed = window.confirm(
      `Czy na pewno chcesz całkowicie usunąć postać "${characterName}"? Tej operacji nie można cofnąć.`,
    );

    if (!confirmed) {
      return;
    }

    const updatedCharacters = allCharacters.filter(
      (character) => character.id !== characterIdToDelete,
    );

    localStorage.setItem("dnd-characters", JSON.stringify(updatedCharacters));
    setAllCharacters(updatedCharacters);

    const campaignCharacters = updatedCharacters.filter((character) =>
      getCharacterCampaignIds(character).includes(campaignId),
    );

    setCharacters(campaignCharacters);

    setSelectedCharacterId((currentSelectedCharacterId) => {
      const selectedCharacterStillExists = campaignCharacters.some(
        (character) => character.id === currentSelectedCharacterId,
      );

      if (selectedCharacterStillExists) {
        return currentSelectedCharacterId;
      }

      return campaignCharacters[0]?.id ?? "";
    });
  }

  function saveRolls(updatedRolls: DiceRoll[]) {
    localStorage.setItem(
      `dnd-rolls-${campaignId}`,
      JSON.stringify(updatedRolls),
    );

    setDiceRolls(updatedRolls);
  }

  function makeRoll(rollFormula: string, rollReason?: string) {
    const rollResult = parseAndRollFormula(rollFormula);

    if (!rollResult) {
      alert("Niepoprawny zapis rzutu. Użyj np. 1d20, 2d6+3 albo 1d8-1.");
      return;
    }

    const selectedCharacter = characters.find(
      (character) => character.id === selectedCharacterId,
    );

    const newRoll: DiceRoll = {
      id: crypto.randomUUID(),
      campaignId,
      characterName: selectedCharacter?.name || "Nieznana postać",
      formula: rollFormula,
      reason: rollReason || reason,
      rolls: rollResult.rolls,
      modifier: rollResult.modifier,
      total: rollResult.total,
      createdAt: new Date().toISOString(),
    };

    saveRolls([newRoll, ...diceRolls]);
  }

  function handleCustomRoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    makeRoll(formula, reason);
    setReason("");
  }

  function getTabButtonClass(tab: CampaignTab) {
    const baseClass =
      "rounded-lg border bg-neutral-900 p-3 font-semibold transition";

    if (activeTab === tab) {
      return `${baseClass} border-red-700 text-red-500`;
    }

    return `${baseClass} border-neutral-700 text-neutral-300 hover:border-neutral-500`;
  }

  const attachableCharacters = allCharacters.filter(
    (character) => !getCharacterCampaignIds(character).includes(campaignId),
  );

  return (
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-sm text-neutral-300 underline">
          Wróć do strony głównej
        </Link>

        <header className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <p className="text-sm text-neutral-400">Kampania</p>

          <EditableText
            value={campaign?.name ?? campaignId}
            onSave={(value) => updateCampaignTextField("name", value)}
            className="mt-2 block w-full rounded-lg border border-transparent bg-transparent p-0 text-left text-4xl font-bold hover:border-neutral-700 hover:bg-neutral-800"
            inputClassName="mt-2 w-full rounded-lg border border-red-700 bg-neutral-800 p-3 text-4xl font-bold"
          />

          <EditableText
            value={
              campaign?.description ||
              "Tutaj są wspólne elementy kampanii: drużyna, rzuty, notatki i sesja."
            }
            multiline
            onSave={(value) => updateCampaignTextField("description", value)}
            className="mt-2 block min-h-12 w-full whitespace-pre-wrap rounded-lg border border-transparent bg-transparent p-0 text-left text-neutral-400 hover:border-neutral-700 hover:bg-neutral-800 hover:p-3"
            inputClassName="mt-2 min-h-24 w-full rounded-lg border border-red-700 bg-neutral-800 p-3 text-neutral-200"
          />

          <p className="mt-4 text-xs text-neutral-500">
            ID kampanii: {campaignId}
          </p>

          <p className="mt-2 text-xs text-neutral-600">
            Podwójny klik w nazwę lub opis pozwala edytować kampanię.
          </p>
        </header>

        <nav className="mt-6 grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setActiveTab("party")}
            className={getTabButtonClass("party")}
          >
            Drużyna
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("dice")}
            className={getTabButtonClass("dice")}
          >
            Rzuty
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("notes")}
            className={getTabButtonClass("notes")}
          >
            Notatki
          </button>
        </nav>

        {activeTab === "party" ? (
          <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Drużyna</h2>

                <p className="mt-1 text-neutral-400">
                  Postacie przypisane do tej kampanii.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={createEmptyCharacter}
                  className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500"
                >
                  Nowa postać
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setIsAttachCharacterOpen(!isAttachCharacterOpen)
                  }
                  className="rounded-lg border border-neutral-700 px-4 py-2 font-semibold text-neutral-300"
                >
                  Dodaj istniejącą postać
                </button>
              </div>
            </div>

            {isAttachCharacterOpen ? (
              <div className="mt-6 rounded-xl border border-neutral-700 bg-neutral-950 p-4">
                <h3 className="text-lg font-bold">
                  Dodaj istniejącą postać do kampanii
                </h3>

                {attachableCharacters.length === 0 ? (
                  <p className="mt-3 text-neutral-400">
                    Brak postaci, które można dodać do tej kampanii.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {attachableCharacters.map((character) => (
                      <article
                        key={character.id}
                        className="rounded-lg border border-neutral-700 bg-neutral-900 p-4"
                      >
                        <h4 className="text-lg font-bold">{character.name}</h4>

                        <p className="mt-1 text-sm text-neutral-400">
                          {character.race} · {character.className} · poziom{" "}
                          {character.level}
                        </p>

                        {character.playerName ? (
                          <p className="mt-1 text-sm text-neutral-500">
                            Gracz: {character.playerName}
                          </p>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => attachExistingCharacter(character.id)}
                          className="mt-4 rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-500"
                        >
                          Dodaj do tej kampanii
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {characters.length === 0 ? (
              <p className="mt-6 text-neutral-400">
                Nie ma jeszcze żadnych postaci.
              </p>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {characters.map((character) => (
                  <article
                    key={character.id}
                    className="rounded-xl border border-neutral-700 bg-neutral-800 p-4"
                  >
                    <Link
                      href={`/campaigns/${campaignId}/play/${character.id}`}
                    >
                      <CharacterCard
                        name={character.name}
                        playerName={character.playerName}
                        className={character.className}
                        race={character.race}
                        level={character.level}
                        hp={character.hp}
                        armorClass={character.armorClass}
                      />
                    </Link>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Link
                        href={`/campaigns/${campaignId}/play/${character.id}`}
                        className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-500"
                      >
                        Graj tą postacią
                      </Link>

                      <button
                        type="button"
                        onClick={() =>
                          detachCharacterFromCampaign(
                            character.id,
                            character.name,
                          )
                        }
                        className="rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-400 hover:border-neutral-500"
                      >
                        Odepnij od kampanii
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          deleteCharacterForever(character.id, character.name)
                        }
                        className="rounded-lg border border-red-900 px-4 py-2 text-sm font-semibold text-red-400 hover:border-red-700"
                      >
                        Usuń postać
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {activeTab === "dice" ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_3fr]">
            <aside className="rounded-xl border border-neutral-700 bg-neutral-900 p-6">
              <h2 className="text-2xl font-bold">Panel rzutów</h2>

              <label className="mt-6 grid gap-1">
                Kto rzuca?
                <select
                  value={selectedCharacterId}
                  onChange={(event) =>
                    setSelectedCharacterId(event.target.value)
                  }
                  className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
                >
                  {characters.length === 0 ? (
                    <option>Brak postaci</option>
                  ) : (
                    characters.map((character) => (
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
                      className="rounded-lg border border-neutral-700 bg-neutral-800 p-3 font-bold"
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
                    className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
                  />
                </label>

                <label className="grid gap-1">
                  Powód rzutu
                  <input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="np. Perception, atak, obrażenia"
                    className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
                  />
                </label>

                <button
                  type="submit"
                  disabled={characters.length === 0}
                  className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
                >
                  Rzuć
                </button>
              </form>
            </aside>

            <section className="rounded-xl border border-neutral-700 bg-neutral-900 p-6">
              <h2 className="text-2xl font-bold">Wspólna historia rzutów</h2>

              <p className="mt-1 text-neutral-400">
                Docelowo wszyscy gracze w kampanii będą widzieć te rzuty na żywo
                przez Supabase Realtime.
              </p>

              {diceRolls.length === 0 ? (
                <p className="mt-6 text-neutral-400">
                  Nie ma jeszcze żadnych rzutów.
                </p>
              ) : (
                <div className="mt-6 grid gap-3">
                  {diceRolls.map((roll) => (
                    <article
                      key={roll.id}
                      className="rounded-xl border border-neutral-700 bg-neutral-800 p-4"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="font-bold">
                            {roll.characterName} rzuca {roll.formula}
                          </h3>

                          {roll.reason ? (
                            <p className="text-sm text-neutral-400">
                              Powód: {roll.reason}
                            </p>
                          ) : null}

                          <p className="mt-1 text-sm text-neutral-400">
                            Wyniki kości: {roll.rolls.join(", ")}
                            {roll.modifier !== 0
                              ? ` ${roll.modifier > 0 ? "+" : ""}${
                                  roll.modifier
                                }`
                              : ""}
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
        ) : null}

        {activeTab === "notes" ? (
          <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
            <div>
              <h2 className="text-2xl font-bold">Notatki kampanii</h2>

              <p className="mt-1 text-neutral-400">
                Tutaj zapisuj ważne informacje z kampanii: NPC, lokacje,
                zadania, sekrety i przebieg sesji.
              </p>
            </div>

            <div className="mt-6 rounded-xl border border-neutral-700 bg-neutral-950 p-4">
              <EditableText
                value={campaign?.notes || ""}
                multiline
                placeholder="Podwójny klik, aby dodać notatki kampanii..."
                onSave={updateCampaignNotes}
                className="block min-h-80 w-full whitespace-pre-wrap rounded-lg border border-transparent bg-transparent p-3 text-left text-neutral-200 hover:border-neutral-700 hover:bg-neutral-900"
                inputClassName="min-h-80 w-full rounded-lg border border-red-700 bg-neutral-900 p-3 text-neutral-200"
              />

              <p className="mt-3 text-xs text-neutral-500">
                Podwójny klik edytuje. Ctrl + Enter zapisuje. Escape anuluje.
                Kliknięcie poza pole też zapisuje.
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
