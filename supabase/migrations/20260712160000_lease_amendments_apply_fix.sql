-- Correctif — l'acceptation d'une proposition de modification (Bail-5) échoue
-- Deux blocages en cascade sur l'UPDATE interne que lease_amendments_guard()
-- fait sur leases lors d'une acceptation :
--   1) leases_before_update_trigger (qui se redéclenche sur cette écriture
--      interne) exige NEW.status = 'resilie' dès que OLD.status = 'actif'
--      côté locataire — or cette écriture ne touche jamais status.
--   2) Aucune policy RLS sur leases n'autorise le locataire à écrire quand
--      le statut reste actif.
-- Les deux sont résolus par un drapeau de transaction (set_config, local à
-- la transaction, jamais accessible depuis l'API cliente) posé uniquement
-- par lease_amendments_guard() juste avant son UPDATE interne : il fait
-- sauter la validation du trigger ET sert de condition à la policy RLS —
-- aucune ouverture au-delà de ce chemin précis.

-- ============================================================================
-- C.1 — leases_before_update : court-circuite la validation normale quand
-- l'appel provient de lease_amendments_guard() (proposition déjà validée
-- par ses propres gardes : bail actif, proposition en_attente, réponse du
-- bon locataire).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.leases_before_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(current_setting('app.bypass_leases_guard', true), 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.tenant_id THEN
    -- Locataire : confirmer/refuser (Bail-2) ou résilier un bail actif.
    IF OLD.status = 'en_attente_confirmation' THEN
      IF NEW.status NOT IN ('actif', 'rejete') THEN
        RAISE EXCEPTION 'transition de statut invalide pour le locataire';
      END IF;
    ELSIF OLD.status = 'actif' THEN
      IF NEW.status <> 'resilie' THEN
        RAISE EXCEPTION 'transition de statut invalide pour le locataire';
      END IF;
    ELSE
      RAISE EXCEPTION 'ce bail ne peut plus être modifié par le locataire';
    END IF;

    NEW.listing_id := OLD.listing_id;
    NEW.landlord_id := OLD.landlord_id;
    NEW.residence_id := OLD.residence_id;
    NEW.tenant_phone := OLD.tenant_phone;
    NEW.tenant_id := OLD.tenant_id;
    NEW.start_date := OLD.start_date;
    NEW.duration_months := OLD.duration_months;
    NEW.end_date := OLD.end_date;
    NEW.rent_amount := OLD.rent_amount;
    NEW.deposit_amount := OLD.deposit_amount;
    NEW.advance_amount := OLD.advance_amount;
    NEW.payment_day := OLD.payment_day;
    NEW.payment_period := OLD.payment_period;
    NEW.created_at := OLD.created_at;
    IF NEW.status <> 'resilie' THEN
      NEW.end_reason := OLD.end_reason;
    END IF;

    NEW.confirmed_at := CASE WHEN NEW.status = 'actif' THEN now() ELSE OLD.confirmed_at END;
    NEW.ended_at := CASE WHEN NEW.status IN ('rejete', 'resilie') THEN now() ELSE OLD.ended_at END;

    IF NEW.status = 'rejete' THEN
      UPDATE public.listings SET status = 'publiee' WHERE id = NEW.listing_id AND status = 'louee';
    ELSIF NEW.status = 'resilie' THEN
      UPDATE public.listings SET status = 'brouillon' WHERE id = NEW.listing_id AND status = 'louee';
    END IF;

  ELSIF auth.uid() = OLD.landlord_id THEN
    IF OLD.status = 'en_attente_confirmation' AND NEW.status = 'annule' THEN
      NEW.listing_id := OLD.listing_id;
      NEW.landlord_id := OLD.landlord_id;
      NEW.residence_id := OLD.residence_id;
      NEW.tenant_phone := OLD.tenant_phone;
      NEW.tenant_id := OLD.tenant_id;
      NEW.start_date := OLD.start_date;
      NEW.duration_months := OLD.duration_months;
      NEW.end_date := OLD.end_date;
      NEW.rent_amount := OLD.rent_amount;
      NEW.deposit_amount := OLD.deposit_amount;
      NEW.advance_amount := OLD.advance_amount;
      NEW.payment_day := OLD.payment_day;
      NEW.payment_period := OLD.payment_period;
      NEW.created_at := OLD.created_at;
      NEW.confirmed_at := OLD.confirmed_at;
      NEW.ended_at := now();
      UPDATE public.listings SET status = 'publiee' WHERE id = NEW.listing_id AND status = 'louee';

    ELSIF OLD.status = 'en_attente_confirmation' AND NEW.status = 'en_attente_confirmation' THEN
      NEW.listing_id := OLD.listing_id;
      NEW.landlord_id := OLD.landlord_id;
      NEW.residence_id := OLD.residence_id;
      NEW.created_at := OLD.created_at;
      NEW.confirmed_at := OLD.confirmed_at;
      NEW.ended_at := OLD.ended_at;
      NEW.end_reason := OLD.end_reason;
      IF NEW.tenant_phone IS DISTINCT FROM OLD.tenant_phone THEN
        NEW.tenant_id := NULL;
      ELSE
        NEW.tenant_id := OLD.tenant_id;
      END IF;

    ELSIF OLD.status = 'actif' AND NEW.status IN ('termine', 'arrete') THEN
      NEW.listing_id := OLD.listing_id;
      NEW.landlord_id := OLD.landlord_id;
      NEW.residence_id := OLD.residence_id;
      NEW.tenant_phone := OLD.tenant_phone;
      NEW.tenant_id := OLD.tenant_id;
      NEW.start_date := OLD.start_date;
      NEW.duration_months := OLD.duration_months;
      NEW.end_date := OLD.end_date;
      NEW.rent_amount := OLD.rent_amount;
      NEW.deposit_amount := OLD.deposit_amount;
      NEW.advance_amount := OLD.advance_amount;
      NEW.payment_day := OLD.payment_day;
      NEW.payment_period := OLD.payment_period;
      NEW.created_at := OLD.created_at;
      NEW.confirmed_at := OLD.confirmed_at;
      NEW.ended_at := now();
      UPDATE public.listings SET status = 'brouillon' WHERE id = NEW.listing_id AND status = 'louee';

    ELSE
      RAISE EXCEPTION 'transition de statut invalide pour le bailleur';
    END IF;

  ELSE
    RAISE EXCEPTION 'non autorisé';
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- C.2 — lease_amendments_guard : pose le drapeau juste avant l'UPDATE
-- interne sur leases, le retire juste après (hygiène — il est de toute
-- façon local à la transaction et retombe seul à la fin de celle-ci).
-- ============================================================================
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
      PERFORM set_config('app.bypass_leases_guard', 'true', true);
      UPDATE public.leases SET
        rent_amount = COALESCE(OLD.new_rent_amount, rent_amount),
        deposit_amount = COALESCE(OLD.new_deposit_amount, deposit_amount),
        advance_amount = COALESCE(OLD.new_advance_amount, advance_amount),
        payment_day = COALESCE(OLD.new_payment_day, payment_day),
        payment_period = COALESCE(OLD.new_payment_period, payment_period),
        duration_months = COALESCE(OLD.new_duration_months, duration_months),
        end_date = COALESCE(OLD.new_end_date, end_date)
      WHERE id = OLD.lease_id;
      PERFORM set_config('app.bypass_leases_guard', 'false', true);
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

-- ============================================================================
-- C.3 — RLS : policy étroitement scopée au même drapeau — elle ne s'active
-- donc jamais en dehors de ce chemin précis (le client n'a aucun moyen
-- d'appeler set_config via l'API PostgREST).
-- ============================================================================
CREATE POLICY "leases_tenant_apply_amendment" ON public.leases
  FOR UPDATE
  USING (
    tenant_id = auth.uid()
    AND coalesce(current_setting('app.bypass_leases_guard', true), 'false') = 'true'
  )
  WITH CHECK (
    tenant_id = auth.uid()
    AND coalesce(current_setting('app.bypass_leases_guard', true), 'false') = 'true'
  );

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP POLICY IF EXISTS "leases_tenant_apply_amendment" ON public.leases;
-- (leases_before_update et lease_amendments_guard reviendraient à leur
-- version précédente — voir 20260712140000/20260712150000)
