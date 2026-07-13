/**
 * Ne garde que les chemins relatifs internes ("/x", pas "//x" ni "/\x" qui sont
 * traités comme protocol-relative par certains navigateurs) : `next` vient d'un
 * paramètre d'URL, donc potentiellement contrôlé par un tiers — jamais un accès
 * direct à un domaine externe (open redirect).
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

/**
 * URL de connexion avec retour vers `next` (ou la page actuelle si non fourni
 * et qu'on est côté client). Utiliser partout où une action nécessite d'être
 * connecté : après connexion, l'utilisateur revient exactement là où il en était.
 */
export function loginUrl(next?: string | null): string {
  const target = safeNext(
    next ?? (typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : null)
  );
  return target ? `/login?next=${encodeURIComponent(target)}` : "/login";
}
