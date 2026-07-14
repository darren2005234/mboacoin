-- Fix — une période de loyer hors des bornes du bail pouvait être déclarée.
--
-- C'était une contrainte explicite du chantier PAIEMENT-AVANCE, jamais
-- appliquée : declare_payment_batch() vérifiait déjà le début (v_start) et,
-- en mode mensuel avec end_date fixée, la fin, mais declarePayment() (le
-- chemin de déclaration UNITAIRE, utilisé aussi bien en mode mensuel qu'en
-- mode journalier) ne vérifiait rien du tout côté serveur — seul le
-- formulaire pouvait limiter les valeurs saisies, ce qui ne protège rien
-- (API directe, ancien client, bug de formulaire).
--
-- Correctif : la garde est déplacée dans lease_payments_before_insert, le
-- trigger qui dérive déjà amount/declared_by/period pour CHAQUE ligne
-- insérée — donc pour les deux chemins à la fois (déclaration unitaire ET
-- lignes générées par declare_payment_batch, qui insère une ligne par
-- mois). Un trigger protège ; une contrainte d'interface ne protège rien.
--
-- Règle : pas avant le mois de la date de début du bail ; et, pour un bail
-- en mode mensuel à fin prévue connue, pas après le mois de cette fin. En
-- mode avance, aucun plafond : c'est justement la couverture déclarée qui
-- définit/prolonge end_date (déjà le comportement de declare_payment_batch,
-- repris ici à l'identique pour ne pas rejeter les extensions de couverture
-- légitimes). Un bail journalier n'a pas de notion de "mois" : la garde ne
-- s'applique qu'en payment_period = 'mensuel', comme la normalisation de
-- period déjà en place (20260712190000).
--
-- ============================================================================
-- A — lease_payments_before_insert() : ajout de la garde de bornes
-- ============================================================================
CREATE OR REPLACE FUNCTION public.lease_payments_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_rent numeric;
  v_payment_period text;
  v_payment_mode text;
  v_start_date date;
  v_end_date date;
BEGIN
  SELECT rent_amount, payment_period, payment_mode, start_date, end_date
    INTO v_rent, v_payment_period, v_payment_mode, v_start_date, v_end_date
  FROM public.leases WHERE id = NEW.lease_id;
  IF v_rent IS NULL THEN
    RAISE EXCEPTION 'bail introuvable';
  END IF;
  NEW.amount := v_rent;
  NEW.declared_by := auth.uid();
  IF v_payment_period = 'mensuel' THEN
    NEW.period := date_trunc('month', NEW.period)::date;
    IF NEW.period < date_trunc('month', v_start_date)::date THEN
      RAISE EXCEPTION 'la période ne peut pas précéder le début du bail';
    END IF;
    IF v_payment_mode = 'mensuel' AND v_end_date IS NOT NULL
       AND NEW.period > date_trunc('month', v_end_date)::date THEN
      RAISE EXCEPTION 'la période dépasse la fin prévue du bail';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- (revenir à la version précédente de lease_payments_before_insert() du
--  fichier 20260712190000_lease_payments_period_month.sql si nécessaire)
