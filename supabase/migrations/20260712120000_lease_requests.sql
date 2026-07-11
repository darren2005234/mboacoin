-- Sous-chantier BAIL-4 (partie A) — Demandes structurées post-bail
-- Additif uniquement : aucune table/bucket existant n'est modifié.
-- Voir le plan complet dans .claude/plans (ou l'historique de conversation) pour le contexte.
-- Distinct et sans lien avec conversations/messages (messagerie avant-bail liée aux annonces).

-- ============================================================================
-- A.1 — Bucket privé lease-requests (photos jointes)
-- ============================================================================
-- Équivalent dashboard : Storage → New bucket → "lease-requests" → Private.
INSERT INTO storage.buckets (id, name, public)
VALUES ('lease-requests', 'lease-requests', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- A.2 — Tables
-- ============================================================================
CREATE TABLE public.lease_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id),
  type text NOT NULL CHECK (type IN ('reparation', 'probleme_logement', 'question_bail', 'demande_administrative', 'autre')),
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'nouvelle' CHECK (status IN ('nouvelle', 'en_cours', 'resolue', 'fermee')),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  status_changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lease_requests_lease_id_idx ON public.lease_requests(lease_id);
CREATE INDEX lease_requests_status_idx ON public.lease_requests(status);

CREATE TABLE public.lease_request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.lease_requests(id),
  sender_id uuid NOT NULL REFERENCES public.profiles(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lease_request_messages_request_id_idx ON public.lease_request_messages(request_id);

CREATE TABLE public.lease_request_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.lease_requests(id),
  message_id uuid REFERENCES public.lease_request_messages(id),
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lease_request_attachments_request_id_idx ON public.lease_request_attachments(request_id);

-- ============================================================================
-- A.3 — Triggers : dérivation serveur + machine à états
-- ============================================================================
-- Dérive created_by à la création, verrouille tout le contenu (sujet,
-- description, type...) sur mise à jour, et impose qui a le droit de passer
-- à quel statut. La légalité fine des transitions vit ici, pas dans la RLS.
CREATE OR REPLACE FUNCTION public.lease_requests_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_landlord_id uuid;
  v_tenant_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.status := 'nouvelle';
    NEW.status_changed_at := now();
    RETURN NEW;
  END IF;

  SELECT landlord_id, tenant_id INTO v_landlord_id, v_tenant_id
    FROM public.leases WHERE id = OLD.lease_id;

  NEW.lease_id := OLD.lease_id;
  NEW.type := OLD.type;
  NEW.subject := OLD.subject;
  NEW.description := OLD.description;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;

  IF NEW.status = OLD.status THEN
    NEW.status_changed_at := OLD.status_changed_at;
    RETURN NEW;
  END IF;

  IF auth.uid() = v_landlord_id THEN
    IF NOT (OLD.status IN ('nouvelle', 'en_cours') AND NEW.status IN ('en_cours', 'resolue', 'fermee')) THEN
      RAISE EXCEPTION 'transition de statut invalide pour le bailleur';
    END IF;
  ELSIF auth.uid() = v_tenant_id THEN
    IF NOT (OLD.status = 'resolue' AND NEW.status = 'nouvelle') THEN
      RAISE EXCEPTION 'transition de statut invalide pour le locataire';
    END IF;
  ELSE
    RAISE EXCEPTION 'non autorisé';
  END IF;

  NEW.status_changed_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER lease_requests_guard_trigger
  BEFORE INSERT OR UPDATE ON public.lease_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.lease_requests_guard();

CREATE OR REPLACE FUNCTION public.lease_request_messages_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.sender_id := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER lease_request_messages_before_insert_trigger
  BEFORE INSERT ON public.lease_request_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.lease_request_messages_before_insert();

-- Dérive uploaded_by, et request_id depuis le message si message_id est
-- fourni (jamais fié à la valeur envoyée par le client).
CREATE OR REPLACE FUNCTION public.lease_request_attachments_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_request_id uuid;
BEGIN
  NEW.uploaded_by := auth.uid();
  IF NEW.message_id IS NOT NULL THEN
    SELECT request_id INTO v_request_id FROM public.lease_request_messages WHERE id = NEW.message_id;
    IF v_request_id IS NULL THEN
      RAISE EXCEPTION 'message introuvable';
    END IF;
    NEW.request_id := v_request_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER lease_request_attachments_before_insert_trigger
  BEFORE INSERT ON public.lease_request_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.lease_request_attachments_before_insert();

-- ============================================================================
-- A.4 — RLS
-- ============================================================================
ALTER TABLE public.lease_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_request_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_request_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lease_requests_select_parties" ON public.lease_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = lease_requests.lease_id
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  );

CREATE POLICY "lease_requests_select_admin" ON public.lease_requests
  FOR SELECT USING (public.is_admin());

CREATE POLICY "lease_requests_insert_tenant" ON public.lease_requests
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = lease_requests.lease_id
        AND leases.tenant_id = auth.uid()
        AND leases.status = 'actif'
    )
  );

-- La légalité fine de la transition est entièrement à la charge du trigger
-- A.3 ci-dessus : cette policy autorise seulement les parties du bail à
-- tenter une mise à jour.
CREATE POLICY "lease_requests_update_parties" ON public.lease_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = lease_requests.lease_id
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = lease_requests.lease_id
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  );

CREATE POLICY "lease_request_messages_select_parties" ON public.lease_request_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lease_requests
      JOIN public.leases ON leases.id = lease_requests.lease_id
      WHERE lease_requests.id = lease_request_messages.request_id
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  );

CREATE POLICY "lease_request_messages_select_admin" ON public.lease_request_messages
  FOR SELECT USING (public.is_admin());

CREATE POLICY "lease_request_messages_insert_parties" ON public.lease_request_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.lease_requests
      JOIN public.leases ON leases.id = lease_requests.lease_id
      WHERE lease_requests.id = lease_request_messages.request_id
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  );

CREATE POLICY "lease_request_attachments_select_parties" ON public.lease_request_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lease_requests
      JOIN public.leases ON leases.id = lease_requests.lease_id
      WHERE lease_requests.id = lease_request_attachments.request_id
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  );

CREATE POLICY "lease_request_attachments_select_admin" ON public.lease_request_attachments
  FOR SELECT USING (public.is_admin());

CREATE POLICY "lease_request_attachments_insert_parties" ON public.lease_request_attachments
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.lease_requests
      JOIN public.leases ON leases.id = lease_requests.lease_id
      WHERE lease_requests.id = lease_request_attachments.request_id
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  );

-- Pas de policy UPDATE/DELETE sur lease_request_messages ni
-- lease_request_attachments : immuables une fois créés, comme lease_payments.

-- ============================================================================
-- A.5 — Storage RLS lease-requests
-- ============================================================================
-- Chemin de stockage : ${leaseId}/${requestId}/... — storage.foldername(name)
-- (fonction Supabase) donne le premier segment, comparé à leases.id. Contexte
-- important : contrairement à identity-documents (préfixe = propre userId de
-- l'uploadeur), ici DEUX utilisateurs (bailleur et locataire) doivent lire
-- les mêmes fichiers, d'où une jointure sur leases plutôt qu'une comparaison
-- directe à auth.uid().
CREATE POLICY "lease_requests_bucket_select_parties" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'lease-requests'
    AND EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id::text = (storage.foldername(name))[1]
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  );

CREATE POLICY "lease_requests_bucket_select_admin" ON storage.objects
  FOR SELECT USING (bucket_id = 'lease-requests' AND public.is_admin());

CREATE POLICY "lease_requests_bucket_insert_parties" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'lease-requests'
    AND EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id::text = (storage.foldername(name))[1]
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  );

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP POLICY IF EXISTS "lease_requests_bucket_insert_parties" ON storage.objects;
-- DROP POLICY IF EXISTS "lease_requests_bucket_select_admin" ON storage.objects;
-- DROP POLICY IF EXISTS "lease_requests_bucket_select_parties" ON storage.objects;
-- DROP TABLE IF EXISTS public.lease_request_attachments;
-- DROP TABLE IF EXISTS public.lease_request_messages;
-- DROP TABLE IF EXISTS public.lease_requests;
-- DROP FUNCTION IF EXISTS public.lease_request_attachments_before_insert();
-- DROP FUNCTION IF EXISTS public.lease_request_messages_before_insert();
-- DROP FUNCTION IF EXISTS public.lease_requests_guard();
-- DELETE FROM storage.buckets WHERE id = 'lease-requests';
