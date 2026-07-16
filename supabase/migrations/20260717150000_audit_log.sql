-- Chantier — Journal d'audit des actions sensibles (CDC 11.10).
--
-- Convention à respecter pour toute évolution future de ce journal :
--   - Écriture seule (append-only) : jamais d'UPDATE ni de DELETE, pas même
--     par un administrateur. Aucune policy RLS UPDATE/DELETE n'existe et ne
--     doit jamais être ajoutée sur audit_log.
--   - Toute écriture passe par une fonction SECURITY DEFINER
--     (audit_log_write ou log_document_access ci-dessous) — jamais d'INSERT
--     direct par un client (REVOKE INSERT sur la table elle-même).
--   - Ne JAMAIS y stocker de contenu sensible (contenu de document, données
--     personnelles au-delà des identifiants) : uniquement qui, quand, quelle
--     action, sur quelle cible, et un motif/résultat en texte court.
--   - Une écriture ratée dans ce journal ne doit jamais faire échouer
--     l'action qu'elle trace (voir le bloc EXCEPTION de audit_log_write).
--
-- Rapport avec data_purge_log (20260717100000_data_retention_purge.sql) :
-- tables séparées, volontairement. data_purge_log documente des actions
-- système (job de rétention) ou de l'utilisateur sur son PROPRE compte
-- (demande/annulation d'effacement) ; audit_log documente des décisions d'un
-- ADMIN sur les données d'un TIERS. Sémantique différente (rule vs detail,
-- performed_by texte vs actor_id typé), pas de bénéfice à fusionner des
-- fonctions déjà en prod. Si un utilisateur demande un jour l'historique des
-- accès à ses données, l'admin interroge les deux tables manuellement (pas
-- d'interface dédiée pour l'instant, cf. section 4 du CDC).

-- ============================================================================
-- A — Table
-- ============================================================================
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  action text NOT NULL CHECK (action IN (
    'identity_verification_decision', 'listing_verification_decision',
    'identity_document_accessed', 'listing_video_accessed',
    'account_suspended', 'account_unsuspended',
    'listing_suspended', 'report_handled', 'report_dismissed'
  )),
  target_type text NOT NULL CHECK (target_type IN
    ('user', 'listing', 'verification_request', 'listing_verification', 'report')),
  target_id uuid NOT NULL,
  -- Dénormalisé volontairement : quelle personne est concernée, quel que soit
  -- target_type — permet un WHERE simple pour "tout ce qui touche cet
  -- utilisateur", même patron que data_purge_log.subject_user_id.
  target_user_id uuid REFERENCES public.profiles(id),
  detail text -- motif/résultat en texte court, JAMAIS de contenu de document
);

CREATE INDEX audit_log_target_user_id_idx ON public.audit_log(target_user_id);
CREATE INDEX audit_log_actor_id_idx ON public.audit_log(actor_id);
CREATE INDEX audit_log_action_idx ON public.audit_log(action);
CREATE INDEX audit_log_occurred_at_idx ON public.audit_log(occurred_at DESC);

-- ============================================================================
-- B — Inviolabilité : lecture admin uniquement, aucune policy d'écriture.
-- ============================================================================
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select_admin" ON public.audit_log
  FOR SELECT USING (public.is_admin());
-- Aucune policy INSERT / UPDATE / DELETE : rien ne peut écrire par la voie RLS,
-- quelle que soit l'identité de l'appelant.

REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM authenticated, anon;
GRANT SELECT ON public.audit_log TO authenticated; -- filtré ensuite par la policy ci-dessus

-- ============================================================================
-- C — Écriture, à deux niveaux de confiance
-- ============================================================================

-- C.1 — Interne. JAMAIS de GRANT EXECUTE à authenticated : appelée
-- uniquement depuis d'autres fonctions SECURITY DEFINER ou des triggers (qui
-- tournent avec les privilèges du définisseur), donc inatteignable
-- directement par un client — pas besoin d'y revérifier is_admin().
CREATE OR REPLACE FUNCTION public.audit_log_write(
  p_action text, p_target_type text, p_target_id uuid,
  p_target_user_id uuid, p_detail text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO audit_log (actor_id, action, target_type, target_id, target_user_id, detail)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, p_target_user_id, p_detail);
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais faire échouer l'action tracée : best-effort, l'échec reste
  -- visible dans les logs serveur Postgres.
  RAISE WARNING 'audit_log_write a échoué: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_log_write(text, text, uuid, uuid, text) FROM PUBLIC;

-- C.2 — Point d'entrée admin exposé au client, pour journaliser un ACCÈS À UN
-- DOCUMENT (une génération d'URL signée n'est pas une écriture en base, donc
-- rien à accrocher à un trigger). Revérifie is_admin() lui-même : c'est le
-- seul point de cette migration réellement appelable par un client, il ne
-- doit jamais laisser un non-admin écrire une ligne.
CREATE OR REPLACE FUNCTION public.log_document_access(
  p_action text, p_target_type text, p_target_id uuid,
  p_target_user_id uuid, p_detail text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;
  PERFORM public.audit_log_write(p_action, p_target_type, p_target_id, p_target_user_id, p_detail);
END;
$$;

REVOKE ALL ON FUNCTION public.log_document_access(text, text, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_document_access(text, text, uuid, uuid, text) TO authenticated;

-- ============================================================================
-- D — Intégration : triggers sur les tables déjà existantes (additifs,
-- n'interfèrent avec aucun trigger déjà en place sur ces tables).
-- ============================================================================

-- D.1 — Décisions de vérification d'identité/entité (une seule décision par
-- ligne dans ce schéma : identité et entité se valident/rejettent ensemble).
CREATE OR REPLACE FUNCTION public.verification_requests_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'en_attente' AND NEW.status IN ('validee', 'rejetee') THEN
    PERFORM public.audit_log_write(
      'identity_verification_decision', 'verification_request', NEW.id, NEW.user_id,
      NEW.status || COALESCE(' : ' || NEW.rejection_reason, '')
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER verification_requests_audit_trigger_trigger
  AFTER UPDATE ON public.verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.verification_requests_audit_trigger();

-- D.2 — Décisions de vérification de logement (vidéo).
CREATE OR REPLACE FUNCTION public.listing_verifications_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'en_attente' AND NEW.status IN ('validee', 'rejetee') THEN
    PERFORM public.audit_log_write(
      'listing_verification_decision', 'listing_verification', NEW.id, NEW.owner_id,
      NEW.status || COALESCE(' : ' || NEW.rejection_reason, '')
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER listing_verifications_audit_trigger_trigger
  AFTER UPDATE ON public.listing_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.listing_verifications_audit_trigger();

-- D.3 — Suspension d'annonce par modération (même condition de déclenchement
-- que le trigger de notification existant listings_after_update_notify,
-- 20260712180000_notifications.sql — trigger dédié et séparé, préoccupation
-- différente : celui-ci alimente l'audit, pas la notification).
CREATE OR REPLACE FUNCTION public.listings_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'suspendue' THEN
    PERFORM public.audit_log_write('listing_suspended', 'listing', NEW.id, NEW.owner_id, NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER listings_audit_trigger_trigger
  AFTER UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.listings_audit_trigger();

-- D.4 — Traitement d'un signalement (couvre en un seul trigger
-- markReportHandled, dismissReport, suspendReportedListing et
-- suspendReportedUser — lib/admin-reports.ts — sans toucher à ces 4
-- fonctions). target_user_id résout le compte concerné que le signalement
-- porte sur un utilisateur (reported_user_id) ou sur une annonce (via son
-- propriétaire).
CREATE OR REPLACE FUNCTION public.reports_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_user_id uuid;
BEGIN
  IF OLD.status = 'ouvert' AND NEW.status IN ('traite', 'rejete') THEN
    v_target_user_id := COALESCE(
      NEW.reported_user_id,
      (SELECT owner_id FROM listings WHERE id = NEW.listing_id)
    );
    PERFORM public.audit_log_write(
      CASE WHEN NEW.status = 'traite' THEN 'report_handled' ELSE 'report_dismissed' END,
      'report', NEW.id, v_target_user_id, NEW.reason
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reports_audit_trigger_trigger
  AFTER UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.reports_audit_trigger();

-- ============================================================================
-- E — Intégration directe dans les fonctions SECURITY DEFINER existantes
-- (20260717130000_account_suspension.sql) : pas de trigger nécessaire, déjà
-- le bon endroit pour écrire le journal dans la même transaction.
-- ============================================================================
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

  UPDATE listings SET status = 'brouillon', suspension_freeze_active = true
  WHERE owner_id = p_user_id AND status = 'publiee';

  PERFORM public.audit_log_write('account_suspended', 'user', p_user_id, p_user_id, p_reason);
END;
$$;

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

  UPDATE listings SET status = 'publiee', suspension_freeze_active = false
  WHERE owner_id = p_user_id AND suspension_freeze_active = true AND NOT deletion_freeze_active;

  UPDATE listings SET suspension_freeze_active = false
  WHERE owner_id = p_user_id AND suspension_freeze_active = true AND deletion_freeze_active;

  PERFORM public.audit_log_write('account_unsuspended', 'user', p_user_id, p_user_id, NULL);
END;
$$;

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- (suspend_account/unsuspend_account reviendraient à leur version 20260717130000 si retiré)
-- DROP TRIGGER IF EXISTS reports_audit_trigger_trigger ON public.reports;
-- DROP FUNCTION IF EXISTS public.reports_audit_trigger();
-- DROP TRIGGER IF EXISTS listings_audit_trigger_trigger ON public.listings;
-- DROP FUNCTION IF EXISTS public.listings_audit_trigger();
-- DROP TRIGGER IF EXISTS listing_verifications_audit_trigger_trigger ON public.listing_verifications;
-- DROP FUNCTION IF EXISTS public.listing_verifications_audit_trigger();
-- DROP TRIGGER IF EXISTS verification_requests_audit_trigger_trigger ON public.verification_requests;
-- DROP FUNCTION IF EXISTS public.verification_requests_audit_trigger();
-- DROP FUNCTION IF EXISTS public.log_document_access(text, text, uuid, uuid, text);
-- DROP FUNCTION IF EXISTS public.audit_log_write(text, text, uuid, uuid, text);
-- DROP TABLE IF EXISTS public.audit_log;
