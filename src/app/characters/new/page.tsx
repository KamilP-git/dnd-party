import Link from "next/link";
import { CharacterForm } from "@/components/CharacterForm";

export default function NewCharacterPage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">Dodaj nową postać</h1>

      <Link href="/" className="mt-4 inline-block text-sm underline">
        Wróć do listy postaci
      </Link>

      <p className="mt-4 text-gray-600">
        Tutaj gracz może wczytać swoją postać do kampanii.
      </p>

      <CharacterForm />
    </main>
  );
}
