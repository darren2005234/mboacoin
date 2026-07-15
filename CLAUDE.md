@AGENTS.md

> **Règle d'entretien de ce fichier :** à chaque fois qu'une erreur est commise et corrigée dans ce projet, ajouter une ligne à la section **Pièges déjà rencontrés** ci-dessous. Ce fichier est lu à chaque session : il doit rester à jour.

## Base de données

- Les migrations SQL ne sont **JAMAIS** exécutées automatiquement : elles doivent être lancées manuellement par le développeur dans Supabase avant tout test. **Le rappeler explicitement à la fin de tout chantier touchant la base.**
- Les écritures privilégiées passent par des fonctions `SECURITY DEFINER` avec `search_path` fixé, dérivant l'identité via `auth.uid()` côté serveur, jamais en paramètre.
- Convention : `TEXT` + `CHECK` pour la plupart des énumérations, mais certaines colonnes sont des enums natifs (`listing_status`, `verification_status`) — vérifier avant de supposer.

## Sécurité

- Défense en profondeur systématique : garde en page, garde en couche données, et RLS. La RLS est la dernière ligne, jamais la seule.
- Toute erreur Postgres/Supabase doit être présentée à l'utilisateur via un message compréhensible, jamais brute. Un bouton qui « ne fait rien » est un bug.

## Pièges déjà rencontrés (à ne pas reproduire)

- Une période de loyer s'identifie par son **MOIS normalisé** (1er du mois), jamais par la date d'échéance exacte : sinon changer le jour de paiement casse le calcul des retards.
- Une période ayant un paiement enregistré n'est **jamais** en retard, quelle que soit la date du versement.
- La normalisation de numéro de téléphone doit conserver l'indicatif pays complet (E.164) : la tronquer provoque des collisions entre pays (faille de sécurité).
- Quand plusieurs entités du même type peuvent exister pour un même parent (ex. plusieurs visites pour une conversation), ne jamais sélectionner « la plus récente » en supposant qu'il n'y en a qu'une : filtrer sur la pertinence (statut), pas seulement sur la date.
- Une visite est validée **UNIQUEMENT** par le code de confirmation, jamais par auto-validation du bailleur.
- Ne jamais exposer de statistique agrégée sous un seuil d'échantillon minimum (risque de ré-identification).

## Produit (règles constantes)

- MboaCoin n'arbitre pas les litiges : l'app documente, elle ne juge pas.
- Pas de paiement ni de séquestre en v1 : aucun fonds ne transite par la plateforme.
- Le sceau doré de la marque signifie « vérifié » et rien d'autre.

## Tests

- Lancer les tests : `npm test` (une passe) ou `npm run test:watch` (mode watch).
- Framework : Vitest, uniquement sur la logique métier pure de `lib/` — aucun appel réseau, aucune base réelle.
- Après tout chantier touchant la logique de `lib/` (calcul de dates/retards, statuts, sélection d'entités...), lancer `npm test` et écrire un test pour toute nouvelle logique critique avant de considérer le chantier terminé.
- Certains pièges ci-dessus (normalisation téléphone, seuils d'anonymisation) vivent uniquement côté SQL. `lib/phone.ts` est un mirror TypeScript de `normalize_phone()` qui verrouille la règle en test mais ne remplace pas une vérification de la fonction SQL réelle — à resynchroniser manuellement si la migration change.
