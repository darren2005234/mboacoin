/**
 * Libellé neutre à afficher pour une annonce non "publiee", partout où elle
 * peut apparaître (favoris, historique, conversation...). Une annonce
 * suspendue par la modération ne doit jamais être présentée comme "Louée" —
 * et son motif de suspension ne doit jamais être exposé publiquement.
 */
export function unavailableListingBadge(status: string): string {
  return status === "louee" ? "Louée" : "Non disponible";
}

/** Variante en phrase, pour les écrans où l'annonce indisponible remplace tout le contenu. */
export function unavailableListingSentence(status: string): string {
  return status === "louee" ? "Cette annonce a été louée." : "Cette annonce n'est plus disponible.";
}
