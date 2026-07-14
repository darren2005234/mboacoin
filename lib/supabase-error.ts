import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Message sûr à afficher à l'utilisateur pour une erreur Postgres/PostgREST.
 * Les erreurs levées explicitement par nos triggers/fonctions (RAISE
 * EXCEPTION, SQLSTATE P0001) sont déjà rédigées pour lui et remontent telles
 * quelles ; toute autre erreur (contrainte NOT NULL/UNIQUE/CHECK, violation
 * RLS, etc.) est un détail d'implémentation qui ne doit jamais s'afficher
 * brut — on retombe alors sur `fallback`.
 */
export function friendlyErrorMessage(error: PostgrestError, fallback: string): string {
  if (error.code === "P0001") return error.message;
  return fallback;
}
