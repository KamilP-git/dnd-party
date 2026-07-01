"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AuthPanel } from "@/components/AuthPanel";

type ImageAsset = {
  id: string;
  name: string;
  category: string;
  tags: string[];
  url: string;
  storage_path: string | null;
  uploaded_by: string | null;
  created_at: string;
};

const imageCategories = [
  { value: "portrait", label: "Portret" },
  { value: "weapon", label: "Broń" },
  { value: "spell", label: "Czar" },
  { value: "item", label: "Przedmiot" },
  { value: "armor", label: "Pancerz" },
  { value: "feature", label: "Cecha" },
  { value: "background", label: "Tło" },
  { value: "location", label: "Lokacja" },
  { value: "creature", label: "Stworzenie" },
  { value: "symbol", label: "Symbol" },
  { value: "misc", label: "Inne" },
];

function sanitizeFileName(fileName: string) {
  const cleanedName = fileName
    .trim()
    .toLowerCase()
    .replaceAll(" ", "-")
    .replace(/[^a-z0-9.\-_]/g, "");

  if (!cleanedName) {
    return "image.png";
  }

  return cleanedName;
}

function parseTags(tagsText: string) {
  return tagsText
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function OnlineImagesPage() {
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [status, setStatus] = useState("Ładuję bibliotekę grafik...");
  const [isUploading, setIsUploading] = useState(false);

  async function loadAssets() {
    const supabase = createClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setAssets([]);
      setStatus("Musisz być zalogowany, żeby widzieć bibliotekę grafik.");
      return;
    }

    const { data, error } = await supabase
      .from("image_assets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setAssets([]);
      setStatus(`Nie udało się pobrać grafik: ${error.message}`);
      return;
    }

    setAssets((data ?? []) as ImageAsset[]);
    setStatus("Biblioteka grafik została wczytana.");
  }

  useEffect(() => {
    loadAssets();
  }, []);

  async function uploadImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;

    setIsUploading(true);
    setStatus("Dodaję grafikę do biblioteki...");

    const formData = new FormData(form);

    const name = String(formData.get("name") || "").trim();
    const category = String(formData.get("category") || "misc").trim();
    const tagsText = String(formData.get("tags") || "").trim();
    const file = formData.get("file");

    if (!name) {
      setStatus("Podaj nazwę grafiki.");
      setIsUploading(false);
      return;
    }

    if (!(file instanceof File) || file.size === 0) {
      setStatus("Wybierz plik grafiki.");
      setIsUploading(false);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setStatus("Plik jest za duży. Maksymalny rozmiar to 5 MB.");
      setIsUploading(false);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setStatus("Wybrany plik nie jest obrazkiem.");
      setIsUploading(false);
      return;
    }

    const supabase = createClient();

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setStatus("Musisz być zalogowany, żeby dodać grafikę.");
      setIsUploading(false);
      return;
    }

    const safeFileName = sanitizeFileName(file.name);
    const storagePath = `${category}/${userData.user.id}/${crypto.randomUUID()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("image-assets")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      setStatus(`Nie udało się wysłać pliku: ${uploadError.message}`);
      setIsUploading(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("image-assets")
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData.publicUrl;

    const { error: insertError } = await supabase.from("image_assets").insert({
      name,
      category,
      tags: parseTags(tagsText),
      url: publicUrl,
      storage_path: storagePath,
      uploaded_by: userData.user.id,
    });

    if (insertError) {
      setStatus(
        `Plik został wysłany, ale nie udało się zapisać go w bibliotece: ${insertError.message}`,
      );
      setIsUploading(false);
      return;
    }

    form.reset();

    setStatus("Grafika została dodana do wspólnej biblioteki.");
    setIsUploading(false);

    await loadAssets();
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto max-w-6xl">
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
                Wspólna biblioteka grafik
              </p>

              <h1 className="mt-2 text-4xl font-bold">Grafiki online</h1>

              <p className="mt-2 text-neutral-400">
                Tutaj dodajesz grafiki do Supabase Storage. Później ta sama
                biblioteka będzie używana przy portretach, atakach, ekwipunku i
                cechach postaci.
              </p>
            </div>

            <AuthPanel />
          </div>
        </header>

        <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <h2 className="text-2xl font-bold">Dodaj grafikę</h2>

          <form onSubmit={uploadImage} className="mt-4 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1">
                Nazwa grafiki
                <input
                  name="name"
                  required
                  placeholder="np. Długi łuk, Mikstura leczenia, Portret maga"
                  className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white caret-white outline-none focus:border-red-700 focus:bg-neutral-800"
                />
              </label>

              <label className="grid gap-1">
                Kategoria
                <select
                  name="category"
                  defaultValue="misc"
                  className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white outline-none focus:border-red-700 focus:bg-neutral-800"
                >
                  {imageCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-1">
              Tagi
              <input
                name="tags"
                placeholder="np. łuk, broń, dystansowy"
                className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white caret-white outline-none focus:border-red-700 focus:bg-neutral-800"
              />
            </label>

            <label className="grid gap-1">
              Plik grafiki
              <input
                name="file"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                required
                className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white file:mr-4 file:rounded-lg file:border file:border-neutral-600 file:bg-neutral-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-neutral-300"
              />
            </label>

            <button
              type="submit"
              disabled={isUploading}
              className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
            >
              {isUploading ? "Dodaję..." : "Dodaj do biblioteki"}
            </button>
          </form>

          <p className="mt-4 text-sm text-red-500">{status}</p>
        </section>

        <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <h2 className="text-2xl font-bold">Grafiki w bibliotece</h2>

          {assets.length === 0 ? (
            <p className="mt-4 text-neutral-400">
              Nie ma jeszcze żadnych grafik w bibliotece.
            </p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {assets.map((asset) => (
                <article
                  key={asset.id}
                  className="overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800"
                >
                  <div className="aspect-square bg-neutral-950">
                    <img
                      src={asset.url}
                      alt={asset.name}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="p-4">
                    <h3 className="font-bold">{asset.name}</h3>

                    <p className="mt-1 text-sm text-neutral-400">
                      Kategoria: {asset.category}
                    </p>

                    {asset.tags.length > 0 ? (
                      <p className="mt-2 text-xs text-neutral-500">
                        Tagi: {asset.tags.join(", ")}
                      </p>
                    ) : null}
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
