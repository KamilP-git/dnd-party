import Link from "next/link";
import { AuthPanel } from "@/components/AuthPanel";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">
                D&D Party Manager
              </p>

              <h1 className="mt-4 max-w-4xl text-5xl font-black tracking-tight">
                Twoje centrum kampanii online
              </h1>

              <p className="mt-4 max-w-3xl text-lg text-neutral-300">
                Twórz kampanie, zapraszaj graczy, prowadź postacie, korzystaj ze
                wspólnej biblioteki grafik i zapisuj rzuty online.
              </p>
            </div>

            <AuthPanel />
          </div>
        </header>

        <section className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <Link
            href="/online"
            className="rounded-2xl border border-red-900 bg-red-950/30 p-8 transition hover:border-red-700 hover:bg-red-950/50"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-400">
              Start
            </p>

            <h2 className="mt-4 text-4xl font-black">Graj online</h2>

            <p className="mt-3 max-w-2xl text-neutral-300">
              Otwórz swoje kampanie online, stwórz nową kampanię albo przejdź do
              lobby istniejącej przygody.
            </p>

            <span className="mt-6 inline-block rounded-lg border border-red-700 px-5 py-3 font-semibold text-red-300">
              Otwórz kampanie online
            </span>
          </Link>

          <div className="grid gap-5">
            <Link
              href="/online/join"
              className="rounded-2xl border border-neutral-700 bg-neutral-900 p-6 transition hover:border-red-700"
            >
              <p className="text-3xl">🎟️</p>

              <h2 className="mt-3 text-2xl font-bold">Dołącz do kampanii</h2>

              <p className="mt-2 text-sm text-neutral-400">
                Masz kod zaproszenia od Mistrza Gry? Wpisz go tutaj.
              </p>
            </Link>

            <Link
              href="/online/images"
              className="rounded-2xl border border-neutral-700 bg-neutral-900 p-6 transition hover:border-red-700"
            >
              <p className="text-3xl">🖼️</p>

              <h2 className="mt-3 text-2xl font-bold">Biblioteka grafik</h2>

              <p className="mt-2 text-sm text-neutral-400">
                Dodawaj i wybieraj wspólne grafiki dla postaci, przedmiotów,
                czarów i cech.
              </p>
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <article className="rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
            <p className="text-3xl">👥</p>

            <h2 className="mt-3 text-xl font-bold">Role kampanii</h2>

            <p className="mt-2 text-sm text-neutral-400">
              Właściciel kampanii, Game Master i gracze mają osobne uprawnienia.
            </p>
          </article>

          <article className="rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
            <p className="text-3xl">🎲</p>

            <h2 className="mt-3 text-xl font-bold">Rzuty online</h2>

            <p className="mt-2 text-sm text-neutral-400">
              Historia rzutów działa w lobby i na kartach postaci.
            </p>
          </article>

          <article className="rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
            <p className="text-3xl">🧙</p>

            <h2 className="mt-3 text-xl font-bold">Karty postaci</h2>

            <p className="mt-2 text-sm text-neutral-400">
              Gracze edytują swoje postacie, a Game Master może je podglądać.
            </p>
          </article>
        </section>

        <section className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-5">
          <details>
            <summary className="text-sm font-semibold text-neutral-400">
              Narzędzia techniczne
            </summary>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/local"
                className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-400 hover:border-neutral-500"
              >
                Lokalny prototyp
              </Link>
            </div>

            <p className="mt-3 text-xs text-neutral-500">
              Lokalny prototyp zostaje jako kopia zapasowa starej wersji. Główna
              wersja aplikacji działa online przez Supabase.
            </p>
          </details>
        </section>
      </div>
    </main>
  );
}
