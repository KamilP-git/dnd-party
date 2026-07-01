"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ImageAsset = {
  id: string;
  name: string;
  category: string;
  tags: string[];
  url: string;
  storage_path: string | null;
  uploaded_by: string | null;
  created_at: string;
};

type ImagePickerModalProps = {
  title?: string;
  allowedCategories?: string[];
  onSelect: (asset: ImageAsset) => void;
  onClose: () => void;
};

const imageCategoryLabels: Record<string, string> = {
  portrait: "Portret",
  weapon: "Broń",
  spell: "Czar",
  item: "Przedmiot",
  armor: "Pancerz",
  feature: "Cecha",
  background: "Tło",
  location: "Lokacja",
  creature: "Stworzenie",
  symbol: "Symbol",
  misc: "Inne",
};

export function ImagePickerModal({
  title = "Wybierz grafikę",
  allowedCategories,
  onSelect,
  onClose,
}: ImagePickerModalProps) {
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [status, setStatus] = useState("Ładuję grafiki...");
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const allowedCategoriesKey = allowedCategories?.join(",") ?? "all";

  useEffect(() => {
    async function loadAssets() {
      const supabase = createClient();

      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        setAssets([]);
        setStatus("Musisz być zalogowany, żeby korzystać z biblioteki grafik.");
        return;
      }

      let query = supabase
        .from("image_assets")
        .select("*")
        .order("created_at", { ascending: false });

      if (allowedCategories && allowedCategories.length > 0) {
        query = query.in("category", allowedCategories);
      }

      const { data, error } = await query;

      if (error) {
        setAssets([]);
        setStatus(`Nie udało się pobrać grafik: ${error.message}`);
        return;
      }

      setAssets((data ?? []) as ImageAsset[]);
      setStatus("Grafiki zostały wczytane.");
    }

    loadAssets();
  }, [allowedCategoriesKey]);

  const visibleCategories = useMemo(() => {
    const categoriesFromAssets = Array.from(
      new Set(assets.map((asset) => asset.category)),
    );

    return categoriesFromAssets.sort((firstCategory, secondCategory) =>
      firstCategory.localeCompare(secondCategory),
    );
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const normalizedSearchText = searchText.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesCategory =
        selectedCategory === "all" || asset.category === selectedCategory;

      const searchableText = [asset.name, asset.category, ...(asset.tags ?? [])]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedSearchText || searchableText.includes(normalizedSearchText);

      return matchesCategory && matchesSearch;
    });
  }, [assets, searchText, selectedCategory]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <section className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-xl border border-neutral-700 bg-neutral-950 text-white shadow-2xl">
        <header className="flex flex-col gap-4 border-b border-neutral-800 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold">{title}</h2>

            <p className="mt-1 text-sm text-neutral-400">
              Wybierz grafikę ze wspólnej biblioteki Supabase.
            </p>

            <p className="mt-2 text-xs text-neutral-500">{status}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/online/images"
              target="_blank"
              className="rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-300 hover:border-neutral-500"
            >
              Dodaj nową grafikę
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-red-900 px-4 py-2 text-sm font-semibold text-red-400 hover:border-red-700"
            >
              Zamknij
            </button>
          </div>
        </header>

        <div className="grid gap-3 border-b border-neutral-800 p-5 md:grid-cols-[minmax(0,1fr)_240px]">
          <label className="grid gap-1">
            Szukaj
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="np. miecz, łuk, portret, magia..."
              className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white caret-white outline-none focus:border-red-700 focus:bg-neutral-800"
            />
          </label>

          <label className="grid gap-1">
            Kategoria
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white outline-none focus:border-red-700 focus:bg-neutral-800"
            >
              <option value="all">Wszystkie</option>

              {visibleCategories.map((category) => (
                <option key={category} value={category}>
                  {imageCategoryLabels[category] ?? category}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {filteredAssets.length === 0 ? (
            <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-6 text-neutral-400">
              Nie znaleziono grafik pasujących do filtrów.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {filteredAssets.map((asset) => (
                <article
                  key={asset.id}
                  className="overflow-hidden rounded-xl border border-neutral-700 bg-neutral-900"
                >
                  <button
                    type="button"
                    onClick={() => onSelect(asset)}
                    className="block aspect-square w-full bg-neutral-950"
                  >
                    <img
                      src={asset.url}
                      alt={asset.name}
                      className="h-full w-full object-cover"
                    />
                  </button>

                  <div className="p-4">
                    <h3 className="font-bold">{asset.name}</h3>

                    <p className="mt-1 text-sm text-neutral-400">
                      {imageCategoryLabels[asset.category] ?? asset.category}
                    </p>

                    {asset.tags.length > 0 ? (
                      <p className="mt-2 line-clamp-2 text-xs text-neutral-500">
                        {asset.tags.join(", ")}
                      </p>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => onSelect(asset)}
                      className="mt-4 w-full rounded-lg border border-red-700 px-3 py-2 text-sm font-semibold text-red-500"
                    >
                      Wybierz
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
