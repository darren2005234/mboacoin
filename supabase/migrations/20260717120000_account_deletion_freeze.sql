-- Fix — un compte en attente de suppression (rétractation de 7 jours,
-- account_deletion_requests) restait pleinement actif : il pouvait publier
-- une annonce, créer un bail, demander/accepter une visite, ouvrir une
-- conversation. Un bail créé pendant la rétractation aurait rendu la
-- suppression impossible à honorer, ou laissé un locataire avec un bailleur
-- sur le point de disparaître.
--
-- Garde appliquée en base (jamais seulement côté interface), sur toute
-- action qui engage un tiers. Consulter sa demande et l'annuler restent
-- toujours possibles — ce ne sont pas des engagements envers un tiers.

-- ============================================================================
-- A — Helper partagé
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_pending_deletion(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT deletion_requested_at IS NOT NULL FROM profiles WHERE id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.is_pending_deletion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_pending_deletion(uuid) TO authenticated;

-- ============================================================================
-- B — Annonces : ni publication ni republication tant que le compte est en
-- attente de suppression. Trigger ADDITIF (ne remplace aucun trigger
-- existant sur listings, dont l'implémentation base n'est pas versionnée
-- ici) : owner_id est déjà fourni par le client à la création (voir
-- lib/create-listing.ts), donc disponible dès ce trigger.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.listings_deletion_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('publiee', 'louee') AND public.is_pending_deletion(NEW.owner_id) THEN
    RAISE EXCEPTION 'Votre compte est en cours de suppression : impossible de publier une annonce tant que la demande est en attente. Vous pouvez l''annuler depuis Réglages.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER listings_deletion_guard_trigger
  BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.listings_deletion_guard();

-- Gel immédiat au moment de la demande, pas seulement à l'exécution 7 jours
-- plus tard : sans ceci, les annonces déjà publiées restaient pleinement
-- visibles et réservables pendant toute la rétractation. On mémorise
-- lesquelles ont été gelées par CETTE demande (deletion_freeze_active) pour
-- ne restaurer QUE celles-là si la suppression est annulée — jamais une
-- annonce que le bailleur avait lui-même laissée en brouillon avant.
ALTER TABLE public.listings ADD COLUMN deletion_freeze_active boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing timestamptz;
  v_scheduled_for timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'non authentifié';
  END IF;

  SELECT scheduled_for INTO v_existing FROM account_deletion_requests
  WHERE user_id = v_user_id AND status = 'en_attente';
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  IF public.has_account_deletion_blockers(v_user_id) THEN
    RAISE EXCEPTION 'Un bail est actif, en attente de confirmation, ou une visite confirmée est à venir. Terminez-le d''abord.';
  END IF;

  v_scheduled_for := now() + interval '7 days';

  INSERT INTO account_deletion_requests (user_id, scheduled_for) VALUES (v_user_id, v_scheduled_for);
  UPDATE profiles SET deletion_requested_at = now() WHERE id = v_user_id;

  -- Gel : ne concerne que les annonces publiques ; celles déjà en brouillon
  -- ou suspendues ne sont pas marquées (pas à restaurer non plus au retour).
  UPDATE listings SET status = 'brouillon', deletion_freeze_active = true
  WHERE owner_id = v_user_id AND status = 'publiee';

  INSERT INTO data_purge_log (action, entity_type, subject_user_id, rule)
  VALUES ('account_erasure_requested', 'profiles', v_user_id, 'user_requested');

  RETURN v_scheduled_for;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'non authentifié';
  END IF;

  UPDATE account_deletion_requests SET status = 'annulee', cancelled_at = now()
  WHERE user_id = v_user_id AND status = 'en_attente';

  -- Ordre important : lever le gel du profil AVANT de republier les annonces,
  -- sinon listings_deletion_guard bloquerait cette restauration elle-même.
  UPDATE profiles SET deletion_requested_at = NULL WHERE id = v_user_id;

  UPDATE listings SET status = 'publiee', deletion_freeze_active = false
  WHERE owner_id = v_user_id AND deletion_freeze_active = true;

  INSERT INTO data_purge_log (action, entity_type, subject_user_id, rule)
  VALUES ('account_erasure_cancelled', 'profiles', v_user_id, 'user_cancelled');
END;
$$;

-- ============================================================================
-- C — Baux : ni création (bailleur) ni confirmation (locataire) tant que le
-- compte concerné est en attente de suppression. Trigger séparé de
-- leases_before_insert/leases_before_update (jamais réécrits ici) : il
-- s'exécute après eux (ordre alphabétique des triggers BEFORE : "before_..."
-- précède "deletion_guard_..."), donc landlord_id/tenant_id/status sont déjà
-- dérivés et fiables au moment où il s'exécute.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.leases_deletion_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.is_pending_deletion(NEW.landlord_id) THEN
      RAISE EXCEPTION 'Votre compte est en cours de suppression : impossible de créer un bail tant que la demande est en attente. Vous pouvez l''annuler depuis Réglages.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'en_attente_confirmation' AND NEW.status = 'actif'
     AND NEW.tenant_id IS NOT NULL AND public.is_pending_deletion(NEW.tenant_id) THEN
    RAISE EXCEPTION 'Ce compte est en cours de suppression : impossible de confirmer ce bail tant que la demande est en attente.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER leases_deletion_guard_trigger
  BEFORE INSERT OR UPDATE ON public.leases
  FOR EACH ROW
  EXECUTE FUNCTION public.leases_deletion_guard();

-- ============================================================================
-- D — Visites : ni demande (locataire, request_visit) ni acceptation
-- (bailleur ou locataire, visits_guard) tant que le compte qui agit est en
-- attente de suppression. Corps de visits_guard repris à l'identique
-- (20260713100000_visits.sql) avec les deux ajouts marqués ci-dessous.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.request_visit(
  p_listing_id uuid, p_slots timestamptz[]
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner_id uuid; v_fee numeric; v_conversation_id uuid; v_visit_id uuid; v_slot timestamptz;
BEGIN
  -- Ajout : compte du demandeur en attente de suppression.
  IF public.is_pending_deletion(auth.uid()) THEN
    RAISE EXCEPTION 'Votre compte est en cours de suppression : impossible de demander une visite tant que la demande est en attente.';
  END IF;

  IF array_length(p_slots, 1) IS NULL OR array_length(p_slots, 1) NOT BETWEEN 2 AND 3 THEN
    RAISE EXCEPTION 'Proposez 2 ou 3 créneaux.';
  END IF;

  SELECT owner_id, visit_fee_amount INTO v_owner_id, v_fee
  FROM public.listings WHERE id = p_listing_id AND status = 'publiee';

  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'Logement introuvable ou non publié.'; END IF;
  IF v_owner_id = auth.uid() THEN RAISE EXCEPTION 'Vous ne pouvez pas visiter votre propre annonce.'; END IF;

  SELECT id INTO v_conversation_id FROM public.conversations
  WHERE listing_id = p_listing_id AND tenant_id = auth.uid();

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (listing_id, tenant_id, owner_id)
    VALUES (p_listing_id, auth.uid(), v_owner_id)
    RETURNING id INTO v_conversation_id;
  END IF;

  INSERT INTO public.visits (listing_id, tenant_id, landlord_id, conversation_id, fee_amount)
  VALUES (p_listing_id, auth.uid(), v_owner_id, v_conversation_id, v_fee)
  RETURNING id INTO v_visit_id;

  FOREACH v_slot IN ARRAY p_slots LOOP
    INSERT INTO public.visit_slots (visit_id, proposed_by, slot_at) VALUES (v_visit_id, auth.uid(), v_slot);
  END LOOP;

  RETURN v_visit_id;
END; $$;

CREATE OR REPLACE FUNCTION public.visits_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'demandee' AND NEW.status = 'confirmee' AND auth.uid() = OLD.landlord_id THEN
    -- Ajout : bailleur en attente de suppression.
    IF public.is_pending_deletion(auth.uid()) THEN
      RAISE EXCEPTION 'Votre compte est en cours de suppression : impossible de confirmer une visite tant que la demande est en attente.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.visit_slots
      WHERE visit_id = NEW.id AND slot_at = NEW.scheduled_at AND proposed_by = OLD.tenant_id
    ) THEN
      RAISE EXCEPTION 'Créneau invalide.';
    END IF;

  ELSIF OLD.status = 'demandee' AND NEW.status = 'creneau_propose' AND auth.uid() = OLD.landlord_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.visit_slots WHERE visit_id = NEW.id AND proposed_by = OLD.landlord_id) THEN
      RAISE EXCEPTION 'Proposez au moins un créneau.';
    END IF;

  ELSIF OLD.status = 'creneau_propose' AND NEW.status = 'confirmee' AND auth.uid() = OLD.tenant_id THEN
    -- Ajout : locataire en attente de suppression.
    IF public.is_pending_deletion(auth.uid()) THEN
      RAISE EXCEPTION 'Votre compte est en cours de suppression : impossible de confirmer une visite tant que la demande est en attente.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.visit_slots
      WHERE visit_id = NEW.id AND slot_at = NEW.scheduled_at AND proposed_by = OLD.landlord_id
    ) THEN
      RAISE EXCEPTION 'Créneau invalide.';
    END IF;

  ELSIF OLD.status IN ('demandee', 'creneau_propose') AND NEW.status = 'refusee' AND auth.uid() = OLD.landlord_id THEN
    NULL;

  ELSIF OLD.status IN ('demandee', 'creneau_propose') AND NEW.status = 'annulee' AND auth.uid() = OLD.tenant_id THEN
    NEW.cancelled_at := now();

  ELSIF OLD.status = 'confirmee' AND NEW.status = 'annulee' AND auth.uid() = OLD.tenant_id THEN
    IF OLD.scheduled_at - now() <= interval '3 hours' THEN
      RAISE EXCEPTION 'Annulation impossible à moins de 3h du créneau.';
    END IF;
    NEW.cancelled_at := now();

  ELSIF OLD.status = 'confirmee' AND NEW.status = 'effectuee' THEN
    NULL; -- le code a déjà été vérifié par confirm_visit_with_code() avant cet UPDATE

  ELSIF OLD.status = 'confirmee' AND NEW.status = 'expiree' THEN
    NULL; -- déclenché par le job planifié (service_role), jamais par un utilisateur

  ELSIF OLD.status = 'confirmee' AND NEW.no_show IS DISTINCT FROM OLD.no_show AND auth.uid() = OLD.landlord_id THEN
    IF OLD.scheduled_at > now() THEN RAISE EXCEPTION 'Le créneau n''est pas encore passé.'; END IF;

  ELSE
    RAISE EXCEPTION 'Transition non autorisée (% -> %).', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END; $$;

-- ============================================================================
-- E — Conversations : pas de nouvelle conversation si l'une des deux parties
-- est en attente de suppression. Trigger additif (aucun trigger existant sur
-- conversations n'est versionné ici).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.conversations_deletion_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_pending_deletion(NEW.tenant_id) OR public.is_pending_deletion(NEW.owner_id) THEN
    RAISE EXCEPTION 'Un des comptes concernés est en cours de suppression : impossible d''ouvrir cette conversation.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER conversations_deletion_guard_trigger
  BEFORE INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.conversations_deletion_guard();

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP TRIGGER IF EXISTS conversations_deletion_guard_trigger ON public.conversations;
-- DROP FUNCTION IF EXISTS public.conversations_deletion_guard();
-- (visits_guard/request_visit reviendraient à leur version 20260713100000 si retiré)
-- DROP TRIGGER IF EXISTS leases_deletion_guard_trigger ON public.leases;
-- DROP FUNCTION IF EXISTS public.leases_deletion_guard();
-- (request_account_deletion/cancel_account_deletion reviendraient à leur version 20260717100000)
-- ALTER TABLE public.listings DROP COLUMN IF EXISTS deletion_freeze_active;
-- DROP TRIGGER IF EXISTS listings_deletion_guard_trigger ON public.listings;
-- DROP FUNCTION IF EXISTS public.listings_deletion_guard();
-- DROP FUNCTION IF EXISTS public.is_pending_deletion(uuid);
