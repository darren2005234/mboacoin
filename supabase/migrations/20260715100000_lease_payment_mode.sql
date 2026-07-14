-- Chantier PAIEMENT-AVANCE — mode de paiement d'avance + versements groupés
--
-- Deux besoins distincts, un seul mécanisme bas niveau :
--   1) payment_mode = 'avance' : le loyer est payé d'avance pour N mois ; la
--      période couverte définit la durée du bail (end_date = fin de
--      couverture), pas de retard, pas d'échéance mensuelle.
--   2) Même en mode mensuel classique, un versement ponctuel peut couvrir
--      plusieurs mois d'un coup (point 7) : le bail reste mensuel, avec ses
--      échéances et ses retards normaux pour les mois non couverts.
-- Les deux passent par declare_payment_batch() : une ligne par mois dans
-- lease_payments (jamais une plage de dates), reliées par payment_batch_id.
--
-- Règle héritée du correctif période (20260712190000) et non négociable ici :
-- l'identité d'une période est un MOIS, jamais dérivée de payment_day. Tout
-- calcul de mois ci-dessous utilise une arithmétique entière sur des dates
-- déjà tronquées au premier du mois, jamais Date/toISOString côté client.

-- ============================================================================
-- A — leases.payment_mode
-- ============================================================================
ALTER TABLE public.leases
  ADD COLUMN payment_mode text NOT NULL DEFAULT 'mensuel'
  CHECK (payment_mode IN ('mensuel', 'avance'));

-- L'avance n'a de sens que pour un loyer mensuel (généré par mois) ; un bail
-- journalier n'a pas de notion de "couverture en mois".
ALTER TABLE public.leases
  ADD CONSTRAINT leases_avance_requires_mensuel_period
  CHECK (payment_mode = 'mensuel' OR payment_period = 'mensuel');

-- Pas amendable : pas de new_payment_mode sur lease_amendments, choix figé à
-- la création (changer de mode en cours de bail poserait la question de
-- réconcilier l'historique de paiements/retards, hors sujet ici).

-- Policy scopée au même drapeau que leases_tenant_apply_amendment
-- (20260712160000) : le SECURITY DEFINER de declare_payment_batch ne suffit
-- pas à lui seul à passer la RLS sur leases dans cet environnement (c'est
-- précisément ce que ce correctif avait dû ajouter côté locataire) ; même
-- garde ici côté bailleur, inatteignable hors de ce chemin précis (le
-- client n'a aucun moyen d'appeler set_config via l'API PostgREST).
CREATE POLICY "leases_landlord_apply_payment_batch" ON public.leases
  FOR UPDATE
  USING (
    landlord_id = auth.uid()
    AND coalesce(current_setting('app.bypass_leases_guard', true), 'false') = 'true'
  )
  WITH CHECK (
    landlord_id = auth.uid()
    AND coalesce(current_setting('app.bypass_leases_guard', true), 'false') = 'true'
  );

-- ============================================================================
-- B — lease_payments.payment_batch_id
-- ============================================================================
-- Pas de table payment_batches séparée : un uuid partagé par les N lignes
-- suffit, c'est une étiquette de corrélation, pas une entité à part entière.
-- UNIQUE (lease_id, period) reste la seule garde qui protège tout : une
-- ligne par mois, jamais de plage de dates.
ALTER TABLE public.lease_payments ADD COLUMN payment_batch_id uuid;

CREATE INDEX lease_payments_payment_batch_id_idx
  ON public.lease_payments(payment_batch_id) WHERE payment_batch_id IS NOT NULL;

-- ============================================================================
-- C — leases_before_update() : payment_mode ajouté au verrou de chaque
-- branche (repris à l'identique de 20260712160000, sinon rien ne protège
-- payment_mode d'être changé silencieusement par un UPDATE de statut).
-- end_date reste verrouillé à OLD.* dans toutes les branches normales :
-- seul declare_payment_batch (via le drapeau app.bypass_leases_guard déjà
-- utilisé par lease_amendments_guard) pourra le faire évoluer.
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
    NEW.payment_mode := OLD.payment_mode;
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
      NEW.payment_mode := OLD.payment_mode;
      NEW.created_at := OLD.created_at;
      NEW.confirmed_at := OLD.confirmed_at;
      NEW.ended_at := now();
      UPDATE public.listings SET status = 'publiee' WHERE id = NEW.listing_id AND status = 'louee';

    ELSIF OLD.status = 'en_attente_confirmation' AND NEW.status = 'en_attente_confirmation' THEN
      NEW.listing_id := OLD.listing_id;
      NEW.landlord_id := OLD.landlord_id;
      NEW.residence_id := OLD.residence_id;
      NEW.payment_mode := OLD.payment_mode;
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
      NEW.payment_mode := OLD.payment_mode;
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
-- D — declare_payment_batch() : cœur du versement groupé, partagé par le
-- mode avance et par un versement ponctuel en mode mensuel (point 7). Seule
-- la mise à jour de end_date en fin de fonction diffère selon payment_mode.
-- SECURITY DEFINER : nécessaire pour l'UPDATE sur leases via le drapeau de
-- bypass (la RLS elle-même est déjà contournée par le fait de tourner en
-- tant que propriétaire de la fonction, comme lease_amendments_guard) ; les
-- vérifications d'autorisation sont donc entièrement à la charge du corps
-- de la fonction, pas de la RLS.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.declare_payment_batch(
  p_lease_id uuid,
  p_start_period date,
  p_months integer,
  p_paid_at date
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lease record;
  v_start date;
  v_periods date[];
  v_conflicts date[];
  v_batch_id uuid := gen_random_uuid();
  v_max_period date;
  v_coverage_end date;
BEGIN
  SELECT * INTO v_lease FROM public.leases
  WHERE id = p_lease_id AND landlord_id = auth.uid() AND status = 'actif';
  IF v_lease IS NULL THEN
    RAISE EXCEPTION 'bail introuvable ou non actif';
  END IF;

  IF v_lease.payment_period <> 'mensuel' THEN
    RAISE EXCEPTION 'versement groupé non applicable aux baux journaliers';
  END IF;
  IF p_months IS NULL OR p_months < 1 OR p_months > 36 THEN
    RAISE EXCEPTION 'nombre de mois invalide';
  END IF;
  IF p_paid_at IS NULL THEN
    RAISE EXCEPTION 'date de paiement requise';
  END IF;

  v_start := date_trunc('month', p_start_period)::date;
  IF v_start < date_trunc('month', v_lease.start_date)::date THEN
    RAISE EXCEPTION 'la période ne peut pas commencer avant le début du bail';
  END IF;

  SELECT array_agg((v_start + ((n || ' months')::interval))::date ORDER BY n)
    INTO v_periods FROM generate_series(0, p_months - 1) n;

  -- En mode mensuel à durée fixe, un versement ne peut pas dépasser la fin
  -- prévue du bail. En mode avance (ou mensuel à durée indéterminée), pas de
  -- plafond : c'est justement la couverture qui définit/prolonge la durée.
  IF v_lease.payment_mode = 'mensuel' AND v_lease.end_date IS NOT NULL
     AND v_periods[array_upper(v_periods, 1)] > date_trunc('month', v_lease.end_date)::date THEN
    RAISE EXCEPTION 'la période dépasse la fin prévue du bail';
  END IF;

  SELECT array_agg(period) INTO v_conflicts
  FROM public.lease_payments WHERE lease_id = p_lease_id AND period = ANY(v_periods);
  IF v_conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'des mois de cette période sont déjà payés : %', v_conflicts;
  END IF;

  INSERT INTO public.lease_payments (lease_id, period, paid_at, payment_batch_id)
  SELECT p_lease_id, p, p_paid_at, v_batch_id FROM unnest(v_periods) p;
  -- amount/declared_by/normalisation de period restent dérivés par
  -- lease_payments_before_insert (inchangé), appliqué ligne par ligne comme
  -- pour tout INSERT — rien à dupliquer ici.

  IF v_lease.payment_mode = 'avance' THEN
    SELECT max(period) INTO v_max_period FROM public.lease_payments WHERE lease_id = p_lease_id;
    v_coverage_end := (date_trunc('month', v_max_period) + interval '1 month' - interval '1 day')::date;
    PERFORM set_config('app.bypass_leases_guard', 'true', true);
    UPDATE public.leases SET end_date = v_coverage_end WHERE id = p_lease_id;
    PERFORM set_config('app.bypass_leases_guard', 'false', true);
  END IF;

  PERFORM public.notifications_create(v_lease.tenant_id, auth.uid(), 'lease_payment_declared',
    CASE WHEN v_lease.payment_mode = 'avance'
      THEN 'Votre bailleur a déclaré un versement — bail couvert jusqu''au ' || to_char(v_coverage_end, 'DD/MM/YYYY')
      ELSE 'Votre bailleur a déclaré un versement de ' || p_months || ' mois'
    END,
    NULL, '/my-lease/' || p_lease_id, p_lease_id, NULL, NULL, v_lease.listing_id);

  RETURN v_batch_id;
END;
$$;

-- ============================================================================
-- E — lease_payments_after_insert_notify : ignore les lignes issues d'un
-- batch (declare_payment_batch envoie déjà sa propre notification unique
-- ci-dessus). Le chemin declarePayment() (déclaration unitaire, UI
-- actuelle) est inchangé : payment_batch_id y reste NULL.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.lease_payments_after_insert_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant_id uuid; v_listing_id uuid;
BEGIN
  IF NEW.payment_batch_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT tenant_id, listing_id INTO v_tenant_id, v_listing_id FROM public.leases WHERE id = NEW.lease_id;

  PERFORM public.notifications_create(v_tenant_id, NEW.declared_by, 'lease_payment_declared',
    'Votre bailleur a déclaré un paiement', 'Quittance n° ' || NEW.receipt_number || ' disponible.',
    '/my-lease/' || NEW.lease_id, NEW.lease_id, NULL, NULL, v_listing_id);
  RETURN NEW;
END; $$;

-- ============================================================================
-- F — get_public_receipt : mention du versement groupé (nombre de mois du
-- même batch), sans jamais exposer payment_batch_id lui-même (un uuid
-- partagé entre lignes n'a pas à fuiter, seul le compte est utile côté
-- affichage).
-- ============================================================================
-- CREATE OR REPLACE ne peut pas changer la liste de colonnes de retour d'une
-- fonction RETURNS TABLE (elle est implémentée via des paramètres OUT) :
-- il faut la supprimer explicitement avant de la recréer avec la colonne
-- batch_month_count en plus.
DROP FUNCTION IF EXISTS public.get_public_receipt(uuid);

CREATE FUNCTION public.get_public_receipt(p_token uuid)
RETURNS TABLE(
  receipt_number text,
  period date,
  amount numeric,
  paid_at date,
  method text,
  issued_at timestamptz,
  tenant_name text,
  landlord_name text,
  batch_month_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lp.receipt_number, lp.period, lp.amount, lp.paid_at, lp.method, lp.created_at,
         tenant.full_name, landlord.full_name,
         CASE WHEN lp.payment_batch_id IS NULL THEN NULL
              ELSE (SELECT count(*)::integer FROM public.lease_payments WHERE payment_batch_id = lp.payment_batch_id)
         END
  FROM public.lease_payments lp
  JOIN public.leases l ON l.id = lp.lease_id
  JOIN public.profiles tenant ON tenant.id = l.tenant_id
  JOIN public.profiles landlord ON landlord.id = l.landlord_id
  WHERE lp.verification_token = p_token;
$$;

-- Le DROP ci-dessus efface aussi les privilèges de l'ancienne fonction :
-- on les redonne à l'identique (20260714100000).
REVOKE ALL ON FUNCTION public.get_public_receipt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_receipt(uuid) TO anon, authenticated;

-- ============================================================================
-- G — lease_payment_reminders : colonne de déduplication du rappel de fin
-- de couverture (mode avance). Même mécanique que due_soon_sent_at, mais la
-- ligne est indexée avec period = date de fin de couverture (et non un mois
-- dû) — ce n'est significatif que pour les baux avance, à ne pas confondre
-- avec l'usage "mois dû" fait pour les baux mensuels par le reste de cette
-- table.
-- ============================================================================
ALTER TABLE public.lease_payment_reminders
  ADD COLUMN coverage_ending_sent_at timestamptz;

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- ALTER TABLE public.lease_payment_reminders DROP COLUMN IF EXISTS coverage_ending_sent_at;
-- DROP POLICY IF EXISTS "leases_landlord_apply_payment_batch" ON public.leases;
-- (get_public_receipt, lease_payments_after_insert_notify, leases_before_update
-- reviendraient à leur version précédente — voir 20260714100000/20260712180000/20260712160000)
-- DROP FUNCTION IF EXISTS public.declare_payment_batch(uuid, date, integer, date);
-- DROP INDEX IF EXISTS public.lease_payments_payment_batch_id_idx;
-- ALTER TABLE public.lease_payments DROP COLUMN IF EXISTS payment_batch_id;
-- ALTER TABLE public.leases DROP CONSTRAINT IF EXISTS leases_avance_requires_mensuel_period;
-- ALTER TABLE public.leases DROP COLUMN IF EXISTS payment_mode;
