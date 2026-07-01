"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthPanel } from "@/components/AuthPanel";
import { createClient } from "@/lib/supabase/client";

export default function OnlineJoinPage() {
  const router = useRouter();

  const [inviteCode, setInviteCode] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [status, setStatus] = useState("Sprawdzam logowanie...");
  const [isCheckingUser, setIsCheckingUser] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  const loginHref = `/auth?next=${encodeURIComponent("/online/join")}`;

  useEffect(() => {
    async function checkUser() {
      const supabase = createClient();

      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        setIsLoggedIn(false);
        setUserEmail("");
        setStatus("Zaloguj się, żeby dołączyć do kampanii.");
        setIsCheckingUser(false);
        return;
      }

      setIsLoggedIn(true);
      setUserEmail(data.user.email ?? "");
      setStatus("Wpisz kod zaproszenia od Mistrza Gry.");
      setIsCheckingUser(false);
    }

    checkUser();
  }, []);

  async function joinCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isLoggedIn) {
      router.push(loginHref);
      return;
    }

    const cleanedCode = inviteCode.trim().toUpperCase();

    if (!cleanedCode) {
      setStatus("Wpisz kod zaproszenia.");
      return;
    }

    setIsJoining(true);
    setStatus("Dołączam do kampanii...");

    const supabase = createClient();

    const { data, error } = await supabase.rpc("join_campaign_by_code", {
      invite_code_to_join: cleanedCode,
    });

    if (error) {
      setStatus(`Nie udało się dołączyć: ${error.message}`);
      setIsJoining(false);
      return;
    }

    if (!data) {
      setStatus("Nie udało się dołączyć: Supabase nie zwrócił ID kampanii.");
      setIsJoining(false);
      return;
    }

    setStatus("Dołączono do kampanii. Przekierowuję...");
    router.push(`/online/campaigns/${data}`);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-4xl">
        <header className="rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                Dołączanie
              </p>

              <h1 className="mt-2 text-4xl font-bold">Dołącz do kampanii</h1>

              <p className="mt-2 text-neutral-400">
                Wpisz kod zaproszenia otrzymany od Mistrza Gry.
              </p>
            </div>

            <AuthPanel />
          </div>
        </header>

        <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          {isCheckingUser ? (
            <p className="text-neutral-300">Sprawdzam logowanie...</p>
          ) : !isLoggedIn ? (
            <div>
              <h2 className="text-2xl font-bold">Najpierw się zaloguj</h2>

              <p className="mt-3 text-neutral-400">
                Żeby dołączyć do kampanii, musisz mieć konto. Po zalogowaniu
                wrócisz automatycznie na tę stronę.
              </p>

              <Link
                href={loginHref}
                className="mt-6 inline-block rounded-lg border border-red-700 px-5 py-3 font-semibold text-red-500 hover:bg-red-950/30"
              >
                Zaloguj się lub utwórz konto
              </Link>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl font-bold">Kod zaproszenia</h2>

              <p className="mt-2 text-sm text-neutral-400">
                Jesteś zalogowany jako{" "}
                <span className="font-semibold text-white">{userEmail}</span>.
              </p>

              <form onSubmit={joinCampaign} className="mt-6 grid gap-4">
                <label className="grid gap-1">
                  Kod kampanii
                  <input
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value)}
                    placeholder="np. A1B2C3D4"
                    autoCapitalize="characters"
                    className="rounded-lg border border-neutral-700 bg-neutral-800 p-3 text-lg font-bold uppercase tracking-widest text-white caret-white outline-none focus:border-red-700"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isJoining}
                  className="rounded-lg border border-red-700 px-5 py-3 font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
                >
                  {isJoining ? "Dołączam..." : "Dołącz do kampanii"}
                </button>
              </form>
            </div>
          )}

          <p className="mt-6 rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-sm text-red-400">
            {status}
          </p>
        </section>
      </div>
    </main>
  );
}
