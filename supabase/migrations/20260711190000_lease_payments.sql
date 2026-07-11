-- Sous-chantier BAIL-3 — Paiements de loyer et quittances
-- Additif uniquement : aucun bail, annonce ou paiement existant n'est cassé.
-- Voir le plan complet dans .claude/plans (ou l'historique de conversation) pour le contexte.

-- ============================================================================
-- A.1 — Table lease_payments
-- ============================================================================
CREATE SEQUENCE public.lease_payments_receipt_seq;

CREATE TABLE public.lease_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id),
  period date NOT NULL,
  amount numeric NOT NULL,
  paid_at date NOT NULL,
  declared_by uuid NOT NULL REFERENCES public.profiles(id),
  method text NOT NULL DEFAULT 'declare_bailleur'
    CHECK (method IN ('declare_bailleur', 'mobile_money')),
  receipt_number text NOT NULL UNIQUE DEFAULT (
    'MBC-' || to_char(now(), 'YYYY') || '-' ||
    lpad(nextval('public.lease_payments_receipt_seq')::text, 6, '0')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lease_id, period)
);

CREATE INDEX lease_payments_lease_id_idx ON public.lease_payments(lease_id);

-- ============================================================================
-- A.2 — Dérivation serveur de amount/declared_by
-- ============================================================================
-- Même logique de défense en profondeur que les triggers Bail-1/2 : amount et
-- declared_by ne sont jamais fiés au payload client.
CREATE OR REPLACE FUNCTION public.lease_payments_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_rent numeric;
BEGIN
  SELECT rent_amount INTO v_rent FROM public.leases WHERE id = NEW.lease_id;
  IF v_rent IS NULL THEN
    RAISE EXCEPTION 'bail introuvable';
  END IF;
  NEW.amount := v_rent;
  NEW.declared_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER lease_payments_before_insert_trigger
  BEFORE INSERT ON public.lease_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.lease_payments_before_insert();

-- ============================================================================
-- A.3 — RLS
-- ============================================================================
ALTER TABLE public.lease_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lease_payments_select_landlord" ON public.lease_payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.leases WHERE leases.id = lease_payments.lease_id AND leases.landlord_id = auth.uid())
  );

CREATE POLICY "lease_payments_select_tenant" ON public.lease_payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.leases WHERE leases.id = lease_payments.lease_id AND leases.tenant_id = auth.uid())
  );

CREATE POLICY "lease_payments_select_admin" ON public.lease_payments
  FOR SELECT USING (public.is_admin());

-- Seul le bailleur du bail peut déclarer un paiement, et seulement sur un bail
-- actif. declared_by = auth.uid() est vérifié ici en plus du trigger (double
-- garde, même pattern que Bail-2) : le trigger le force, la policy confirme
-- sur la ligne finale.
CREATE POLICY "lease_payments_insert_landlord" ON public.lease_payments
  FOR INSERT WITH CHECK (
    declared_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = lease_payments.lease_id
        AND leases.landlord_id = auth.uid()
        AND leases.status = 'actif'
    )
  );

-- Aucune policy UPDATE/DELETE : une ligne de paiement/quittance est immuable
-- une fois créée (cohérent avec sa nature de document légal). Prépare
-- l'arrivée de Campay : method/declared_by acceptent déjà 'mobile_money' ;
-- l'intégration future insérera via un chemin serveur dédié, sans changer ce
-- schéma.

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP TABLE IF EXISTS public.lease_payments;
-- DROP FUNCTION IF EXISTS public.lease_payments_before_insert();
-- DROP SEQUENCE IF EXISTS public.lease_payments_receipt_seq;
