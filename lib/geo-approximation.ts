/**
 * Mirror TypeScript de l'arrondi appliqué par get_listing_location()/
 * get_map_listings() (supabase/migrations/20260717170000_listing_geolocation.sql).
 * N'est appelé par aucun code produit : sert uniquement à verrouiller la
 * règle en test. Si la fonction SQL change, mettre ce fichier à jour à la
 * main — rien ne les garde synchronisés automatiquement.
 *
 * Rayon (800 m) : doit excéder le pire décalage possible de l'arrondi à 2
 * décimales pour que le cercle affiché contienne TOUJOURS réellement le
 * point exact. Chaque coordonnée peut être décalée d'au plus ~555 m par cet
 * arrondi ; le pire cas combiné (latitude ET longitude décalées) atteint
 * ~785 m — d'où 800 m, avec une petite marge. Ne jamais baisser ce rayon
 * sans recalculer cette marge : le cercle deviendrait mensonger.
 */
export const APPROX_RADIUS_METERS = 800;

export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}
