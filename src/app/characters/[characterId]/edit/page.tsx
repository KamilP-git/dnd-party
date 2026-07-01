"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

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
};

export default function EditCharacterPage() {
  const params = useParams<{ characterId: string }>();
  const router = useRouter();
  const characterId = params.characterId;

  const [character, setCharacter] = useState<Character | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!character) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    const updatedCharacter: Character = {
      ...character,
      name: String(formData.get("name") || ""),
      playerName: String(formData.get("playerName") || ""),
      className: String(formData.get("className") || ""),
      race: String(formData.get("race") || ""),
      level: Number(formData.get("level") || 1),
      hp: Number(formData.get("hp") || 0),
      armorClass: Number(formData.get("armorClass") || 10),
      description: String(formData.get("description") || ""),
    };

    const charactersJson = localStorage.getItem("dnd-characters");
    const characters: Character[] = charactersJson
      ? JSON.parse(charactersJson)
      : [];

    const updatedCharacters = characters.map((savedCharacter) => {
      if (savedCharacter.id === characterId) {
        return updatedCharacter;
      }

      return savedCharacter;
    });

    localStorage.setItem("dnd-characters", JSON.stringify(updatedCharacters));

    router.push(`/characters/${characterId}`);
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

  return (
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/characters/${character.id}`}
          className="text-sm text-neutral-300 underline"
        >
          Wróć do karty postaci
        </Link>

        <header className="mt-6">
          <h1 className="text-3xl font-bold">Edytuj postać</h1>

          <p className="mt-2 text-neutral-400">
            Zmień podstawowe dane, HP, poziom albo opis postaci.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="mt-8 grid gap-4 rounded-xl border border-neutral-700 bg-neutral-900 p-6"
        >
          <label className="grid gap-1">
            Imię postaci
            <input
              name="name"
              required
              defaultValue={character.name}
              className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
            />
          </label>

          <label className="grid gap-1">
            Imię gracza
            <input
              name="playerName"
              defaultValue={character.playerName}
              className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
            />
          </label>

          <label className="grid gap-1">
            Klasa postaci
            <input
              name="className"
              required
              defaultValue={character.className}
              className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
            />
          </label>

          <label className="grid gap-1">
            Rasa / pochodzenie
            <input
              name="race"
              defaultValue={character.race}
              className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-1">
              Poziom
              <input
                name="level"
                type="number"
                min={1}
                defaultValue={character.level}
                className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
              />
            </label>

            <label className="grid gap-1">
              HP
              <input
                name="hp"
                type="number"
                defaultValue={character.hp}
                className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
              />
            </label>

            <label className="grid gap-1">
              Klasa pancerza
              <input
                name="armorClass"
                type="number"
                defaultValue={character.armorClass}
                className="rounded-lg border border-neutral-700 bg-neutral-800 p-2"
              />
            </label>
          </div>

          <label className="grid gap-1">
            Historia / opis postaci
            <textarea
              name="description"
              defaultValue={character.description}
              className="min-h-40 rounded-lg border border-neutral-700 bg-neutral-800 p-2"
            />
          </label>

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500"
            >
              Zapisz zmiany
            </button>

            <Link
              href={`/characters/${character.id}`}
              className="rounded-lg border border-neutral-700 px-4 py-2 font-semibold"
            >
              Anuluj
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
