-- Chantier — Caution/avance des annonces : nombre de mois -> montant (FCFA)
-- Renomme deposit_months/advance_months en deposit_amount/advance_amount
-- (cohérence avec leases.deposit_amount / leases.advance_amount, déjà en
-- montant) et convertit les données existantes : montant = mois x loyer.

-- ============================================================================
-- PRÉ-VOL (lecture seule) — vérifier qu'aucune contrainte CHECK n'existe sur
-- ces colonnes avant de les renommer/retyper
-- ============================================================================
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.listings'::regclass AND contype = 'c';

-- ============================================================================
-- C.1 — Renommage (clarté + cohérence avec leases)
-- ============================================================================
ALTER TABLE public.listings RENAME COLUMN deposit_months TO deposit_amount;
ALTER TABLE public.listings RENAME COLUMN advance_months TO advance_amount;

-- ============================================================================
-- C.2 — Retype en numeric, comme leases.deposit_amount / leases.advance_amount
-- ============================================================================
ALTER TABLE public.listings
  ALTER COLUMN deposit_amount TYPE numeric USING deposit_amount::numeric,
  ALTER COLUMN advance_amount TYPE numeric USING advance_amount::numeric;

-- ============================================================================
-- C.3 — Conversion des données existantes : montant = mois x loyer
-- Colonnes encore en "nombre de mois" à ce stade (rename/retype ne touchent
-- pas les valeurs). NULL x price = NULL : les annonces sans caution/avance
-- renseignée restent NULL, aucune perte d'information.
-- ============================================================================
UPDATE public.listings
SET
  deposit_amount = deposit_amount * price,
  advance_amount = advance_amount * price;

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- Attention : irréversible sans perte d'info une fois C.3 exécuté (le nombre
-- de mois d'origine n'est plus récupérable, seul montant/loyer donnerait une
-- approximation si le loyer n'a pas changé depuis).
-- ALTER TABLE public.listings RENAME COLUMN deposit_amount TO deposit_months;
-- ALTER TABLE public.listings RENAME COLUMN advance_amount TO advance_months;
