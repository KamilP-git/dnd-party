"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "register";

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("login");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);

    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    if (!email) {
      setMessage("Podaj email.");
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setMessage("Hasło musi mieć co najmniej 6 znaków.");
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(`Nie udało się zalogować: ${error.message}`);
        setIsLoading(false);
        return;
      }

      router.push("/supabase-test");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage(`Nie udało się utworzyć konta: ${error.message}`);
      setIsLoading(false);
      return;
    }

    if (data.session) {
      router.push("/supabase-test");
      return;
    }

    setMessage(
      "Konto zostało utworzone. Jeśli Supabase wymaga potwierdzenia emaila, sprawdź skrzynkę pocztową.",
    );

    setIsLoading(false);
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-sm text-neutral-300 underline">
          Wróć do strony głównej
        </Link>

        <section className="mt-6 rounded-xl border border-neutral-700 bg-neutral-900 p-6">
          <p className="text-sm text-neutral-400">D&D Party Manager</p>

          <h1 className="mt-2 text-3xl font-bold">
            {mode === "login" ? "Logowanie" : "Rejestracja"}
          </h1>

          <p className="mt-2 text-neutral-400">
            Zaloguj się, żeby później mieć dostęp do swoich kampanii, postaci i
            wspólnej biblioteki grafik.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg border border-neutral-700 bg-neutral-950 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage("");
              }}
              className={
                mode === "login"
                  ? "rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white"
                  : "rounded-md px-3 py-2 text-sm font-semibold text-neutral-400 hover:bg-neutral-800"
              }
            >
              Logowanie
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("register");
                setMessage("");
              }}
              className={
                mode === "register"
                  ? "rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white"
                  : "rounded-md px-3 py-2 text-sm font-semibold text-neutral-400 hover:bg-neutral-800"
              }
            >
              Rejestracja
            </button>
          </div>

          <form onSubmit={handleAuth} className="mt-6 grid gap-4">
            <label className="grid gap-1">
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="np. gracz@email.com"
                className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white caret-white outline-none focus:border-red-700 focus:bg-neutral-800"
              />
            </label>

            <label className="grid gap-1">
              Hasło
              <input
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder="minimum 6 znaków"
                className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white caret-white outline-none focus:border-red-700 focus:bg-neutral-800"
              />
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
            >
              {isLoading
                ? "Przetwarzanie..."
                : mode === "login"
                  ? "Zaloguj się"
                  : "Utwórz konto"}
            </button>
          </form>

          {message ? (
            <p className="mt-4 rounded-lg border border-neutral-700 bg-neutral-950 p-3 text-sm text-neutral-300">
              {message}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
