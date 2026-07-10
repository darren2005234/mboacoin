/** Types de compte disponibles, source unique de vérité pour l'UI. */
export const ACCOUNT_TYPES = ["personne_physique", "agence", "residence"] as const;

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  personne_physique: "Je suis un particulier",
  agence: "Je suis une agence immobilière",
  residence: "Je gère une résidence / cité",
};
