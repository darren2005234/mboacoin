/**
 * Mirror TypeScript de la fonction SQL `public.normalize_phone()`
 * (supabase/migrations/20260715110000_phone_normalization_fix.sql :
 * `regexp_replace(coalesce(phone, ''), '\D', '', 'g')`). N'est appelée par aucun code produit :
 * sert uniquement à verrouiller la règle en test (voir CLAUDE.md, section Tests). Si la fonction
 * SQL change, mettre cette fonction à jour à la main — rien ne les garde synchronisées
 * automatiquement.
 */
export function normalizePhone(phone: string | null): string {
  return (phone ?? "").replace(/\D/g, "");
}
