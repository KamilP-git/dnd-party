import Link from "next/link";
import { AuthPanel } from "@/components/AuthPanel";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-red-500">
                D&D Party Manager
              </p>

              <h1 className="mt-4 text-4xl font-bold md:text-6xl">
                Twoje centrum kampanii online
              </h1>

              <p className="mt-4 max-w-3xl text-lg text-neutral-300">
                Twórz kampanie, zapraszaj graczy kodem, prowadź karty postaci,
                rzucaj kośćmi realtime i korzystaj ze wspólnej biblioteki
                grafik.
              </p>
            </div>

            <AuthPanel />
          </div>
        </header>

        <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <article className="rounded-2xl border border-red-950 bg-red-950/20 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-400">
              Start
            </p>

            <h2 className="mt-3 text-3xl font-bold">Graj online</h2>

            <p className="mt-3 text-neutral-300">
              To jest główny tryb aplikacji. Dane zapisują się w Supabase,
              grafiki są we wspólnej bibliotece, a rzuty i karta postaci mogą
              synchronizować się między graczami.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/online"
                className="rounded-lg border border-red-700 bg-red-950/40 px-5 py-3 font-semibold text-red-300 hover:bg-red-950"
              >
                Wejdź do kampanii online
              </Link>

              <Link
                href="/auth"
                className="rounded-lg border border-neutral-600 px-5 py-3 font-semibold text-neutral-300 hover:border-neutral-400"
              >
                Zaloguj się
              </Link>
            </div>
          </article>

          <article className="rounded-2xl border border-neutral-700 bg-neutral-900 p-6">
            <h2 className="text-2xl font-bold">Szybkie akcje</h2>

            <div className="mt-5 grid gap-3">
              <Link
                href="/online/join"
                className="rounded-xl border border-neutral-700 bg-neutral-950 p-4 hover:border-red-700"
              >
                <p className="font-bold">Dołącz do kampanii</p>
                <p className="mt-1 text-sm text-neutral-400">
                  Wpisz kod zaproszenia od Mistrza Gry.
                </p>
              </Link>

              <Link
                href="/online/images"
                className="rounded-xl border border-neutral-700 bg-neutral-950 p-4 hover:border-red-700"
              >
                <p className="font-bold">Biblioteka grafik</p>
                <p className="mt-1 text-sm text-neutral-400">
                  Dodawaj portrety, ikony przedmiotów, ataki i cechy.
                </p>
              </Link>

              <Link
                href="/local"
                className="rounded-xl border border-neutral-700 bg-neutral-950 p-4 hover:border-neutral-500"
              >
                <p className="font-bold">Tryb lokalny</p>
                <p className="mt-1 text-sm text-neutral-400">
                  Starszy prototyp offline zapisujący dane w przeglądarce.
                </p>
              </Link>
            </div>
          </article>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-neutral-700 bg-neutral-900 p-5">
            <p className="text-4xl">🎲</p>
            <h3 className="mt-4 text-xl font-bold">Rzuty realtime</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Rzuty zapisują się online i pojawiają się u innych graczy bez
              odświeżania strony.
            </p>
          </article>

          <article className="rounded-2xl border border-neutral-700 bg-neutral-900 p-5">
            <p className="text-4xl">🧙</p>
            <h3 className="mt-4 text-xl font-bold">Karty postaci</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Postacie mają statystyki, HP, zasoby, ataki, cechy, ekwipunek i
              grafiki z biblioteki.
            </p>
          </article>

          <article className="rounded-2xl border border-neutral-700 bg-neutral-900 p-5">
            <p className="text-4xl">🖼️</p>
            <h3 className="mt-4 text-xl font-bold">Wspólne grafiki</h3>
            <p className="mt-2 text-sm text-neutral-400">
              Każdy może dodawać grafiki do wspólnej biblioteki Supabase.
            </p>
          </article>
        </section>

        <footer className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-center text-sm text-neutral-500">
          D&D Party Manager — wersja online.
        </footer>
      </div>
    </main>
  );
}
