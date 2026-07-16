-- Chantier — Pièces jointes dans la messagerie.
--
-- Reprend à l'identique le patron déjà en place pour lease_requests
-- (20260712120000_lease_requests.sql) : bucket privé, table de pièces
-- jointes, dérivation serveur de l'auteur, RLS scindée table+storage sur les
-- deux parties d'une relation (ici une conversation, là un bail).
--
-- ⚠️ Ne pas exécuter automatiquement : migration manuelle. messages/
-- conversations ne sont PAS versionnées dans ce repo (schéma de base) —
-- avant d'exécuter ce fichier, vérifier qu'aucune contrainte n'empêche déjà
-- un body vide :
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.messages'::regclass AND contype = 'c';
-- (nécessaire puisqu'un message "image seule" envoie body = '').

-- ============================================================================
-- A — Bucket + table
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Contrairement à lease_request_attachments.message_id (nullable, pour des
-- pièces jointes "de la demande" avant tout message), ici chaque pièce
-- jointe accompagne forcément un message : pas d'entité de niveau supérieur
-- à rattacher, donc NOT NULL directement.
CREATE TABLE public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id),
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX message_attachments_message_id_idx ON public.message_attachments(message_id);

-- ============================================================================
-- B — Trigger : dérivation de l'auteur (jamais fié au client) + plafond par
-- message vérifié en base, pas seulement côté client.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.message_attachments_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  NEW.uploaded_by := auth.uid();

  SELECT count(*) INTO v_count FROM public.message_attachments WHERE message_id = NEW.message_id;
  IF v_count >= 6 THEN
    RAISE EXCEPTION 'Maximum 6 images par message.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER message_attachments_before_insert_trigger
  BEFORE INSERT ON public.message_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.message_attachments_before_insert();

-- ============================================================================
-- C — RLS table + storage, calquée sur lease_request_attachments/lease-requests
-- ============================================================================
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_attachments_select_parties" ON public.message_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_attachments.message_id
        AND (c.tenant_id = auth.uid() OR c.owner_id = auth.uid())
    )
  );

-- Cohérence avec le reste du projet (modération/litige éventuel) : aucune
-- interface admin de consultation des conversations n'existe aujourd'hui,
-- rien à construire côté back-office ici, juste la capacité en base.
CREATE POLICY "message_attachments_select_admin" ON public.message_attachments
  FOR SELECT USING (public.is_admin());

CREATE POLICY "message_attachments_insert_parties" ON public.message_attachments
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.messages m JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_attachments.message_id
        AND (c.tenant_id = auth.uid() OR c.owner_id = auth.uid())
    )
  );
-- Pas de policy UPDATE/DELETE : immuable, comme lease_request_attachments.

-- Storage : chemin ${conversationId}/${messageId}/... — storage.foldername
-- donne le premier segment, comparé à conversations.id (même raisonnement
-- que lease-requests : DEUX utilisateurs doivent lire les mêmes fichiers,
-- d'où une jointure sur conversations plutôt qu'une comparaison directe à
-- auth.uid()).
CREATE POLICY "message_attachments_bucket_select_parties" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'message-attachments'
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id::text = (storage.foldername(name))[1]
        AND (conversations.tenant_id = auth.uid() OR conversations.owner_id = auth.uid())
    )
  );

CREATE POLICY "message_attachments_bucket_select_admin" ON storage.objects
  FOR SELECT USING (bucket_id = 'message-attachments' AND public.is_admin());

CREATE POLICY "message_attachments_bucket_insert_parties" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'message-attachments'
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id::text = (storage.foldername(name))[1]
        AND (conversations.tenant_id = auth.uid() OR conversations.owner_id = auth.uid())
    )
  );

-- ============================================================================
-- D — Combler un trou trouvé en explorant : conversations_deletion_guard
-- (20260717120000_account_deletion_freeze.sql) ne bloque que la CRÉATION
-- d'une nouvelle conversation ; rien ne bloquait l'envoi d'un message dans
-- une conversation déjà ouverte pour un compte gelé ou suspendu. Additif,
-- n'interfère avec aucun trigger existant sur messages (notamment
-- messages_after_insert_notify, AFTER INSERT — ordre différent). Couvre à
-- la fois les messages texte et les pièces jointes : sans ligne dans
-- messages, impossible d'obtenir un message_id à attacher.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.messages_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_pending_deletion(NEW.sender_id) THEN
    RAISE EXCEPTION 'Votre compte est en cours de suppression : impossible d''envoyer un message tant que la demande est en attente.';
  END IF;
  IF public.is_suspended(NEW.sender_id) THEN
    RAISE EXCEPTION 'Votre compte fait l''objet d''une restriction. Contactez le support.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_guard_trigger
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.messages_guard();

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP TRIGGER IF EXISTS messages_guard_trigger ON public.messages;
-- DROP FUNCTION IF EXISTS public.messages_guard();
-- DROP POLICY IF EXISTS "message_attachments_bucket_insert_parties" ON storage.objects;
-- DROP POLICY IF EXISTS "message_attachments_bucket_select_admin" ON storage.objects;
-- DROP POLICY IF EXISTS "message_attachments_bucket_select_parties" ON storage.objects;
-- DROP TABLE IF EXISTS public.message_attachments;
-- DROP FUNCTION IF EXISTS public.message_attachments_before_insert();
-- DELETE FROM storage.buckets WHERE id = 'message-attachments';
