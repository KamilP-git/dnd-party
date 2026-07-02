"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export function AuthPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loginHref, setLoginHref] = useState("/auth");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const currentPath = `${window.location.pathname}${window.location.search}`;

      setLoginHref(`/auth?next=${encodeURIComponent(currentPath)}`);
    }
  }, []);

  async function loadDisplayName(userId: string) {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        setDisplayName("");
        return;
      }

      setDisplayName(data?.display_name ?? "");
    } catch {
      setDisplayName("");
    }
  }

  useEffect(() => {
    let isActive = true;

    const fallbackTimer = window.setTimeout(() => {
      if (isActive) {
        setIsLoading(false);
      }
    }, 4000);

    async function loadUser() {
      try {
        const supabase = createClient();

        const { data } = await supabase.auth.getUser();

        if (!isActive) {
          return;
        }

        const currentUser = data.user ?? null;

        setUser(currentUser);

        if (currentUser) {
          await loadDisplayName(currentUser.id);
        } else {
          setDisplayName("");
        }
      } catch {
        if (isActive) {
          setUser(null);
          setDisplayName("");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadUser();

    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isActive) {
        return;
      }

      const currentUser = session?.user ?? null;

      setUser(currentUser);

      if (currentUser) {
        await loadDisplayName(currentUser.id);
      } else {
        setDisplayName("");
      }

      setIsLoading(false);
    });

    return () => {
      isActive = false;
      window.clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const supabase = createClient();

    await supabase.auth.signOut();

    setUser(null);
    setDisplayName("");
    setIsLoading(false);
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
        href={loginHref}
        className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-500"
      >
        Zaloguj się
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-neutral-700 bg-neutral-950 p-3 sm:flex-row sm:items-center">
      <div className="text-sm">
        <p className="text-neutral-300">
          Zalogowany jako{" "}
          <span className="font-semibold text-white">
            {displayName || user.email}
          </span>
        </p>

        {displayName ? (
          <p className="text-xs text-neutral-500">{user.email}</p>
        ) : null}
      </div>

      <Link
        href="/account"
        className="rounded-lg border border-neutral-600 px-3 py-2 text-sm font-semibold text-neutral-300 hover:border-neutral-500"
      >
        Konto
      </Link>

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
