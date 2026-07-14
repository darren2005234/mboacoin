-- Correctif — rattachement de bail par téléphone bloqué par
-- leases_before_update, cause racine confirmée par instrumentation
-- (app/(app)/layout.tsx, [link-debug] : auth.uid()/JWT/profile/normalized
-- tous corrects, l'UPDATE échoue avec le message exact 'non autorisé').
--
-- leases_before_update() a été introduite par le chantier de cycle de vie
-- (20260712140000), APRÈS le mécanisme de rattachement par téléphone
-- (20260711160000). Elle ne connaît que deux identités légitimes pour un
-- UPDATE sur leases : le tenant_id actuel (auth.uid() = OLD.tenant_id) ou le
-- landlord_id (auth.uid() = OLD.landlord_id). Un rattachement initial change
-- justement tenant_id de NULL vers auth.uid() : `auth.uid() = OLD.tenant_id`
-- vaut alors `auth.uid() = NULL`, qui n'est jamais vrai (ni faux : NULL) —
-- la branche tombe dans le ELSE final et lève 'non autorisé'. Ce n'est donc
-- jamais une question de timing (quand link_my_pending_leases() est
-- appelée) : l'UPDATE échoue depuis l'introduction de ce trigger, quel que
-- soit le moment de l'appel.
--
-- Correction : nouvelle branche dédiée à ce cas précis, insérée avant le
-- ELSE. La RLS (leases_link_tenant_by_phone) a déjà vérifié que la ligne
-- n'est pas rattachée et que le numéro correspond ; ce trigger, comme pour
-- toutes les autres branches, est la seule autorité sur la légalité fine et
-- verrouille tout le reste de la ligne — seul tenant_id peut changer ici,
-- rien d'autre (pas de changement de statut en même temps).
CREATE OR REPLACE FUNCTION public.leases_before_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(current_setting('app.bypass_leases_guard', true), 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.tenant_id THEN
    IF OLD.status = 'en_attente_confirmation' THEN
      IF NEW.status NOT IN ('actif', 'rejete') THEN
        RAISE EXCEPTION 'transition de statut invalide pour le locataire';
      END IF;
    ELSIF OLD.status = 'actif' THEN
      IF NEW.status <> 'resilie' THEN
        RAISE EXCEPTION 'transition de statut invalide pour le locataire';
      END IF;
    ELSE
      RAISE EXCEPTION 'ce bail ne peut plus être modifié par le locataire';
    END IF;

    NEW.listing_id := OLD.listing_id;
    NEW.landlord_id := OLD.landlord_id;
    NEW.residence_id := OLD.residence_id;
    NEW.tenant_phone := OLD.tenant_phone;
    NEW.tenant_id := OLD.tenant_id;
    NEW.start_date := OLD.start_date;
    NEW.duration_months := OLD.duration_months;
    NEW.end_date := OLD.end_date;
    NEW.rent_amount := OLD.rent_amount;
    NEW.deposit_amount := OLD.deposit_amount;
    NEW.advance_amount := OLD.advance_amount;
    NEW.payment_day := OLD.payment_day;
    NEW.payment_period := OLD.payment_period;
    NEW.payment_mode := OLD.payment_mode;
    NEW.created_at := OLD.created_at;
    IF NEW.status <> 'resilie' THEN
      NEW.end_reason := OLD.end_reason;
    END IF;

    NEW.confirmed_at := CASE WHEN NEW.status = 'actif' THEN now() ELSE OLD.confirmed_at END;
    NEW.ended_at := CASE WHEN NEW.status IN ('rejete', 'resilie') THEN now() ELSE OLD.ended_at END;

    IF NEW.status = 'rejete' THEN
      UPDATE public.listings SET status = 'publiee' WHERE id = NEW.listing_id AND status = 'louee';
    ELSIF NEW.status = 'resilie' THEN
      UPDATE public.listings SET status = 'brouillon' WHERE id = NEW.listing_id AND status = 'louee';
    END IF;

  ELSIF auth.uid() = OLD.landlord_id THEN
    IF OLD.status = 'en_attente_confirmation' AND NEW.status = 'annule' THEN
      NEW.listing_id := OLD.listing_id;
      NEW.landlord_id := OLD.landlord_id;
      NEW.residence_id := OLD.residence_id;
      NEW.tenant_phone := OLD.tenant_phone;
      NEW.tenant_id := OLD.tenant_id;
      NEW.start_date := OLD.start_date;
      NEW.duration_months := OLD.duration_months;
      NEW.end_date := OLD.end_date;
      NEW.rent_amount := OLD.rent_amount;
      NEW.deposit_amount := OLD.deposit_amount;
      NEW.advance_amount := OLD.advance_amount;
      NEW.payment_day := OLD.payment_day;
      NEW.payment_period := OLD.payment_period;
      NEW.payment_mode := OLD.payment_mode;
      NEW.created_at := OLD.created_at;
      NEW.confirmed_at := OLD.confirmed_at;
      NEW.ended_at := now();
      UPDATE public.listings SET status = 'publiee' WHERE id = NEW.listing_id AND status = 'louee';

    ELSIF OLD.status = 'en_attente_confirmation' AND NEW.status = 'en_attente_confirmation' THEN
      NEW.listing_id := OLD.listing_id;
      NEW.landlord_id := OLD.landlord_id;
      NEW.residence_id := OLD.residence_id;
      NEW.payment_mode := OLD.payment_mode;
      NEW.created_at := OLD.created_at;
      NEW.confirmed_at := OLD.confirmed_at;
      NEW.ended_at := OLD.ended_at;
      NEW.end_reason := OLD.end_reason;
      IF NEW.tenant_phone IS DISTINCT FROM OLD.tenant_phone THEN
        NEW.tenant_id := NULL;
      ELSE
        NEW.tenant_id := OLD.tenant_id;
      END IF;

    ELSIF OLD.status = 'actif' AND NEW.status IN ('termine', 'arrete') THEN
      NEW.listing_id := OLD.listing_id;
      NEW.landlord_id := OLD.landlord_id;
      NEW.residence_id := OLD.residence_id;
      NEW.tenant_phone := OLD.tenant_phone;
      NEW.tenant_id := OLD.tenant_id;
      NEW.start_date := OLD.start_date;
      NEW.duration_months := OLD.duration_months;
      NEW.end_date := OLD.end_date;
      NEW.rent_amount := OLD.rent_amount;
      NEW.deposit_amount := OLD.deposit_amount;
      NEW.advance_amount := OLD.advance_amount;
      NEW.payment_day := OLD.payment_day;
      NEW.payment_period := OLD.payment_period;
      NEW.payment_mode := OLD.payment_mode;
      NEW.created_at := OLD.created_at;
      NEW.confirmed_at := OLD.confirmed_at;
      NEW.ended_at := now();
      UPDATE public.listings SET status = 'brouillon' WHERE id = NEW.listing_id AND status = 'louee';

    ELSE
      RAISE EXCEPTION 'transition de statut invalide pour le bailleur';
    END IF;

  ELSIF OLD.tenant_id IS NULL AND NEW.tenant_id = auth.uid() THEN
    -- Rattachement par téléphone (link_my_pending_leases / policy
    -- leases_link_tenant_by_phone). La RLS a déjà vérifié que le numéro
    -- correspond ; ce trigger n'autorise que le changement de tenant_id,
    -- rien d'autre, et jamais en même temps qu'un changement de statut.
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'non autorisé';
    END IF;

    NEW.listing_id := OLD.listing_id;
    NEW.landlord_id := OLD.landlord_id;
    NEW.residence_id := OLD.residence_id;
    NEW.tenant_phone := OLD.tenant_phone;
    NEW.start_date := OLD.start_date;
    NEW.duration_months := OLD.duration_months;
    NEW.end_date := OLD.end_date;
    NEW.rent_amount := OLD.rent_amount;
    NEW.deposit_amount := OLD.deposit_amount;
    NEW.advance_amount := OLD.advance_amount;
    NEW.payment_day := OLD.payment_day;
    NEW.payment_period := OLD.payment_period;
    NEW.payment_mode := OLD.payment_mode;
    NEW.created_at := OLD.created_at;
    NEW.confirmed_at := OLD.confirmed_at;
    NEW.ended_at := OLD.ended_at;
    NEW.end_reason := OLD.end_reason;

  ELSE
    RAISE EXCEPTION 'non autorisé';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- Revenir à la version précédente réintroduirait le blocage : ne pas faire
-- de rollback fonctionnel de ce correctif. Voir 20260715100000 pour la
-- version antérieure si un rollback est malgré tout nécessaire.
