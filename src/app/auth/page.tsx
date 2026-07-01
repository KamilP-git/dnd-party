"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function getSafeRedirectPath() {
  if (typeof window === "undefined") {
    return "/online";
  }

  const searchParams = new URLSearchParams(window.location.search);
  const nextPath = searchParams.get("next");

  if (!nextPath) {
    return "/online";
  }

  if (!nextPath.startsWith("/")) {
    return "/online";
  }

  if (nextPath.startsWith("//")) {
    return "/online";
  }

  return nextPath;
}

export default function AuthPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [status, setStatus] = useState("");
  const [redirectPath, setRedirectPath] = useState("/online");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setRedirectPath(getSafeRedirectPath());
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsLoading(true);
    setStatus("Przetwarzam...");

    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setStatus(`Nie udało się zalogować: ${error.message}`);
        setIsLoading(false);
        return;
      }

      setStatus("Zalogowano. Przekierowuję...");

      router.push(redirectPath);
      router.refresh();
      return;
    }

    const origin = typeof window === "undefined" ? "" : window.location.origin;

    const emailRedirectTo = `${origin}/auth?next=${encodeURIComponent(
      redirectPath,
    )}`;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          display_name: displayName.trim(),
        },
      },
    });

    if (error) {
      setStatus(`Nie udało się utworzyć konta: ${error.message}`);
      setIsLoading(false);
      return;
    }

    setStatus(
      "Konto zostało utworzone. Sprawdź email i potwierdź rejestrację. Po potwierdzeniu wróć do logowania.",
    );

    setIsLoading(false);
  }

  return (
    <main className="min-h-screen bg-neutral-950 p-8 text-white">
      <div className="mx-auto max-w-md rounded-xl border border-neutral-700 bg-neutral-900 p-6">
        <Link href="/" className="text-sm text-neutral-300 underline">
          Wróć na stronę główną
        </Link>

        <p className="mt-6 text-sm text-neutral-400">D&D Party Manager</p>

        <h1 className="mt-2 text-3xl font-bold">
          {mode === "login" ? "Logowanie" : "Rejestracja"}
        </h1>

        <p className="mt-2 text-sm text-neutral-400">
          Po zalogowaniu wrócisz tutaj:
        </p>

        <p className="mt-1 rounded-lg border border-neutral-700 bg-neutral-950 p-2 text-sm text-red-400">
          {redirectPath}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-lg border px-4 py-2 font-semibold ${
              mode === "login"
                ? "border-red-700 text-red-500"
                : "border-neutral-700 text-neutral-300"
            }`}
          >
            Logowanie
          </button>

          <button
            type="button"
            onClick={() => setMode("register")}
            className={`rounded-lg border px-4 py-2 font-semibold ${
              mode === "register"
                ? "border-red-700 text-red-500"
                : "border-neutral-700 text-neutral-300"
            }`}
          >
            Rejestracja
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          {mode === "register" ? (
            <label className="grid gap-1">
              Nazwa gracza
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="np. Kamil"
                className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white caret-white outline-none focus:border-red-700 focus:bg-neutral-800"
              />
            </label>
          ) : null}

          <label className="grid gap-1">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white caret-white outline-none focus:border-red-700 focus:bg-neutral-800"
            />
          </label>

          <label className="grid gap-1">
            Hasło
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              className="rounded-lg border border-neutral-700 bg-neutral-800 p-2 text-white caret-white outline-none focus:border-red-700 focus:bg-neutral-800"
            />
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="rounded-lg border border-red-700 px-4 py-2 font-semibold text-red-500 disabled:cursor-not-allowed disabled:border-neutral-700 disabled:text-neutral-600"
          >
            {isLoading
              ? "Przetwarzam..."
              : mode === "login"
                ? "Zaloguj się"
                : "Utwórz konto"}
          </button>
        </form>

        {status ? <p className="mt-4 text-sm text-red-500">{status}</p> : null}
      </div>
    </main>
  );
}
