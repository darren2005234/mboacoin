"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loginUrl } from "@/lib/auth-redirect";

/**
 * Garde d'accès client : redirige vers /login (avec retour vers la page
 * actuelle une fois connecté) si personne n'est connecté. Tant que la
 * vérification est en cours ou que la redirection se prépare, `ready` reste
 * false — n'affichez le contenu de la page qu'une fois `ready` true.
 */
export function useRequireAuth(): { ready: boolean; userId: string | null } {
  const router = useRouter();
  const [state, setState] = useState<{ ready: boolean; userId: string | null }>({
    ready: false,
    userId: null,
  });

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return;
      if (!user) {
        router.replace(loginUrl());
        return;
      }
      setState({ ready: true, userId: user.id });
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return state;
}
