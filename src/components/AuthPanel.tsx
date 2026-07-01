"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export function AuthPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadUser() {
      const { data } = await supabase.auth.getUser();

      setUser(data.user);
      setIsLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const supabase = createClient();

    await supabase.auth.signOut();
    setUser(null);
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400">
        Sprawdzam logowanie...
      </div>
    );
  }

  if (!user) {
    return (
      <Link
        href="/auth"
        className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-500"
      >
        Zaloguj się
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-700 bg-neutral-950 p-3 sm:flex-row sm:items-center">
      <p className="text-sm text-neutral-300">
        Zalogowany jako{" "}
        <span className="font-semibold text-white">{user.email}</span>
      </p>

      <button
        type="button"
        onClick={signOut}
        className="rounded-lg border border-neutral-600 px-3 py-2 text-sm font-semibold text-neutral-300 hover:border-neutral-500"
      >
        Wyloguj się
      </button>
    </div>
  );
}
