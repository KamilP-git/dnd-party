"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type ActiveTab = "general" | "stats" | "abilities" | "inventory";

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
};

export default function CharacterDetailsPage() {
  const params = useParams<{ characterId: string }>();
  const characterId = params.characterId;

  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>("general");

  const [isEditingHp, setIsEditingHp] = useState(false);
  const [hpDraft, setHpDraft] = useState("");

  const [editingInventoryItemId, setEditingInventoryItemId] = useState<
    string | null
  >(null);
  const [inventoryQuantityDraft, setInventoryQuantityDraft] = useState("");

  useEffect(() => {
    const charactersJson = localStorage.getItem("dnd-characters");

    if (!charactersJson) {
      setIsLoading(false);
      return;
    }

    const characters = JSON.parse(charactersJson) as Character[];

    const foundCharacter = characters.find(
      (savedCharacter) => savedCharacter.id === characterId,
    );

    setCharacter(foundCharacter ?? null);
    setIsLoading(false);
  }, [characterId]);

  function updateCharacter(updatedCharacter: Character) {
    const charactersJson = localStorage.getItem("dnd-characters");

    const characters: Character[] = charactersJson
      ? JSON.parse(charactersJson)
      : [];

    const updatedCharacters = characters.map((savedCharacter) => {
      if (savedCharacter.id === updatedCharacter.id) {
        return updatedCharacter;
      }

      return savedCharacter;
    });

    localStorage.setItem("dnd-characters", JSON.stringify(updatedCharacters));
    setCharacter(updatedCharacter);
  }

  function changeHp(change: number) {
    if (!character) {
      return;
    }

    updateCharacter({
      ...character,
      hp: Math.max(0, character.hp + change),
    });
  }

  function startEditingHp() {
    if (!character) {
      return;
    }

    setHpDraft(String(character.hp));
    setIsEditingHp(true);
  }

  function saveHpDraft() {
    if (!character) {
      return;
    }

    const newHp = Number(hpDraft);

    if (Number.isNaN(newHp)) {
      setIsEditingHp(false);
      return;
    }

    updateCharacter({
      ...character,
      hp: Math.max(0, newHp),
    });

    setIsEditingHp(false);
  }

  function addInventoryItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!character) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    const name = String(formData.get("itemName") || "").trim();
    const quantity = Number(formData.get("itemQuantity") || 1);
    const description = String(formData.get("itemDescription") || "").trim();

    if (!name) {
      return;
    }

    const newItem: InventoryItem = {
      id: crypto.randomUUID(),
      name,
      quantity: Math.max(0, quantity),
      description,
    };

    updateCharacter({
      ...character,
      inventory: [...(character.inventory ?? []), newItem],
    });

    event.currentTarget.reset();
  }

  function changeInventoryItemQuantity(itemId: string, change: number) {
    if (!character) {
      return;
    }

    const updatedInventory = (character.inventory ?? []).map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity: Math.max(0, item.quantity + change),
        };
      }

      return item;
    });

    updateCharacter({
      ...character,
      inventory: updatedInventory,
    });
  }

  function startEditingInventoryItemQuantity(item: InventoryItem) {
    setEditingInventoryItemId(item.id);
    setInventoryQuantityDraft(String(item.quantity));
  }

  function saveInventoryItemQuantity(itemId: string) {
    if (!character) {
      return;
    }

    const newQuantity = Number(inventoryQuantityDraft);

    if (Number.isNaN(newQuantity)) {
      setEditingInventoryItemId(null);
      return;
    }

    const updatedInventory = (character.inventory ?? []).map((item) => {
      if (item.id === itemId) {
        return {
          ...item,
          quantity: Math.max(0, newQuantity),
        };
      }

      return item;
    });

    updateCharacter({
      ...character,
      inventory: updatedInventory,
    });

    setEditingInventoryItemId(null);
  }

  function removeInventoryItem(itemId: string) {
    if (!character) {
      return;
    }

    const updatedInventory = (character.inventory ?? []).filter(
      (item) => item.id !== itemId,
    );

    updateCharacter({
      ...character,
      inventory: updatedInventory,
    });
  }

  function getTabButtonClass(tab: ActiveTab) {
    const baseClass =
      "rounded-lg border bg-neutral-900 p-3 font-semibold transition";

    if (activeTab === tab) {
      return `${baseClass} border-red-700 text-red-500`;
    }

    return `${baseClass} border-neutral-700 text-neutral-300 hover:border-neutral-500`;
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-neutral-950 p-8 text-white">
        <p>Ładowanie postaci...</p>
      </main>
    );
  }

  if (!character) {
    return (
      <main className="min-h-screen bg-neutral-950 p-8 text-white">
        <h1 className="text-3xl font-bold">Nie znaleziono postaci</h1>

        <Link href="/" className="mt-4 inline-block underline">
          Wróć do listy postaci
        </Link>
      </main>
    );
  }

  const inventory = character.inventory ?? [];

  return (
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm text-neutral-300 underline">
          Wróć do listy postaci
        </Link>

        <header className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <p className="text-sm text-neutral-400">Karta postaci</p>

          <h1 className="mt-2 text-4xl font-bold">{character.name}</h1>

          <p className="mt-2 text-neutral-300">
            {character.race} · {character.className} · poziom {character.level}
          </p>

          {character.playerName ? (
            <p className="mt-1 text-neutral-400">
              Gracz: {character.playerName}
            </p>
          ) : null}
        </header>

        <nav className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={getTabButtonClass("general")}
          >
            Ogólne
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("stats")}
            className={getTabButtonClass("stats")}
          >
            Statystyki
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("abilities")}
            className={getTabButtonClass("abilities")}
          >
            Umiejętności
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("inventory")}
            className={getTabButtonClass("inventory")}
          >
            Ekwipunek
          </button>
        </nav>

        {activeTab === "general" ? (
          <>
            <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
              <h2 className="text-2xl font-bold">Ogólne</h2>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold text-neutral-400">
                    Imię postaci
                  </p>
                  <p className="mt-1 rounded-lg border border-neutral-700 bg-neutral-800 p-3">
                    {character.name}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-neutral-400">
                    Poziom
                  </p>
                  <p className="mt-1 rounded-lg border border-neutral-700 bg-neutral-800 p-3">
                    {character.level}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-neutral-400">
                    Rasa / pochodzenie
                  </p>
                  <p className="mt-1 rounded-lg border border-neutral-700 bg-neutral-800 p-3">
                    {character.race || "Brak"}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold text-neutral-400">
                    Klasa postaci
                  </p>
                  <p className="mt-1 rounded-lg border border-neutral-700 bg-neutral-800 p-3">
                    {character.className}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-sm font-semibold text-neutral-400">
                  Historia / opis postaci
                </p>

                <p className="mt-1 min-h-32 rounded-lg border border-neutral-700 bg-neutral-800 p-3">
                  {character.description || "Brak opisu."}
                </p>
              </div>
            </section>

            <section className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-6 text-center">
                <p className="text-4xl">❤️</p>

                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => changeHp(-1)}
                    className="rounded-lg border border-neutral-700 px-3 py-1 font-bold"
                  >
                    -
                  </button>

                  {isEditingHp ? (
                    <input
                      autoFocus
                      value={hpDraft}
                      onChange={(event) => setHpDraft(event.target.value)}
                      onBlur={saveHpDraft}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          saveHpDraft();
                        }

                        if (event.key === "Escape") {
                          setIsEditingHp(false);
                        }
                      }}
                      className="w-20 rounded-lg border border-red-700 bg-neutral-800 px-4 py-1 text-center text-2xl font-bold"
                      type="number"
                    />
                  ) : (
                    <button
                      type="button"
                      onDoubleClick={startEditingHp}
                      title="Kliknij dwa razy, żeby wpisać HP ręcznie"
                      className="min-w-20 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-1 text-2xl font-bold"
                    >
                      {character.hp}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => changeHp(1)}
                    className="rounded-lg border border-neutral-700 px-3 py-1 font-bold"
                  >
                    +
                  </button>
                </div>

                <p className="mt-2 text-sm font-semibold text-neutral-400">
                  HP
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Podwójny klik w liczbę = ręczna edycja
                </p>
              </div>

              <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-6 text-center">
                <p className="text-4xl">🛡️</p>
                <p className="mt-4 text-2xl font-bold">
                  {character.armorClass}
                </p>
                <p className="text-sm font-semibold text-neutral-400">
                  Klasa pancerza
                </p>
              </div>

              <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-6 text-center">
                <p className="text-4xl">⭐</p>
                <p className="mt-4 text-2xl font-bold">{character.level}</p>
                <p className="text-sm font-semibold text-neutral-400">Poziom</p>
              </div>
            </section>
          </>
        ) : null}

        {activeTab === "stats" ? (
          <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
            <h2 className="text-2xl font-bold">Statystyki</h2>

            <p className="mt-4 text-neutral-400">
              Tutaj później dodamy STR, DEX, CON, INT, WIS, CHA oraz
              modyfikatory.
            </p>
          </section>
        ) : null}

        {activeTab === "abilities" ? (
          <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
            <h2 className="text-2xl font-bold">Umiejętności</h2>

            <p className="mt-4 text-neutral-400">
              Tutaj później dodamy cechy, ataki, zaklęcia i zdolności z opisami
              oraz obrazkami.
            </p>
          </section>
        ) : null}

        {activeTab === "inventory" ? (
          <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
            <h2 className="text-2xl font-bold">Ekwipunek</h2>

            <form
              onSubmit={addInventoryItem}
              className="mt-6 grid gap-3 rounded-xl border border-neutral-700 bg-neutral-950 p-4 md:grid-cols-[1fr_120px_1fr_auto]"
            >
              <input
                name="itemName"
                required
                placeholder="Nazwa, np. Strzały"
                className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
              />

              <input
                name="itemQuantity"
                type="number"
                defaultValue={1}
                min={0}
                className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
              />

              <input
                name="itemDescription"
                placeholder="Opis, opcjonalnie"
                className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
              />

              <button
                type="submit"
                className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500"
              >
                Dodaj
              </button>
            </form>

            {inventory.length === 0 ? (
              <p className="mt-4 text-neutral-400">
                Brak przedmiotów w ekwipunku.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {inventory.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border border-neutral-700 bg-neutral-800 p-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-lg font-bold">{item.name}</h3>

                        {item.description ? (
                          <p className="mt-1 text-sm text-neutral-400">
                            {item.description}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            changeInventoryItemQuantity(item.id, -1)
                          }
                          className="rounded-lg border border-neutral-600 px-3 py-1 font-bold"
                        >
                          -
                        </button>

                        {editingInventoryItemId === item.id ? (
                          <input
                            autoFocus
                            type="number"
                            value={inventoryQuantityDraft}
                            onChange={(event) =>
                              setInventoryQuantityDraft(event.target.value)
                            }
                            onBlur={() => saveInventoryItemQuantity(item.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                saveInventoryItemQuantity(item.id);
                              }

                              if (event.key === "Escape") {
                                setEditingInventoryItemId(null);
                              }
                            }}
                            className="w-20 rounded-lg border border-red-700 bg-neutral-900 px-3 py-1 text-center font-bold"
                          />
                        ) : (
                          <button
                            type="button"
                            onDoubleClick={() =>
                              startEditingInventoryItemQuantity(item)
                            }
                            title="Podwójny klik, żeby wpisać ilość ręcznie"
                            className="min-w-16 rounded-lg border border-neutral-600 bg-neutral-900 px-3 py-1 text-center font-bold"
                          >
                            {item.quantity}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            changeInventoryItemQuantity(item.id, 1)
                          }
                          className="rounded-lg border border-neutral-600 px-3 py-1 font-bold"
                        >
                          +
                        </button>

                        <button
                          type="button"
                          onClick={() => removeInventoryItem(item.id)}
                          className="rounded-lg border border-neutral-600 px-3 py-1 text-sm text-neutral-400"
                        >
                          Usuń
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <p className="mt-4 text-xs text-neutral-500">
              Podwójny klik w ilość pozwala wpisać konkretną wartość ręcznie.
            </p>
          </section>
        ) : null}

        <div className="mt-6">
          <Link
            href={`/characters/${character.id}/edit`}
            className="inline-block rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500"
          >
            Pełna edycja postaci
          </Link>
        </div>
      </div>
    </main>
  );
}
