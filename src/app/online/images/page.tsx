"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { createClient } from "@/lib/supabase/client";

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

const IMAGE_CATEGORIES = [
  { value: "portrait", label: "Portret" },
  { value: "weapon", label: "Broń" },
  { value: "spell", label: "Czar" },
  { value: "item", label: "Przedmiot" },
  { value: "armor", label: "Pancerz" },
  { value: "feature", label: "Cecha / zdolność" },
  { value: "background", label: "Tło" },
  { value: "location", label: "Lokacja" },
  { value: "creature", label: "Stworzenie" },
  { value: "symbol", label: "Symbol" },
  { value: "misc", label: "Inne" },
];

function sanitizeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replaceAll(" ", "-")
    .replace(/[^a-z0-9.\-_]/g, "");
}

function getCategoryLabel(category: string) {
  return (
    IMAGE_CATEGORIES.find((item) => item.value === category)?.label ?? category
  );
}

function formatDate(dateText: string) {
  return new Date(dateText).toLocaleString("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function OnlineImagesPage() {
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("misc");
  const [tagsText, setTagsText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [searchText, setSearchText] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");

  const [status, setStatus] = useState("Ładuję bibliotekę grafik...");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

  const filteredImages = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return images.filter((image) => {
      const matchesCategory =
        selectedCategoryFilter === "all" ||
        image.category === selectedCategoryFilter;

      const matchesSearch =
        !search ||
        image.name.toLowerCase().includes(search) ||
        image.category.toLowerCase().includes(search) ||
        image.tags.some((tag) => tag.toLowerCase().includes(search));

      return matchesCategory && matchesSearch;
    });
  }, [images, searchText, selectedCategoryFilter]);

  async function loadImages() {
    setIsLoading(true);
    setStatus("Ładuję bibliotekę grafik...");

    const supabase = createClient();

    const { data: userData } = await supabase.auth.getUser();

    setUserId(userData.user?.id ?? null);

    if (!userData.user) {
      setImages([]);
      setStatus("Musisz być zalogowany, żeby korzystać z biblioteki grafik.");
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("image_assets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setImages([]);
      setStatus(`Nie udało się pobrać grafik: ${error.message}`);
      setIsLoading(false);
      return;
    }

    setImages((data ?? []) as ImageAsset[]);
    setStatus("Biblioteka grafik została wczytana.");
    setIsLoading(false);
  }

  useEffect(() => {
    loadImages();
  }, []);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setSelectedFile(file);

    if (file && !name.trim()) {
      const fileNameWithoutExtension = file.name.replace(/\.[^/.]+$/, "");
      setName(fileNameWithoutExtension);
    }
  }

  async function uploadImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!userId) {
      setStatus("Musisz być zalogowany, żeby dodać grafikę.");
      return;
    }

    if (!selectedFile) {
      setStatus("Wybierz plik graficzny.");
      return;
    }

    if (!name.trim()) {
      setStatus("Wpisz nazwę grafiki.");
      return;
    }

    setIsUploading(true);
    setStatus("Wysyłam grafikę do Supabase Storage...");

    const supabase = createClient();

    const safeFileName = sanitizeFileName(selectedFile.name);
    const storagePath = `${userId}/${crypto.randomUUID()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("image-assets")
      .upload(storagePath, selectedFile, {
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

    const tags = tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    setStatus("Zapisuję grafikę w bazie...");

    const { data: insertedImage, error: insertError } = await supabase
      .from("image_assets")
      .insert({
        name: name.trim(),
        category,
        tags,
        url: publicUrlData.publicUrl,
        storage_path: storagePath,
        uploaded_by: userId,
      })
      .select("*")
      .single();

    if (insertError || !insertedImage) {
      await supabase.storage.from("image-assets").remove([storagePath]);

      setStatus(
        `Plik wysłany, ale nie udało się zapisać wpisu w bazie: ${insertError?.message}`,
      );
      setIsUploading(false);
      return;
    }

    setImages((currentImages) => [
      insertedImage as ImageAsset,
      ...currentImages,
    ]);

    setName("");
    setCategory("misc");
    setTagsText("");
    setSelectedFile(null);

    const fileInput = document.getElementById(
      "image-file-input",
    ) as HTMLInputElement | null;

    if (fileInput) {
      fileInput.value = "";
    }

    setStatus("Grafika została dodana do wspólnej biblioteki.");
    setIsUploading(false);
  }

  async function deleteImage(image: ImageAsset) {
    if (!userId) {
      setStatus("Musisz być zalogowany, żeby usuwać grafiki.");
      return;
    }

    if (image.uploaded_by !== userId) {
      setStatus("Możesz usuwać tylko grafiki, które sam dodałeś.");
      return;
    }

    const confirmed = window.confirm(
      `Czy na pewno chcesz usunąć grafikę „${image.name}”?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingImageId(image.id);
    setStatus("Usuwam grafikę...");

    const supabase = createClient();

    if (image.storage_path) {
      const { error: storageError } = await supabase.storage
        .from("image-assets")
        .remove([image.storage_path]);

      if (storageError) {
        setStatus(
          `Nie udało się usunąć pliku ze Storage: ${storageError.message}`,
        );
        setDeletingImageId(null);
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from("image_assets")
      .delete()
      .eq("id", image.id);

    if (deleteError) {
      setStatus(`Nie udało się usunąć wpisu z bazy: ${deleteError.message}`);
      setDeletingImageId(null);
      return;
    }

    setImages((currentImages) =>
      currentImages.filter((currentImage) => currentImage.id !== image.id),
    );

    setStatus("Grafika została usunięta.");
    setDeletingImageId(null);
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
                Wspólna biblioteka
              </p>

              <h1 className="mt-2 text-4xl font-bold">Biblioteka grafik</h1>

              <p className="mt-3 max-w-3xl text-neutral-400">
                Tu dodajesz grafiki dostępne dla kampanii online: portrety,
                przedmioty, bronie, czary, lokacje i symbole.
              </p>
            </div>

            <AuthPanel />
          </div>
        </header>

        <p className="mt-4 rounded-xl border border-neutral-700 bg-neutral-900 p-3 text-sm text-red-400">
          {status}
        </p>

        <section className="mt-6 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
            <h2 className="text-2xl font-bold">Dodaj grafikę</h2>

            <form onSubmit={uploadImage} className="mt-5 grid gap-4">
              <label className="grid gap-1 text-sm">
                Plik
                <input
                  id="image-file-input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleFileChange}
                  className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-sm"
                />
              </label>

              <label className="grid gap-1 text-sm">
                Nazwa
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="np. Miecz płomieni"
                  className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white caret-white outline-none focus:border-red-700"
                />
              </label>

              <label className="grid gap-1 text-sm">
                Kategoria
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white outline-none focus:border-red-700"
                >
                  {IMAGE_CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                Tagi
                <input
                  value={tagsText}
                  onChange={(event) => setTagsText(event.target.value)}
                  placeholder="np. ogień, miecz, magiczne"
                  className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white caret-white outline-none focus:border-red-700"
                />
              </label>

              <button
                type="submit"
                disabled={isUploading || !userId}
                className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
              >
                {isUploading ? "Dodaję..." : "Dodaj do biblioteki"}
              </button>
            </form>
          </aside>

          <section className="rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-2xl font-bold">Grafiki</h2>

                <p className="mt-1 text-sm text-neutral-400">
                  Możesz usunąć tylko te grafiki, które sam dodałeś.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  Szukaj
                  <input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="nazwa, tag, kategoria"
                    className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white caret-white outline-none focus:border-red-700"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  Kategoria
                  <select
                    value={selectedCategoryFilter}
                    onChange={(event) =>
                      setSelectedCategoryFilter(event.target.value)
                    }
                    className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white outline-none focus:border-red-700"
                  >
                    <option value="all">Wszystkie</option>

                    {IMAGE_CATEGORIES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {isLoading ? (
              <p className="mt-6 text-neutral-400">Ładuję grafiki...</p>
            ) : filteredImages.length === 0 ? (
              <p className="mt-6 rounded-xl border border-dashed border-neutral-700 p-8 text-center text-neutral-400">
                Brak grafik do wyświetlenia.
              </p>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredImages.map((image) => {
                  const canDelete = image.uploaded_by === userId;

                  return (
                    <article
                      key={image.id}
                      className="overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800"
                    >
                      <div className="aspect-square bg-neutral-950">
                        <img
                          src={image.url}
                          alt={image.name}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="p-4">
                        <h3 className="text-lg font-bold">{image.name}</h3>

                        <p className="mt-1 text-sm text-neutral-400">
                          {getCategoryLabel(image.category)}
                        </p>

                        {image.tags.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {image.tags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full border border-neutral-700 px-2 py-1 text-xs text-neutral-300"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <p className="mt-3 text-xs text-neutral-500">
                          Dodano: {formatDate(image.created_at)}
                        </p>

                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => deleteImage(image)}
                            disabled={deletingImageId === image.id}
                            className="mt-4 w-full rounded-lg border border-red-900 px-4 py-2 text-sm font-semibold text-red-400 disabled:cursor-not-allowed disabled:text-neutral-600"
                          >
                            {deletingImageId === image.id
                              ? "Usuwam..."
                              : "Usuń grafikę"}
                          </button>
                        ) : (
                          <p className="mt-4 rounded-lg border border-neutral-700 bg-neutral-950 p-2 text-xs text-neutral-500">
                            Nie możesz usunąć tej grafiki, bo dodał ją inny
                            użytkownik.
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
