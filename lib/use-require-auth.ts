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
 *
 * On écoute onAuthStateChange plutôt que d'appeler getUser() une seule fois :
 * un getUser() isolé juste après la création du client peut gagner la course
 * contre l'initialisation interne de la session (lue depuis les cookies), et
 * renvoyer un faux "non connecté" qui déclenche une redirection abusive vers
 * /login même pour un utilisateur bien connecté. onAuthStateChange est piloté
 * par le client lui-même : il ne notifie qu'une fois la session réellement
 * résolue, et se redéclenche si elle change ensuite (refresh de token...).
 */
export function useRequireAuth(): { ready: boolean; userId: string | null } {
  const router = useRouter();
  const [state, setState] = useState<{ ready: boolean; userId: string | null }>({
    ready: false,
    userId: null,
  });

  useEffect(() => {
    const supabase = createClient();
    let redirected = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        redirected = false;
        setState({ ready: true, userId: session.user.id });
        return;
      }
      if (!redirected) {
        redirected = true;
        router.replace(loginUrl());
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return state;
}
