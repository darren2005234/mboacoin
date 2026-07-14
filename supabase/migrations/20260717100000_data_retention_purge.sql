-- Chantier CONFORMITÉ-1 — conservation et effacement des données personnelles
-- (loi camerounaise n°2024/017). Chantier destructif par nature : voir les
-- notes de prudence à chaque section. Rien n'est activé automatiquement par
-- cette migration (aucun cron.schedule) — c'est un geste manuel, après
-- vérification en mode simulation (voir supabase/functions/data-retention-purge).
--
-- Audit préalable effectué (résultats en conversation, pas reproduits ici) :
--   - profiles.id RÉFÉRENCE auth.users(id) ON DELETE CASCADE.
--   - Les tables à valeur probante (leases, lease_payments, lease_documents,
--     lease_requests, lease_amendments, visits, etat_des_lieux*, support_*)
--     référencent profiles(id) en NO ACTION (bloquant, pas cascadant).
--   - listings/conversations/messages/notifications/reports/favorites/
--     verification_requests/listing_verifications/listing_views/residences/
--     push_subscriptions référencent profiles(id) en CASCADE.
-- Conséquence directe : auth.admin.deleteUser() ne doit JAMAIS être appelée
-- ici — elle cascaderait sur profiles puis échouerait (NO ACTION) pour tout
-- compte ayant un historique de bail/support/visite, ou supprimerait sans
-- discernement (CASCADE) pour un compte qui n'en a pas. Le compte auth est
-- neutralisé par UPDATE (auth.admin.updateUserById, dans l'Edge Function),
-- jamais par DELETE. profiles n'est jamais supprimée non plus : elle est
-- pseudonymisée sur place, ce qui suffit à faire hériter toutes les tables
-- ci-dessus de l'anonymisation via leur jointure vers profiles — sans avoir
-- à toucher chacune individuellement.

-- ============================================================================
-- A — Hash au moment de l'upload (identité + entité)
-- ============================================================================
-- Calculé côté client (SHA-256, Web Crypto API) au moment du dépôt, pas de la
-- purge — voir lib/verification.ts. Les demandes déjà en base avant ce
-- déploiement n'ont pas de hash : la garde de la section C empêche
-- explicitement de les purger tant qu'aucun rattrapage ponctuel (hors
-- migration, hors cron) ne leur en a calculé un.
ALTER TABLE public.verification_requests
  ADD COLUMN document_hash text,
  ADD COLUMN selfie_hash text,
  ADD COLUMN entity_document_hash text;

-- ============================================================================
-- B — Journal (jamais de contenu supprimé, uniquement quoi/quand/qui/pourquoi)
-- ============================================================================
CREATE TABLE public.data_purge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL CHECK (action IN (
    'identity_document_purged', 'entity_document_purged', 'listing_video_purged',
    'account_erasure_requested', 'account_erasure_cancelled',
    'account_erasure_executed', 'account_erasure_blocked'
  )),
  entity_type text NOT NULL,
  record_id uuid,
  subject_user_id uuid REFERENCES public.profiles(id),
  rule text NOT NULL,
  performed_by text NOT NULL DEFAULT 'system'
);

CREATE INDEX data_purge_log_subject_user_id_idx ON public.data_purge_log(subject_user_id);

ALTER TABLE public.data_purge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "data_purge_log_select_admin" ON public.data_purge_log
  FOR SELECT USING (public.is_admin());
-- Aucune policy INSERT : uniquement écrit par les fonctions SECURITY DEFINER
-- ci-dessous, jamais par un client direct.

-- ============================================================================
-- C — Purge des documents de vérification d'identité (+ entité, même règle,
-- voir argumentaire validé : une règle uniforme plutôt que deux fenêtres).
-- ============================================================================
-- Prévisualisation : SELECT pur, aucune écriture possible par construction —
-- c'est le mode simulation. Ne renvoie un chemin que si son hash existe déjà
-- (garde non négociable : jamais purger un fichier dont on n'a aucune preuve
-- de son intégrité passée).
CREATE OR REPLACE FUNCTION public.preview_identity_document_purge()
RETURNS TABLE(
  request_id uuid, user_id uuid, rule text,
  document_path text, selfie_path text, entity_document_path text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, user_id,
    CASE WHEN status = 'validee' THEN 'identity_validated_30d' ELSE 'identity_rejected_immediate' END,
    CASE WHEN document_hash IS NOT NULL THEN document_path ELSE NULL END,
    CASE WHEN selfie_hash IS NOT NULL THEN selfie_path ELSE NULL END,
    CASE WHEN entity_document_hash IS NOT NULL THEN entity_document_path ELSE NULL END
  FROM verification_requests
  WHERE (
    (status = 'validee' AND reviewed_at <= now() - interval '30 days')
    OR (status = 'rejetee' AND reviewed_at IS NOT NULL)
  )
  AND (
    (document_path IS NOT NULL AND document_hash IS NOT NULL)
    OR (selfie_path IS NOT NULL AND selfie_hash IS NOT NULL)
    OR (entity_document_path IS NOT NULL AND entity_document_hash IS NOT NULL)
  );
$$;

-- Appelée par l'Edge Function UNIQUEMENT après confirmation que le fichier a
-- été effacé du bucket — jamais avant. Idempotente : si la ligne n'a plus de
-- chemin (déjà purgée), les CASE ci-dessous sont des no-op.
CREATE OR REPLACE FUNCTION public.commit_identity_document_purge(
  p_request_id uuid, p_purge_document boolean, p_purge_selfie boolean, p_purge_entity_document boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_status text;
BEGIN
  SELECT user_id, status INTO v_user_id, v_status FROM verification_requests WHERE id = p_request_id;
  IF v_user_id IS NULL THEN
    RETURN; -- ligne introuvable : rien à faire, idempotent
  END IF;

  UPDATE verification_requests SET
    document_path = CASE WHEN p_purge_document THEN NULL ELSE document_path END,
    selfie_path = CASE WHEN p_purge_selfie THEN NULL ELSE selfie_path END,
    entity_document_path = CASE WHEN p_purge_entity_document THEN NULL ELSE entity_document_path END
  WHERE id = p_request_id;

  IF p_purge_document OR p_purge_selfie THEN
    INSERT INTO data_purge_log (action, entity_type, record_id, subject_user_id, rule)
    VALUES ('identity_document_purged', 'verification_requests', p_request_id, v_user_id,
      CASE WHEN v_status = 'validee' THEN 'identity_validated_30d' ELSE 'identity_rejected_immediate' END);
  END IF;
  IF p_purge_entity_document THEN
    INSERT INTO data_purge_log (action, entity_type, record_id, subject_user_id, rule)
    VALUES ('entity_document_purged', 'verification_requests', p_request_id, v_user_id,
      CASE WHEN v_status = 'validee' THEN 'identity_validated_30d' ELSE 'identity_rejected_immediate' END);
  END IF;
END;
$$;

-- ============================================================================
-- D — Purge des vidéos de vérification de logement. Règle retenue : la vidéo
-- est la preuve du badge "vérifié" de l'annonce, pas une pièce d'identité —
-- conservée tant que l'annonce reste publiée/louée, purgée dès qu'elle
-- devient inactive, plafonnée à 12 mois même si l'annonce reste active.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.preview_listing_video_purge()
RETURNS TABLE(verification_id uuid, listing_id uuid, owner_id uuid, video_path text, rule text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lv.id, lv.listing_id, lv.owner_id, lv.video_path,
    CASE
      WHEN lv.status = 'rejetee' THEN 'video_rejected_immediate'
      WHEN l.status NOT IN ('publiee', 'louee') THEN 'video_listing_inactive'
      ELSE 'video_ceiling_12_months'
    END
  FROM listing_verifications lv
  JOIN listings l ON l.id = lv.listing_id
  WHERE lv.video_path IS NOT NULL
    AND (
      lv.status = 'rejetee'
      OR (lv.status = 'validee' AND (
        l.status NOT IN ('publiee', 'louee')
        OR lv.reviewed_at <= now() - interval '12 months'
      ))
    );
$$;

CREATE OR REPLACE FUNCTION public.commit_listing_video_purge(p_verification_id uuid, p_rule text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT owner_id INTO v_owner_id FROM listing_verifications
  WHERE id = p_verification_id AND video_path IS NOT NULL;
  IF v_owner_id IS NULL THEN
    RETURN; -- déjà purgée ou introuvable : idempotent
  END IF;

  UPDATE listing_verifications SET video_path = NULL WHERE id = p_verification_id;

  INSERT INTO data_purge_log (action, entity_type, record_id, subject_user_id, rule)
  VALUES ('listing_video_purged', 'listing_verifications', p_verification_id, v_owner_id, p_rule);
END;
$$;

-- ============================================================================
-- E — Droit à l'effacement : demande, rétractation (7 jours), blocages
-- ============================================================================
ALTER TABLE public.profiles ADD COLUMN deletion_requested_at timestamptz;

CREATE TABLE public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'annulee', 'executee')),
  cancelled_at timestamptz,
  executed_at timestamptz
);

-- Une seule demande active à la fois par compte.
CREATE UNIQUE INDEX account_deletion_requests_one_pending
  ON public.account_deletion_requests(user_id) WHERE status = 'en_attente';
CREATE INDEX account_deletion_requests_due_idx
  ON public.account_deletion_requests(scheduled_for) WHERE status = 'en_attente';

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_deletion_requests_select_own" ON public.account_deletion_requests
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "account_deletion_requests_select_admin" ON public.account_deletion_requests
  FOR SELECT USING (public.is_admin());
-- Aucune policy INSERT/UPDATE : tout passe par request_account_deletion() /
-- cancel_account_deletion() / execute_account_erasure() ci-dessous.

-- Refuse tant qu'un bail est actif, en attente de confirmation, ou qu'une
-- visite confirmée est à venir — dans les deux sens (bailleur ou locataire).
CREATE OR REPLACE FUNCTION public.has_account_deletion_blockers(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM leases
    WHERE (tenant_id = p_user_id OR landlord_id = p_user_id)
      AND status IN ('actif', 'en_attente_confirmation')
  ) OR EXISTS (
    SELECT 1 FROM visits
    WHERE (tenant_id = p_user_id OR landlord_id = p_user_id)
      AND status = 'confirmee' AND scheduled_at > now()
  );
$$;

REVOKE ALL ON FUNCTION public.has_account_deletion_blockers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_account_deletion_blockers(uuid) TO service_role;

-- Idempotente : une demande déjà en cours renvoie simplement son échéance
-- existante plutôt que d'en créer une seconde (l'index unique partiel
-- l'empêcherait de toute façon).
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

  INSERT INTO data_purge_log (action, entity_type, subject_user_id, rule)
  VALUES ('account_erasure_requested', 'profiles', v_user_id, 'user_requested');

  RETURN v_scheduled_for;
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_deletion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;

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

  UPDATE profiles SET deletion_requested_at = NULL WHERE id = v_user_id;

  INSERT INTO data_purge_log (action, entity_type, subject_user_id, rule)
  VALUES ('account_erasure_cancelled', 'profiles', v_user_id, 'user_cancelled');
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_account_deletion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion() TO authenticated;

-- ============================================================================
-- F — Exécution de l'effacement (appelée par l'Edge Function une fois les
-- fichiers du compte supprimés côté Storage — voir get_account_erasure_storage_paths)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_account_erasure_storage_paths(p_user_id uuid)
RETURNS TABLE(bucket text, storage_path text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Avatar : chemin déterministe (voir lib/avatar.ts), tenté même s'il n'existe
  -- pas — la suppression d'un objet absent n'est pas une erreur fatale.
  SELECT 'avatars', p_user_id::text || '/avatar.jpg'
  UNION ALL
  -- Photos de TOUTES les annonces du compte : les annonces elles-mêmes ne
  -- sont jamais supprimées (voir section G), mais leurs photos n'ont plus
  -- d'utilité une fois l'annonce dépubliée.
  SELECT 'listings', lm.storage_path
  FROM listing_media lm
  JOIN listings l ON l.id = lm.listing_id
  WHERE l.owner_id = p_user_id
  UNION ALL
  SELECT 'support-tickets', sta.storage_path
  FROM support_ticket_attachments sta
  JOIN support_tickets st ON st.id = sta.ticket_id
  WHERE st.user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.get_account_erasure_storage_paths(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_account_erasure_storage_paths(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.preview_account_erasures()
RETURNS TABLE(request_id uuid, user_id uuid, scheduled_for timestamptz, blocked boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, user_id, scheduled_for, public.has_account_deletion_blockers(user_id)
  FROM account_deletion_requests
  WHERE status = 'en_attente' AND scheduled_for <= now();
$$;

REVOKE ALL ON FUNCTION public.preview_account_erasures() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_account_erasures() TO service_role;

-- Cœur du chantier. Toute condition ci-dessous est une clause WHERE explicite
-- sur user_id/owner_id/tenant_id — jamais une suppression non bornée.
-- Idempotente : rejouée sur une demande déjà 'executee' ou disparue, elle ne
-- fait rien (voir le tout premier test). Revérifie les blocages à
-- l'exécution, pas seulement à la demande (un bail a pu être créé entre-temps).
--
-- G — Annonces : JAMAIS supprimées, y compris celles n'ayant jamais été
-- louées. Les supprimer risquerait une violation de clé étrangère en cours
-- d'exécution depuis des tables non maîtrisées exhaustivement ici (favoris
-- d'un tiers, visites, signalements, vérifications de logement...). Une
-- annonce dépubliée (status = 'brouillon') n'apparaît plus nulle part —
-- recherche, accueil, page résidence, profil public, favoris d'autrui —
-- puisque ces parcours filtrent déjà sur les statuts publiés ; le nom du
-- bailleur y est de toute façon remplacé par la pseudonymisation du profil.
CREATE OR REPLACE FUNCTION public.execute_account_erasure(p_request_id uuid)
RETURNS text -- 'executed' | 'blocked' | 'not_found'
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_status text;
BEGIN
  SELECT user_id, status INTO v_user_id, v_status
  FROM account_deletion_requests WHERE id = p_request_id;

  IF v_user_id IS NULL OR v_status <> 'en_attente' THEN
    RETURN 'not_found';
  END IF;

  IF public.has_account_deletion_blockers(v_user_id) THEN
    INSERT INTO data_purge_log (action, entity_type, record_id, subject_user_id, rule)
    VALUES ('account_erasure_blocked', 'account_deletion_requests', p_request_id, v_user_id,
      'blockers_present_at_execution');
    RETURN 'blocked'; -- reste 'en_attente', retenté au prochain passage quotidien
  END IF;

  -- Photos des annonces (voir G) : supprimées, l'annonce elle-même reste.
  DELETE FROM listing_media WHERE listing_id IN (SELECT id FROM listings WHERE owner_id = v_user_id);
  UPDATE listings SET status = 'brouillon' WHERE owner_id = v_user_id AND status <> 'brouillon';

  -- Résidences : supprimées seulement si elles ne contiennent plus aucune
  -- annonce (listings.residence_id ON DELETE SET NULL protège cette suppression).
  DELETE FROM residences
  WHERE manager_id = v_user_id
    AND NOT EXISTS (SELECT 1 FROM listings WHERE listings.residence_id = residences.id);

  -- Supprimé sans réserve.
  DELETE FROM favorites WHERE user_id = v_user_id;
  DELETE FROM listing_views WHERE user_id = v_user_id;
  DELETE FROM push_subscriptions WHERE user_id = v_user_id;
  DELETE FROM notifications WHERE user_id = v_user_id;
  DELETE FROM messages WHERE conversation_id IN (
    SELECT id FROM conversations WHERE tenant_id = v_user_id OR owner_id = v_user_id
  );
  DELETE FROM conversations WHERE tenant_id = v_user_id OR owner_id = v_user_id;
  DELETE FROM support_ticket_attachments WHERE ticket_id IN (
    SELECT id FROM support_tickets WHERE user_id = v_user_id
  );
  DELETE FROM support_messages WHERE ticket_id IN (
    SELECT id FROM support_tickets WHERE user_id = v_user_id
  );
  DELETE FROM support_tickets WHERE user_id = v_user_id;

  -- Détaché, pas supprimé (donnée agrégée dissociée d'une personne).
  UPDATE search_events SET user_id = NULL WHERE user_id = v_user_id;

  -- Copie en clair du téléphone hors de profiles (rattachement pré-compte) :
  -- pseudonymiser profiles.phone ne l'efface pas là. tenant_phone_normalized
  -- est une colonne générée (STORED) : elle se recalcule automatiquement à
  -- partir de tenant_phone, ne jamais l'assigner directement.
  UPDATE leases SET tenant_phone = '' WHERE tenant_id = v_user_id;

  -- Profil : pseudonymisé, jamais supprimé (voir l'audit en tête de fichier).
  -- Toute table conservée pseudonymisée (quittances, états des lieux, baux,
  -- lease_requests, lease_amendments...) hérite de ceci via sa jointure vers
  -- profiles, sans rien avoir à leur toucher individuellement.
  UPDATE profiles SET
    full_name = 'Utilisateur supprimé',
    phone = NULL,
    city = NULL,
    avatar_url = NULL,
    email = NULL,
    bio = NULL,
    deletion_requested_at = NULL
  WHERE id = v_user_id;

  UPDATE account_deletion_requests SET status = 'executee', executed_at = now() WHERE id = p_request_id;

  INSERT INTO data_purge_log (action, entity_type, subject_user_id, rule)
  VALUES ('account_erasure_executed', 'profiles', v_user_id, 'account_erasure_7d');

  RETURN 'executed';
END;
$$;

REVOKE ALL ON FUNCTION public.execute_account_erasure(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_account_erasure(uuid) TO service_role;

-- ============================================================================
-- ⚠️ AUCUNE ACTIVATION ICI — geste manuel après validation en mode simulation
-- ============================================================================
-- Cette migration ne programme rien : ni cron.schedule, ni déploiement de
-- l'Edge Function supabase/functions/data-retention-purge. Après avoir
-- déployé cette fonction, l'invoquer manuellement avec dry_run=true (valeur
-- par défaut), vérifier le rapport, puis SEULEMENT ENSUITE programmer son
-- appel quotidien via un Cron Job du Dashboard Supabase — même geste que
-- rent-reminders et visits_process_scheduled, jamais versionné en SQL dans
-- ce repo.

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP FUNCTION IF EXISTS public.execute_account_erasure(uuid);
-- DROP FUNCTION IF EXISTS public.preview_account_erasures();
-- DROP FUNCTION IF EXISTS public.get_account_erasure_storage_paths(uuid);
-- DROP FUNCTION IF EXISTS public.cancel_account_deletion();
-- DROP FUNCTION IF EXISTS public.request_account_deletion();
-- DROP FUNCTION IF EXISTS public.has_account_deletion_blockers(uuid);
-- DROP TABLE IF EXISTS public.account_deletion_requests;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS deletion_requested_at;
-- DROP FUNCTION IF EXISTS public.commit_listing_video_purge(uuid, text);
-- DROP FUNCTION IF EXISTS public.preview_listing_video_purge();
-- DROP FUNCTION IF EXISTS public.commit_identity_document_purge(uuid, boolean, boolean, boolean);
-- DROP FUNCTION IF EXISTS public.preview_identity_document_purge();
-- DROP TABLE IF EXISTS public.data_purge_log;
-- ALTER TABLE public.verification_requests DROP COLUMN IF EXISTS document_hash;
-- ALTER TABLE public.verification_requests DROP COLUMN IF EXISTS selfie_hash;
-- ALTER TABLE public.verification_requests DROP COLUMN IF EXISTS entity_document_hash;
