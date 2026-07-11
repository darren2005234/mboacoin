-- Sous-chantier BAIL-4 (partie B) — Contrat de bail
-- Additif uniquement : aucune table/bucket existant n'est modifié.
-- Voir le plan complet dans .claude/plans (ou l'historique de conversation) pour le contexte.

-- ============================================================================
-- B.1 — Bucket privé lease-contracts
-- ============================================================================
-- Équivalent dashboard : Storage → New bucket → "lease-contracts" → Private.
INSERT INTO storage.buckets (id, name, public)
VALUES ('lease-contracts', 'lease-contracts', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- B.2 — Table lease_documents
-- ============================================================================
-- Table dédiée plutôt qu'une colonne contract_path sur leases : permet
-- d'accueillir plus tard des avenants (révision de loyer, prolongation...)
-- sans changement de schéma, et garde un historique immuable (qui a uploadé
-- quoi, quand) au lieu d'écraser un unique chemin. L'UI de ce chantier reste
-- simple (un seul document affiché, le plus récent de type 'contrat').
CREATE TABLE public.lease_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id),
  document_type text NOT NULL DEFAULT 'contrat' CHECK (document_type IN ('contrat', 'avenant', 'autre')),
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lease_documents_lease_id_idx ON public.lease_documents(lease_id);

CREATE OR REPLACE FUNCTION public.lease_documents_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.uploaded_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER lease_documents_before_insert_trigger
  BEFORE INSERT ON public.lease_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.lease_documents_before_insert();

-- ============================================================================
-- B.3 — RLS
-- ============================================================================
ALTER TABLE public.lease_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lease_documents_select_parties" ON public.lease_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = lease_documents.lease_id
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  );

CREATE POLICY "lease_documents_select_admin" ON public.lease_documents
  FOR SELECT USING (public.is_admin());

CREATE POLICY "lease_documents_insert_landlord" ON public.lease_documents
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = lease_documents.lease_id
        AND leases.landlord_id = auth.uid()
    )
  );

-- Pas d'UPDATE/DELETE : un nouvel upload crée une nouvelle ligne (historique
-- immuable), cohérent avec lease_payments.

-- ============================================================================
-- B.4 — Storage RLS lease-contracts
-- ============================================================================
-- Même convention de chemin que lease-requests : ${leaseId}/... — voir le
-- commentaire équivalent dans 20260712120000_lease_requests.sql.
CREATE POLICY "lease_contracts_bucket_select_parties" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'lease-contracts'
    AND EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id::text = (storage.foldername(name))[1]
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  );

CREATE POLICY "lease_contracts_bucket_select_admin" ON storage.objects
  FOR SELECT USING (bucket_id = 'lease-contracts' AND public.is_admin());

CREATE POLICY "lease_contracts_bucket_insert_landlord" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'lease-contracts'
    AND EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id::text = (storage.foldername(name))[1]
        AND leases.landlord_id = auth.uid()
    )
  );

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP POLICY IF EXISTS "lease_contracts_bucket_insert_landlord" ON storage.objects;
-- DROP POLICY IF EXISTS "lease_contracts_bucket_select_admin" ON storage.objects;
-- DROP POLICY IF EXISTS "lease_contracts_bucket_select_parties" ON storage.objects;
-- DROP TABLE IF EXISTS public.lease_documents;
-- DROP FUNCTION IF EXISTS public.lease_documents_before_insert();
-- DELETE FROM storage.buckets WHERE id = 'lease-contracts';
