-- Sous-chantier BAIL-5 (partie 2) — Propositions de modification d'un bail actif
-- Additif uniquement : aucune table existante n'est modifiée.
-- Voir le plan complet dans .claude/plans (ou l'historique de conversation) pour le contexte.

-- ============================================================================
-- B.1 — Table lease_amendments
-- ============================================================================
-- Table dédiée plutôt que des colonnes proposed_* sur leases : plusieurs
-- champs peuvent changer à la fois (une ligne = un ensemble cohérent de
-- valeurs proposées, NULL = inchangé sur ce champ), et ça garde un historique
-- des propositions refusées/annulées (même principe "ne rien supprimer" que
-- pour les paiements/messages).
CREATE TABLE public.lease_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id),
  proposed_by uuid NOT NULL REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'acceptee', 'refusee', 'annulee')),
  reason text,
  new_rent_amount numeric,
  new_deposit_amount numeric,
  new_advance_amount numeric,
  new_payment_day integer CHECK (new_payment_day IS NULL OR new_payment_day BETWEEN 1 AND 31),
  new_payment_period text CHECK (new_payment_period IS NULL OR new_payment_period IN ('mensuel', 'journalier')),
  new_duration_months integer CHECK (new_duration_months IS NULL OR new_duration_months > 0),
  new_end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

CREATE INDEX lease_amendments_lease_id_idx ON public.lease_amendments(lease_id);

-- Une seule proposition en attente à la fois par bail (même pattern que
-- l'index partiel "un seul bail en cours par logement", Bail-1).
CREATE UNIQUE INDEX lease_amendments_one_pending_per_lease
  ON public.lease_amendments(lease_id) WHERE status = 'en_attente';

-- ============================================================================
-- B.2 — Trigger : dérive l'auteur, verrouille le contenu proposé, applique
-- le changement à leases UNIQUEMENT si le locataire accepte.
-- ============================================================================
-- SECURITY DEFINER nécessaire : le locataire n'a par ailleurs aucun droit
-- d'écriture sur les colonnes de conditions de leases (RLS "leases_landlord_manage"
-- est réservée au bailleur) ; c'est cette fonction, avec ses propres gardes
-- ci-dessous, qui autorise l'unique écriture croisée du côté locataire.
CREATE OR REPLACE FUNCTION public.lease_amendments_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_landlord_id uuid;
  v_tenant_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.proposed_by := auth.uid();
    NEW.status := 'en_attente';
    NEW.responded_at := NULL;
    RETURN NEW;
  END IF;

  SELECT landlord_id, tenant_id INTO v_landlord_id, v_tenant_id
    FROM public.leases WHERE id = OLD.lease_id;

  -- Verrouille toujours le contenu proposé et l'auteur : ni le bailleur ni
  -- le locataire ne peuvent modifier ce qui a été proposé après coup.
  NEW.lease_id := OLD.lease_id;
  NEW.proposed_by := OLD.proposed_by;
  NEW.reason := OLD.reason;
  NEW.new_rent_amount := OLD.new_rent_amount;
  NEW.new_deposit_amount := OLD.new_deposit_amount;
  NEW.new_advance_amount := OLD.new_advance_amount;
  NEW.new_payment_day := OLD.new_payment_day;
  NEW.new_payment_period := OLD.new_payment_period;
  NEW.new_duration_months := OLD.new_duration_months;
  NEW.new_end_date := OLD.new_end_date;
  NEW.created_at := OLD.created_at;

  IF OLD.status <> 'en_attente' THEN
    RAISE EXCEPTION 'cette proposition a déjà été traitée';
  END IF;

  IF auth.uid() = v_tenant_id THEN
    IF NEW.status NOT IN ('acceptee', 'refusee') THEN
      RAISE EXCEPTION 'réponse invalide';
    END IF;
    NEW.responded_at := now();

    IF NEW.status = 'acceptee' THEN
      UPDATE public.leases SET
        rent_amount = COALESCE(OLD.new_rent_amount, rent_amount),
        deposit_amount = COALESCE(OLD.new_deposit_amount, deposit_amount),
        advance_amount = COALESCE(OLD.new_advance_amount, advance_amount),
        payment_day = COALESCE(OLD.new_payment_day, payment_day),
        payment_period = COALESCE(OLD.new_payment_period, payment_period),
        duration_months = COALESCE(OLD.new_duration_months, duration_months),
        end_date = COALESCE(OLD.new_end_date, end_date)
      WHERE id = OLD.lease_id;
    END IF;
  ELSIF auth.uid() = v_landlord_id THEN
    IF NEW.status <> 'annulee' THEN
      RAISE EXCEPTION 'action invalide';
    END IF;
    NEW.responded_at := now();
  ELSE
    RAISE EXCEPTION 'non autorisé';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER lease_amendments_guard_trigger
  BEFORE INSERT OR UPDATE ON public.lease_amendments
  FOR EACH ROW
  EXECUTE FUNCTION public.lease_amendments_guard();

-- ============================================================================
-- B.3 — RLS
-- ============================================================================
ALTER TABLE public.lease_amendments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lease_amendments_select_parties" ON public.lease_amendments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = lease_amendments.lease_id
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  );

CREATE POLICY "lease_amendments_select_admin" ON public.lease_amendments
  FOR SELECT USING (public.is_admin());

CREATE POLICY "lease_amendments_insert_landlord" ON public.lease_amendments
  FOR INSERT WITH CHECK (
    proposed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = lease_amendments.lease_id
        AND leases.landlord_id = auth.uid()
        AND leases.status = 'actif'
    )
  );

CREATE POLICY "lease_amendments_update_parties" ON public.lease_amendments
  FOR UPDATE USING (
    status = 'en_attente'
    AND EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = lease_amendments.lease_id
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = lease_amendments.lease_id
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  );

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP TABLE IF EXISTS public.lease_amendments;
-- DROP FUNCTION IF EXISTS public.lease_amendments_guard();
