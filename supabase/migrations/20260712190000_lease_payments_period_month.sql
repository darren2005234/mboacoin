-- Fix — lease_payments.period doit identifier un MOIS, pas une date exacte.
-- Bug : generateDueDates recalculait period à partir de payment_day ; changer
-- payment_day en cours de bail décalait toutes les périodes générées, qui ne
-- correspondaient plus aux period déjà enregistrées (tout redevenait
-- "impayé"). Le jour de paiement est une info d'AFFICHAGE (date d'échéance),
-- pas l'identité de la période.

-- ============================================================================
-- PRÉ-VOL (lecture seule) — détecte d'éventuels doublons qu'une normalisation
-- ferait entrer en collision sur UNIQUE (lease_id, period). Ne devrait rien
-- renvoyer en pratique (un seul paiement par mois est déclarable aujourd'hui).
-- ============================================================================
-- SELECT lease_id, date_trunc('month', period)::date AS month, count(*)
-- FROM public.lease_payments lp
-- JOIN public.leases l ON l.id = lp.lease_id
-- WHERE l.payment_period = 'mensuel'
-- GROUP BY lease_id, date_trunc('month', period)::date
-- HAVING count(*) > 1;

-- ============================================================================
-- D.0 — Nettoyage d'un incident connu, trouvé par le pré-vol ci-dessus : le
-- bail a74fe5b5-c1ec-4397-8f45-4642460b68c1 a 2 déclarations pour chacun des
-- mois février à juillet 2026. Le loyer (et le jour de paiement) de ce bail a
-- été modifié le 2026-07-12 (40 000 -> 50 000 FCFA) ; ce même bug a alors fait
-- apparaître ces 6 mois comme impayés, et le bailleur les a re-déclarés en
-- bloc — mais avec le loyer *après* modification (50 000), incorrect pour ces
-- mois passés (le loyer réellement dû était 40 000). Confirmé avec le
-- bailleur : on supprime les 6 re-déclarations erronées (2026-07-12, 50 000)
-- et on garde les 6 déclarations d'origine (2026-07-11, 40 000).
-- ============================================================================
DELETE FROM public.lease_payments
WHERE receipt_number IN (
  'MBC-2026-000007', 'MBC-2026-000008', 'MBC-2026-000009',
  'MBC-2026-000010', 'MBC-2026-000011', 'MBC-2026-000012'
);

-- ============================================================================
-- D.1 — Normalisation des données existantes (baux mensuels uniquement ; les
-- baux journaliers gardent period = date exacte, c'est déjà leur unité
-- naturelle et ils ne sont pas concernés par le bug)
-- ============================================================================
UPDATE public.lease_payments lp
SET period = date_trunc('month', lp.period)::date
FROM public.leases l
WHERE l.id = lp.lease_id
  AND l.payment_period = 'mensuel'
  AND lp.period <> date_trunc('month', lp.period)::date;

-- ============================================================================
-- D.2 — Normalisation à l'écriture : quel que soit ce qu'envoie le client,
-- period est ramené au premier jour du mois pour un bail mensuel. Étend le
-- trigger BEFORE INSERT déjà existant (CREATE OR REPLACE, pas de nouveau
-- CREATE TRIGGER à rejouer — même pattern que 20260712160000).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.lease_payments_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_rent numeric;
  v_payment_period text;
BEGIN
  SELECT rent_amount, payment_period INTO v_rent, v_payment_period
  FROM public.leases WHERE id = NEW.lease_id;
  IF v_rent IS NULL THEN
    RAISE EXCEPTION 'bail introuvable';
  END IF;
  NEW.amount := v_rent;
  NEW.declared_by := auth.uid();
  IF v_payment_period = 'mensuel' THEN
    NEW.period := date_trunc('month', NEW.period)::date;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin — irréversible sans
-- perte d'info une fois D.0/D.1 exécutés : les 6 lignes supprimées par D.0 ne
-- sont récupérables que depuis une sauvegarde, et le jour exact d'origine
-- normalisé par D.1 n'est plus récupérable (il ne représentait de toute façon
-- qu'un payment_day passé, pas une donnée utile)
-- ============================================================================
-- (revenir à l'ancienne fonction lease_payments_before_insert() du fichier
--  20260711190000_lease_payments.sql si nécessaire)
