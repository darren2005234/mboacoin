-- Chantier — Suspension de compte par l'administrateur (CDC 11.14, EF-ADM).
--
-- Même besoin structurel que le gel des comptes en attente de suppression
-- (20260717120000_account_deletion_freeze.sql) : empêcher un compte
-- d'engager de nouveaux tiers, sans jamais casser ce qu'il a déjà engagé.
-- Ce fichier étend les mêmes fonctions (CREATE OR REPLACE, mêmes triggers)
-- plutôt que d'en dupliquer le mécanisme.
--
-- ⚠️ Ne pas exécuter automatiquement : migration manuelle, comme toutes les
-- autres de ce projet. Avant de l'exécuter :
--   1. Vérifier qu'aucun code ne fait select("*") sur profiles (vérifié à la
--      conception : tous les appels dans lib/ listent leurs colonnes).
--   2. SELECT polname, qual FROM pg_policies WHERE tablename IN ('profiles','listings');
--      pour confirmer qu'aucune policy ne dépend d'un accès large aux deux
--      nouvelles colonnes avant d'exécuter le REVOKE de la section A.

-- ============================================================================
-- A — Colonnes
-- ============================================================================
ALTER TABLE public.profiles
  ADD COLUMN suspended_at timestamptz,
  ADD COLUMN suspension_reason text;

-- Flag distinct de deletion_freeze_active : les deux gels sont indépendants
-- et peuvent se chevaucher (compte suspendu qui demande aussi sa
-- suppression). Une annonce n'est republiée que si aucun des deux gels n'est
-- plus actif (voir sections C et la correction de cancel_account_deletion).
ALTER TABLE public.listings
  ADD COLUMN suspension_freeze_active boolean NOT NULL DEFAULT false;

-- suspended_at / suspension_reason ne doivent jamais être lisibles par un
-- tiers ni par l'utilisateur suspendu lui-même (accuser publiquement un
-- bailleur exposerait la plateforme, et le motif est explicitement à usage
-- interne admin). La RLS étant ligne par ligne, seul un GRANT/REVOKE par
-- colonne empêche vraiment un client d'aller les lire directement via
-- PostgREST, quelle que soit la policy SELECT existante sur profiles. Les
-- fonctions SECURITY DEFINER ci-dessous s'exécutent avec les privilèges du
-- définisseur, pas de l'appelant : ce REVOKE ne les affecte pas.
REVOKE SELECT (suspended_at, suspension_reason) ON public.profiles FROM authenticated, anon;

-- ============================================================================
-- B — Helper (mirroir de is_pending_deletion)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_suspended(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT suspended_at IS NOT NULL FROM profiles WHERE id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.is_suspended(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_suspended(uuid) TO authenticated;

-- ============================================================================
-- C — Actions admin : suspendre / lever la suspension
-- ============================================================================
-- is_admin() est vérifié DANS la fonction, jamais seulement via GRANT/RLS :
-- un utilisateur normal qui appelle ceci depuis la console reçoit une
-- exception, jamais un succès silencieux.
CREATE OR REPLACE FUNCTION public.suspend_account(p_user_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Action réservée aux administrateurs.';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Un administrateur ne peut pas se suspendre lui-même.';
  END IF;

  UPDATE profiles SET suspended_at = now(), suspension_reason = p_reason WHERE id = p_user_id;

  -- Gel immédiat des annonces publiées, comme le gel de suppression : sans
  -- ceci elles resteraient visibles et réservables pendant toute la
  -- suspension. On ne touche pas celles déjà en brouillon ou suspendues par
  -- modération (statut 'suspendue') — rien à en restaurer non plus au dégel.
  UPDATE listings SET status = 'brouillon', suspension_freeze_active = true
  WHERE owner_id = p_user_id AND status = 'publiee';
END;
$$;

REVOKE ALL ON FUNCTION public.suspend_account(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suspend_account(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.unsuspend_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Action réservée aux administrateurs.';
  END IF;

  UPDATE profiles SET suspended_at = NULL, suspension_reason = NULL WHERE id = p_user_id;

  -- Ne republie que les annonces gelées PAR ce mécanisme et non gelées par
  -- ailleurs (suppression de compte en cours) — même précaution que
  -- cancel_account_deletion ci-dessous. Si l'autre gel est encore actif, on
  -- efface seulement ce flag-ci et l'annonce reste en brouillon.
  UPDATE listings SET status = 'publiee', suspension_freeze_active = false
  WHERE owner_id = p_user_id AND suspension_freeze_active = true AND NOT deletion_freeze_active;

  UPDATE listings SET suspension_freeze_active = false
  WHERE owner_id = p_user_id AND suspension_freeze_active = true AND deletion_freeze_active;
END;
$$;

REVOKE ALL ON FUNCTION public.unsuspend_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unsuspend_account(uuid) TO authenticated;

-- Correction de symétrie : cancel_account_deletion (20260717120000) republie
-- inconditionnellement les lignes deletion_freeze_active. Si le compte est
-- par ailleurs suspendu, il ne faut PAS republier — seulement effacer ce
-- flag-ci. Reprise à l'identique du corps existant, avec ce correctif.
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
  WHERE owner_id = v_user_id AND deletion_freeze_active = true AND NOT suspension_freeze_active;

  UPDATE listings SET deletion_freeze_active = false
  WHERE owner_id = v_user_id AND deletion_freeze_active = true AND suspension_freeze_active;

  INSERT INTO data_purge_log (action, entity_type, subject_user_id, rule)
  VALUES ('account_erasure_cancelled', 'profiles', v_user_id, 'user_cancelled');
END;
$$;

-- ============================================================================
-- D — Lecture admin (fiche utilisateur + liste des comptes suspendus)
-- ============================================================================
-- WHERE ... AND public.is_admin() renvoie un jeu vide pour un non-admin
-- (plutôt qu'une exception) : suffisant ici, ces fonctions ne font qu'afficher.
CREATE OR REPLACE FUNCTION public.get_user_admin_detail(p_user_id uuid)
RETURNS TABLE(
  id uuid, full_name text, city text, account_type text, verification text,
  created_at timestamptz, suspended_at timestamptz, suspension_reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name, city, account_type, verification, created_at, suspended_at, suspension_reason
  FROM profiles WHERE id = p_user_id AND public.is_admin();
$$;

REVOKE ALL ON FUNCTION public.get_user_admin_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_admin_detail(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_suspended_accounts()
RETURNS TABLE(id uuid, full_name text, account_type text, suspended_at timestamptz, suspension_reason text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name, account_type, suspended_at, suspension_reason
  FROM profiles WHERE suspended_at IS NOT NULL AND public.is_admin()
  ORDER BY suspended_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_suspended_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_suspended_accounts() TO authenticated;

-- Sous-ensemble suspendu d'une liste d'utilisateurs, pour afficher un badge
-- « Suspendu » partout où l'admin consulte une liste d'utilisateurs
-- (vérifications, support...) sans faire un aller-retour par utilisateur.
CREATE OR REPLACE FUNCTION public.list_suspended_user_ids(p_user_ids uuid[])
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM profiles
  WHERE id = ANY(p_user_ids) AND suspended_at IS NOT NULL AND public.is_admin();
$$;

REVOKE ALL ON FUNCTION public.list_suspended_user_ids(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_suspended_user_ids(uuid[]) TO authenticated;

-- ============================================================================
-- E — Gardes d'action : extension des triggers/fonctions existants
-- ============================================================================
-- Message imposé par le CDC pour toute action bloquée par une suspension :
-- jamais un échec silencieux.

-- E.1 — Annonces : ni publication ni republication.
CREATE OR REPLACE FUNCTION public.listings_deletion_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('publiee', 'louee') AND public.is_pending_deletion(NEW.owner_id) THEN
    RAISE EXCEPTION 'Votre compte est en cours de suppression : impossible de publier une annonce tant que la demande est en attente. Vous pouvez l''annuler depuis Réglages.';
  END IF;
  IF NEW.status IN ('publiee', 'louee') AND public.is_suspended(NEW.owner_id) THEN
    RAISE EXCEPTION 'Votre compte fait l''objet d''une restriction. Contactez le support.';
  END IF;
  RETURN NEW;
END;
$$;

-- E.2 — Baux : ni création (bailleur) ni confirmation (locataire).
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
    IF public.is_suspended(NEW.landlord_id) THEN
      RAISE EXCEPTION 'Votre compte fait l''objet d''une restriction. Contactez le support.';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status = 'en_attente_confirmation' AND NEW.status = 'actif'
     AND NEW.tenant_id IS NOT NULL AND public.is_pending_deletion(NEW.tenant_id) THEN
    RAISE EXCEPTION 'Ce compte est en cours de suppression : impossible de confirmer ce bail tant que la demande est en attente.';
  END IF;
  IF OLD.status = 'en_attente_confirmation' AND NEW.status = 'actif'
     AND NEW.tenant_id IS NOT NULL AND public.is_suspended(NEW.tenant_id) THEN
    RAISE EXCEPTION 'Votre compte fait l''objet d''une restriction. Contactez le support.';
  END IF;
  RETURN NEW;
END;
$$;

-- E.3 — Visites : ni demande ni acceptation.
CREATE OR REPLACE FUNCTION public.request_visit(
  p_listing_id uuid, p_slots timestamptz[]
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner_id uuid; v_fee numeric; v_conversation_id uuid; v_visit_id uuid; v_slot timestamptz;
BEGIN
  IF public.is_pending_deletion(auth.uid()) THEN
    RAISE EXCEPTION 'Votre compte est en cours de suppression : impossible de demander une visite tant que la demande est en attente.';
  END IF;
  IF public.is_suspended(auth.uid()) THEN
    RAISE EXCEPTION 'Votre compte fait l''objet d''une restriction. Contactez le support.';
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
    IF public.is_pending_deletion(auth.uid()) THEN
      RAISE EXCEPTION 'Votre compte est en cours de suppression : impossible de confirmer une visite tant que la demande est en attente.';
    END IF;
    IF public.is_suspended(auth.uid()) THEN
      RAISE EXCEPTION 'Votre compte fait l''objet d''une restriction. Contactez le support.';
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
    IF public.is_pending_deletion(auth.uid()) THEN
      RAISE EXCEPTION 'Votre compte est en cours de suppression : impossible de confirmer une visite tant que la demande est en attente.';
    END IF;
    IF public.is_suspended(auth.uid()) THEN
      RAISE EXCEPTION 'Votre compte fait l''objet d''une restriction. Contactez le support.';
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

-- E.4 — Conversations : pas de nouvelle conversation.
CREATE OR REPLACE FUNCTION public.conversations_deletion_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_pending_deletion(NEW.tenant_id) OR public.is_pending_deletion(NEW.owner_id) THEN
    RAISE EXCEPTION 'Un des comptes concernés est en cours de suppression : impossible d''ouvrir cette conversation.';
  END IF;
  IF public.is_suspended(NEW.tenant_id) OR public.is_suspended(NEW.owner_id) THEN
    RAISE EXCEPTION 'Un des comptes concernés fait l''objet d''une restriction. Contactez le support.';
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- F — Garde profil : empêche un compte suspendu de modifier son profil pour
-- contourner la mesure (updateMyProfile permet full_name/city/email/bio/
-- account_type — lib/edit-profile.ts). Additive : aucun trigger de ce type
-- n'existe aujourd'hui sur profiles.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.profiles_suspension_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_suspended(OLD.id) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Votre compte fait l''objet d''une restriction. Contactez le support.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_suspension_guard_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_suspension_guard();

-- G — Pas de notification : contrairement à listings_after_update_notify
-- (suspension d'annonce par modération), aucune notification automatique
-- n'est envoyée pour la suspension de compte (décision manuelle au cas par
-- cas, plus tard — voir CDC).

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP TRIGGER IF EXISTS profiles_suspension_guard_trigger ON public.profiles;
-- DROP FUNCTION IF EXISTS public.profiles_suspension_guard();
-- (conversations_deletion_guard, visits_guard/request_visit, leases_deletion_guard,
--  listings_deletion_guard reviendraient à leur version 20260717120000 si retiré)
-- (cancel_account_deletion reviendrait à sa version 20260717120000)
-- DROP FUNCTION IF EXISTS public.list_suspended_user_ids(uuid[]);
-- DROP FUNCTION IF EXISTS public.list_suspended_accounts();
-- DROP FUNCTION IF EXISTS public.get_user_admin_detail(uuid);
-- DROP FUNCTION IF EXISTS public.unsuspend_account(uuid);
-- DROP FUNCTION IF EXISTS public.suspend_account(uuid, text);
-- DROP FUNCTION IF EXISTS public.is_suspended(uuid);
-- ALTER TABLE public.listings DROP COLUMN IF EXISTS suspension_freeze_active;
-- GRANT SELECT (suspended_at, suspension_reason) ON public.profiles TO authenticated, anon;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS suspension_reason;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS suspended_at;
