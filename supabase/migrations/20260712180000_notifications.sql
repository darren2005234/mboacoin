-- Chantier NOTIFICATIONS-1 — socle des notifications in-app.
--
-- Valeurs de `type` utilisées par cette migration (texte libre, pas de
-- CHECK — voir plan pour la justification) :
--   lease_created, lease_confirmed, lease_rejected, lease_resiliated,
--   lease_ended, lease_amendment_proposed, lease_amendment_accepted,
--   lease_amendment_refused, lease_payment_declared, lease_document_added,
--   lease_request_created, lease_request_updated, lease_request_reopened,
--   lease_request_message, listing_suspended, message_received,
--   verification_approved, verification_rejected,
--   listing_verification_approved, listing_verification_rejected.

-- ============================================================================
-- PRÉ-VOL (lecture seule) — à exécuter avant la Partie C (tables non
-- versionnées : conversations/messages, verification_requests,
-- listing_verifications). Confirme les noms de colonnes réels ; si un nom
-- diffère de ce qui est supposé plus bas (sender_id/conversation_id sur
-- messages, tenant_id/owner_id sur conversations, user_id sur
-- verification_requests, owner_id/listing_id sur listing_verifications),
-- ajuster la Partie C avant de l'exécuter.
-- ============================================================================
-- SELECT table_name, column_name, data_type FROM information_schema.columns
-- WHERE table_name IN ('conversations','messages','verification_requests','listing_verifications')
-- ORDER BY table_name, ordinal_position;

-- ============================================================================
-- A.1 — Table notifications
-- ============================================================================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  lease_id uuid REFERENCES public.leases(id) ON DELETE CASCADE,
  lease_request_id uuid REFERENCES public.lease_requests(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_created_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx ON public.notifications(user_id) WHERE read_at IS NULL;

-- ============================================================================
-- A.2 — RLS : chacun ne voit/modifie que ses notifications ; admin voit tout
-- ============================================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_select_admin" ON public.notifications
  FOR SELECT USING (public.is_admin());

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- Pas de policy INSERT/DELETE pour les utilisateurs : seules les fonctions
-- trigger SECURITY DEFINER ci-dessous peuvent créer des notifications.

-- Verrou de contenu : seul read_at est modifiable par le destinataire
-- (même pattern que leases_before_update, sans SECURITY DEFINER ici car
-- l'auteur a déjà le droit RLS sur sa propre ligne).
CREATE OR REPLACE FUNCTION public.notifications_before_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.title IS DISTINCT FROM OLD.title OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.link IS DISTINCT FROM OLD.link OR NEW.lease_id IS DISTINCT FROM OLD.lease_id
     OR NEW.lease_request_id IS DISTINCT FROM OLD.lease_request_id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.listing_id IS DISTINCT FROM OLD.listing_id
     OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Seul read_at est modifiable sur une notification.';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER notifications_before_update_trigger
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notifications_before_update();

-- ============================================================================
-- A.3 — Helper commun : centralise la garde anti-auto-notification
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notifications_create(
  p_user_id uuid, p_actor_id uuid, p_type text, p_title text, p_body text DEFAULT NULL,
  p_link text DEFAULT NULL, p_lease_id uuid DEFAULT NULL, p_lease_request_id uuid DEFAULT NULL,
  p_conversation_id uuid DEFAULT NULL, p_listing_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id = p_actor_id THEN
    RETURN; -- pas de destinataire, ou destinataire = auteur : no-op
  END IF;
  INSERT INTO public.notifications
    (user_id, actor_id, type, title, body, link, lease_id, lease_request_id, conversation_id, listing_id)
  VALUES
    (p_user_id, p_actor_id, p_type, p_title, p_body, p_link, p_lease_id, p_lease_request_id, p_conversation_id, p_listing_id);
END; $$;

-- ============================================================================
-- PARTIE B — tables au schéma certain (leases, tables filles, listings)
-- ============================================================================

-- B.1 — leases : création différée (rattachement locataire) + 4 transitions
CREATE OR REPLACE FUNCTION public.leases_after_update_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Rattachement du locataire = moment où "un bail vous a été créé" devient notifiable.
  -- Exception volontaire à la règle anti-auto-notification : l'acteur technique de cet
  -- UPDATE est le locataire lui-même (link_my_pending_leases()), mais l'événement notifié
  -- (création du bail) est le fait du bailleur.
  IF OLD.tenant_id IS NULL AND NEW.tenant_id IS NOT NULL AND NEW.status = 'en_attente_confirmation' THEN
    PERFORM public.notifications_create(NEW.tenant_id, NEW.landlord_id, 'lease_created',
      'Un bail vous a été créé', 'Confirmez ou refusez ce bail.',
      '/my-lease/' || NEW.id, NEW.id, NULL, NULL, NEW.listing_id);
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.status = 'en_attente_confirmation' AND NEW.status = 'actif' THEN
      PERFORM public.notifications_create(NEW.landlord_id, NEW.tenant_id, 'lease_confirmed',
        'Votre locataire a confirmé le bail', NULL, '/my-leases/' || NEW.id, NEW.id, NULL, NULL, NEW.listing_id);
    ELSIF OLD.status = 'en_attente_confirmation' AND NEW.status = 'rejete' THEN
      PERFORM public.notifications_create(NEW.landlord_id, NEW.tenant_id, 'lease_rejected',
        'Votre locataire a refusé le bail', NULL, '/my-leases/' || NEW.id, NEW.id, NULL, NULL, NEW.listing_id);
    ELSIF OLD.status = 'actif' AND NEW.status = 'resilie' THEN
      PERFORM public.notifications_create(NEW.landlord_id, NEW.tenant_id, 'lease_resiliated',
        'Votre locataire a résilié le bail', NEW.end_reason, '/my-leases/' || NEW.id, NEW.id, NULL, NULL, NEW.listing_id);
    ELSIF OLD.status = 'actif' AND NEW.status IN ('termine', 'arrete') THEN
      PERFORM public.notifications_create(NEW.tenant_id, NEW.landlord_id, 'lease_ended',
        'Votre bailleur a mis fin au bail', NEW.end_reason, '/my-lease/' || NEW.id, NEW.id, NULL, NULL, NEW.listing_id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER leases_after_update_notify_trigger
  AFTER UPDATE ON public.leases FOR EACH ROW EXECUTE FUNCTION public.leases_after_update_notify();

-- B.2 — lease_amendments : proposition + réponse
CREATE OR REPLACE FUNCTION public.lease_amendments_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant_id uuid; v_listing_id uuid;
BEGIN
  SELECT tenant_id, listing_id INTO v_tenant_id, v_listing_id FROM public.leases WHERE id = NEW.lease_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.notifications_create(v_tenant_id, NEW.proposed_by, 'lease_amendment_proposed',
      'Votre bailleur propose une modification du bail', NEW.reason,
      '/my-lease/' || NEW.lease_id, NEW.lease_id, NULL, NULL, v_listing_id);
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'en_attente' AND NEW.status = 'acceptee' THEN
    PERFORM public.notifications_create(OLD.proposed_by, v_tenant_id, 'lease_amendment_accepted',
      'Votre locataire a accepté la modification', NULL, '/my-leases/' || NEW.lease_id, NEW.lease_id, NULL, NULL, v_listing_id);
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'en_attente' AND NEW.status = 'refusee' THEN
    PERFORM public.notifications_create(OLD.proposed_by, v_tenant_id, 'lease_amendment_refused',
      'Votre locataire a refusé la modification', NULL, '/my-leases/' || NEW.lease_id, NEW.lease_id, NULL, NULL, v_listing_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER lease_amendments_notify_trigger
  AFTER INSERT OR UPDATE ON public.lease_amendments
  FOR EACH ROW EXECUTE FUNCTION public.lease_amendments_notify();

-- B.3 — lease_payments : quittance disponible
CREATE OR REPLACE FUNCTION public.lease_payments_after_insert_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant_id uuid; v_listing_id uuid;
BEGIN
  SELECT tenant_id, listing_id INTO v_tenant_id, v_listing_id FROM public.leases WHERE id = NEW.lease_id;

  PERFORM public.notifications_create(v_tenant_id, NEW.declared_by, 'lease_payment_declared',
    'Votre bailleur a déclaré un paiement', 'Quittance n° ' || NEW.receipt_number || ' disponible.',
    '/my-lease/' || NEW.lease_id, NEW.lease_id, NULL, NULL, v_listing_id);
  RETURN NEW;
END; $$;

CREATE TRIGGER lease_payments_after_insert_notify_trigger
  AFTER INSERT ON public.lease_payments
  FOR EACH ROW EXECUTE FUNCTION public.lease_payments_after_insert_notify();

-- B.4 — lease_documents : contrat ajouté
CREATE OR REPLACE FUNCTION public.lease_documents_after_insert_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant_id uuid; v_listing_id uuid;
BEGIN
  IF NEW.document_type <> 'contrat' THEN
    RETURN NEW;
  END IF;

  SELECT tenant_id, listing_id INTO v_tenant_id, v_listing_id FROM public.leases WHERE id = NEW.lease_id;

  PERFORM public.notifications_create(v_tenant_id, NEW.uploaded_by, 'lease_document_added',
    'Le contrat de bail est disponible', NULL, '/my-lease/' || NEW.lease_id, NEW.lease_id, NULL, NULL, v_listing_id);
  RETURN NEW;
END; $$;

CREATE TRIGGER lease_documents_after_insert_notify_trigger
  AFTER INSERT ON public.lease_documents
  FOR EACH ROW EXECUTE FUNCTION public.lease_documents_after_insert_notify();

-- B.5 — lease_requests : nouvelle demande, mise à jour, réouverture
CREATE OR REPLACE FUNCTION public.lease_requests_after_change_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant_id uuid; v_landlord_id uuid; v_listing_id uuid;
BEGIN
  SELECT tenant_id, landlord_id, listing_id INTO v_tenant_id, v_landlord_id, v_listing_id
  FROM public.leases WHERE id = NEW.lease_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.notifications_create(v_landlord_id, NEW.created_by, 'lease_request_created',
      'Nouvelle demande de votre locataire : ' || NEW.subject, NEW.description,
      '/requests/' || NEW.id, NULL, NEW.id, NULL, v_listing_id);
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status IN ('en_cours', 'resolue', 'fermee') THEN
      PERFORM public.notifications_create(v_tenant_id, v_landlord_id, 'lease_request_updated',
        'Votre demande a été mise à jour : ' || NEW.subject, NULL,
        '/requests/' || NEW.id, NULL, NEW.id, NULL, v_listing_id);
    ELSIF OLD.status = 'resolue' AND NEW.status = 'nouvelle' THEN
      PERFORM public.notifications_create(v_landlord_id, v_tenant_id, 'lease_request_reopened',
        'Votre locataire a rouvert une demande : ' || NEW.subject, NULL,
        '/requests/' || NEW.id, NULL, NEW.id, NULL, v_listing_id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER lease_requests_after_change_notify_trigger
  AFTER INSERT OR UPDATE ON public.lease_requests
  FOR EACH ROW EXECUTE FUNCTION public.lease_requests_after_change_notify();

-- B.6 — lease_request_messages : nouveau message dans une demande
CREATE OR REPLACE FUNCTION public.lease_request_messages_after_insert_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant_id uuid; v_landlord_id uuid; v_listing_id uuid; v_recipient uuid; v_subject text;
BEGIN
  SELECT lr.tenant_id, lr.landlord_id, lr.listing_id, lreq.subject
    INTO v_tenant_id, v_landlord_id, v_listing_id, v_subject
  FROM public.lease_requests lreq
  JOIN public.leases lr ON lr.id = lreq.lease_id
  WHERE lreq.id = NEW.request_id;

  v_recipient := CASE WHEN NEW.sender_id = v_tenant_id THEN v_landlord_id ELSE v_tenant_id END;

  PERFORM public.notifications_create(v_recipient, NEW.sender_id, 'lease_request_message',
    'Nouveau message : ' || v_subject, NULL, '/requests/' || NEW.request_id, NULL, NEW.request_id, NULL, v_listing_id);
  RETURN NEW;
END; $$;

CREATE TRIGGER lease_request_messages_after_insert_notify_trigger
  AFTER INSERT ON public.lease_request_messages
  FOR EACH ROW EXECUTE FUNCTION public.lease_request_messages_after_insert_notify();

-- B.7 — listings : suspension suite à modération
CREATE OR REPLACE FUNCTION public.listings_after_update_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'suspendue' THEN
    PERFORM public.notifications_create(NEW.owner_id, NULL, 'listing_suspended',
      'Votre annonce a été suspendue', 'Suite à un signalement, votre annonce « ' || NEW.title || ' » a été suspendue.',
      '/listings/' || NEW.id, NULL, NULL, NULL, NEW.id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER listings_after_update_notify_trigger
  AFTER UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.listings_after_update_notify();

-- ============================================================================
-- PARTIE C — tables au schéma non versionné. ⚠ Exécuter le PRÉ-VOL en haut
-- de ce fichier d'abord ; ajuster les noms de colonnes ci-dessous si besoin
-- avant d'exécuter cette partie.
-- ============================================================================

-- C.1 — messages : nouveau message reçu dans une conversation
-- Colonnes supposées : messages(sender_id, conversation_id, body),
-- conversations(tenant_id, owner_id) — déduites de lib/messages.ts / lib/conversations.ts.
CREATE OR REPLACE FUNCTION public.messages_after_insert_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant_id uuid; v_owner_id uuid; v_recipient uuid;
BEGIN
  SELECT tenant_id, owner_id INTO v_tenant_id, v_owner_id
  FROM public.conversations WHERE id = NEW.conversation_id;

  v_recipient := CASE WHEN NEW.sender_id = v_tenant_id THEN v_owner_id ELSE v_tenant_id END;

  PERFORM public.notifications_create(v_recipient, NEW.sender_id, 'message_received',
    'Nouveau message', left(NEW.body, 140), '/messages/' || NEW.conversation_id, NULL, NULL, NEW.conversation_id, NULL);
  RETURN NEW;
END; $$;

CREATE TRIGGER messages_after_insert_notify_trigger
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_after_insert_notify();

-- C.2 — verification_requests : vérification d'identité approuvée/rejetée
-- Colonnes supposées : verification_requests(user_id, status, rejection_reason).
CREATE OR REPLACE FUNCTION public.verification_requests_after_update_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'validee' THEN
    PERFORM public.notifications_create(NEW.user_id, NULL, 'verification_approved',
      'Votre vérification d''identité a été approuvée', NULL, '/profile', NULL, NULL, NULL, NULL);
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'rejetee' THEN
    PERFORM public.notifications_create(NEW.user_id, NULL, 'verification_rejected',
      'Votre vérification d''identité a été refusée', NEW.rejection_reason, '/profile', NULL, NULL, NULL, NULL);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER verification_requests_after_update_notify_trigger
  AFTER UPDATE ON public.verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.verification_requests_after_update_notify();

-- C.3 — listing_verifications : vérification d'annonce approuvée/rejetée
-- Colonnes supposées : listing_verifications(owner_id, listing_id, status, rejection_reason).
CREATE OR REPLACE FUNCTION public.listing_verifications_after_update_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'validee' THEN
    PERFORM public.notifications_create(NEW.owner_id, NULL, 'listing_verification_approved',
      'Votre annonce a été vérifiée', NULL, '/listings/' || NEW.listing_id, NULL, NULL, NULL, NEW.listing_id);
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'rejetee' THEN
    PERFORM public.notifications_create(NEW.owner_id, NULL, 'listing_verification_rejected',
      'La vérification de votre annonce a été refusée', NEW.rejection_reason, '/listings/' || NEW.listing_id, NULL, NULL, NULL, NEW.listing_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER listing_verifications_after_update_notify_trigger
  AFTER UPDATE ON public.listing_verifications
  FOR EACH ROW EXECUTE FUNCTION public.listing_verifications_after_update_notify();

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP TRIGGER IF EXISTS listing_verifications_after_update_notify_trigger ON public.listing_verifications;
-- DROP TRIGGER IF EXISTS verification_requests_after_update_notify_trigger ON public.verification_requests;
-- DROP TRIGGER IF EXISTS messages_after_insert_notify_trigger ON public.messages;
-- DROP TRIGGER IF EXISTS listings_after_update_notify_trigger ON public.listings;
-- DROP TRIGGER IF EXISTS lease_request_messages_after_insert_notify_trigger ON public.lease_request_messages;
-- DROP TRIGGER IF EXISTS lease_requests_after_change_notify_trigger ON public.lease_requests;
-- DROP TRIGGER IF EXISTS lease_documents_after_insert_notify_trigger ON public.lease_documents;
-- DROP TRIGGER IF EXISTS lease_payments_after_insert_notify_trigger ON public.lease_payments;
-- DROP TRIGGER IF EXISTS lease_amendments_notify_trigger ON public.lease_amendments;
-- DROP TRIGGER IF EXISTS leases_after_update_notify_trigger ON public.leases;
-- DROP FUNCTION IF EXISTS public.listing_verifications_after_update_notify();
-- DROP FUNCTION IF EXISTS public.verification_requests_after_update_notify();
-- DROP FUNCTION IF EXISTS public.messages_after_insert_notify();
-- DROP FUNCTION IF EXISTS public.listings_after_update_notify();
-- DROP FUNCTION IF EXISTS public.lease_request_messages_after_insert_notify();
-- DROP FUNCTION IF EXISTS public.lease_requests_after_change_notify();
-- DROP FUNCTION IF EXISTS public.lease_documents_after_insert_notify();
-- DROP FUNCTION IF EXISTS public.lease_payments_after_insert_notify();
-- DROP FUNCTION IF EXISTS public.lease_amendments_notify();
-- DROP FUNCTION IF EXISTS public.leases_after_update_notify();
-- DROP FUNCTION IF EXISTS public.notifications_create(uuid,uuid,text,text,text,text,uuid,uuid,uuid,uuid);
-- DROP TABLE IF EXISTS public.notifications;
