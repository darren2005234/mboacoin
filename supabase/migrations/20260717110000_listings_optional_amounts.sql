-- Fix — une location sans caution ni avance est légitime, mais
-- listings.deposit_amount/advance_amount étaient NOT NULL (hérité de
-- l'ancien deposit_months/advance_months, jamais revu au moment du
-- renommage en montant — voir 20260712170000_listing_deposit_advance_amounts.sql).
-- Résultat observé : laisser ces champs vides à la création d'une annonce
-- renvoyait l'erreur Postgres brute "null value in column advance_amount
-- violates not-null constraint" directement à l'utilisateur.
--
-- Nullable plutôt qu'un DEFAULT 0 : NULL représente "non applicable", 0
-- représenterait "une caution de zéro franc" — sémantiquement différent, et
-- déjà le sens que tout le code TypeScript prête à ce champ
-- (deposit_amount/advance_amount typés `number | null` partout, jamais 0
-- par défaut). DROP NOT NULL sur une colonne déjà nullable est un no-op sûr.
ALTER TABLE public.listings
  ALTER COLUMN deposit_amount DROP NOT NULL,
  ALTER COLUMN advance_amount DROP NOT NULL;

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin — irréversible sans
-- risque si des lignes NULL existent déjà : remettre NOT NULL échouerait tant
-- qu'elles n'ont pas été comblées)
-- ============================================================================
-- ALTER TABLE public.listings ALTER COLUMN deposit_amount SET NOT NULL;
-- ALTER TABLE public.listings ALTER COLUMN advance_amount SET NOT NULL;
