"use client";
type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  description: string;
};
type CharacterStats = {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
};
type StoredCharacter = {
  id: string;
  name: string;
  playerName: string;
  className: string;
  race: string;
  level: number;
  hp: number;
  armorClass: number;
  description: string;
  inventory: InventoryItem[];
  stats: CharacterStats;
};

export function CharacterForm() {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const newCharacter: StoredCharacter = {
      id: crypto.randomUUID(),
      name: String(formData.get("name") || ""),
      playerName: String(formData.get("playerName") || ""),
      className: String(formData.get("className") || ""),
      race: String(formData.get("race") || ""),
      level: Number(formData.get("level") || 1),
      hp: Number(formData.get("hp") || 0),
      armorClass: Number(formData.get("armorClass") || 10),
      description: String(formData.get("description") || ""),
      inventory: [],
      stats: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
    };

    const existingCharactersJson = localStorage.getItem("dnd-characters");
    const existingCharacters: StoredCharacter[] = existingCharactersJson
      ? JSON.parse(existingCharactersJson)
      : [];

    const updatedCharacters = [...existingCharacters, newCharacter];

    localStorage.setItem("dnd-characters", JSON.stringify(updatedCharacters));

    window.location.href = "/";
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 grid max-w-xl gap-4">
      <label className="grid gap-1">
        Imię postaci
        <input
          name="name"
          required
          className="rounded-lg border p-2"
          placeholder="np. Thalion"
        />
      </label>

      <label className="grid gap-1">
        Imię gracza
        <input
          name="playerName"
          className="rounded-lg border p-2"
          placeholder="np. Michał"
        />
      </label>

      <label className="grid gap-1">
        Klasa postaci
        <input
          name="className"
          required
          className="rounded-lg border p-2"
          placeholder="np. Ranger, Wizard, Paladin"
        />
      </label>

      <label className="grid gap-1">
        Rasa / pochodzenie
        <input
          name="race"
          className="rounded-lg border p-2"
          placeholder="np. Elf, Human, Tiefling"
        />
      </label>

      <label className="grid gap-1">
        Poziom
        <input
          name="level"
          type="number"
          className="rounded-lg border p-2"
          defaultValue={1}
        />
      </label>

      <label className="grid gap-1">
        Punkty życia
        <input
          name="hp"
          type="number"
          className="rounded-lg border p-2"
          defaultValue={0}
        />
      </label>

      <label className="grid gap-1">
        Klasa pancerza
        <input
          name="armorClass"
          type="number"
          className="rounded-lg border p-2"
          defaultValue={10}
        />
      </label>

      <label className="grid gap-1">
        Opis postaci
        <textarea
          name="description"
          className="min-h-32 rounded-lg border p-2"
          placeholder="Krótki opis wyglądu, historii albo charakteru postaci."
        />
      </label>

      <button type="submit" className="rounded-lg border p-3 font-semibold">
        Zapisz postać
      </button>
    </form>
  );
}
