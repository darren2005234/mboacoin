-- Sous-chantier BAIL-5 (partie 1) — Cycle de vie du bail : fin, annulation, correction
-- Additif/évolutif uniquement : aucune donnée existante n'est perdue.
-- Voir le plan complet dans .claude/plans (ou l'historique de conversation) pour le contexte.

-- ============================================================================
-- A.1 — PRÉ-VOL (à exécuter séparément AVANT le reste, en lecture seule)
-- ============================================================================
-- Confirme le nom réel de la contrainte CHECK sur leases.status avant de la
-- remplacer (A.2 ci-dessous suppose "leases_status_check", le nom que
-- Postgres génère par défaut pour une contrainte de colonne sans nom explicite
-- — adapter si le résultat diffère).
--
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.leases'::regclass AND contype = 'c' AND conname LIKE '%status%';

-- ============================================================================
-- A.2 — Nouveau statut "annule"
-- ============================================================================
-- Distinct de "rejete" (Bail-2, qui signifie "le locataire a dit non") :
-- réutiliser rejete pour "le bailleur annule un bail jamais confirmé"
-- mélangerait deux initiatives différentes sous un même mot. Effet identique
-- sur l'annonce (retour à publiee), sémantique différente.
ALTER TABLE public.leases DROP CONSTRAINT leases_status_check;
ALTER TABLE public.leases ADD CONSTRAINT leases_status_check
  CHECK (status IN ('en_attente_confirmation', 'actif', 'rejete', 'termine', 'resilie', 'arrete', 'annule'));

-- ============================================================================
-- A.3 — leases_before_update : ajoute les branches bailleur (absentes
-- jusqu'ici) et la résiliation locataire ; garde confirmer/refuser (Bail-2)
-- inchangés. Déjà SECURITY DEFINER depuis Bail-2 : on l'étend, on n'ajoute
-- pas de nouvelle surface de privilège.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.leases_before_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

    -- Verrouille tout le contenu : le locataire ne change jamais les
    -- conditions, seulement le statut (et end_reason s'il résilie).
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
    -- Bailleur : corriger/annuler un bail en attente, ou terminer un bail
    -- actif. Ne touche JAMAIS aux conditions d'un bail actif directement —
    -- ça passe par lease_amendments (proposition + accord du locataire,
    -- voir 20260712150000_lease_amendments.sql).
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
      -- Simple correction avant confirmation : le bail n'est pas encore un
      -- engagement, tout le contenu reste éditable sauf l'identité du
      -- logement/bailleur. Si le numéro change, le rattachement précédent
      -- (Bail-1) devient invalide : il faut que le bon locataire se
      -- reconnecte pour se rattacher à nouveau.
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
-- A.4 — RLS : deux policies supplémentaires côté bailleur/locataire
-- ============================================================================
CREATE POLICY "leases_tenant_end_active" ON public.leases
  FOR UPDATE
  USING (tenant_id = auth.uid() AND status = 'actif')
  WITH CHECK (tenant_id = auth.uid() AND status = 'resilie');

-- Garde large côté RLS (le bailleur peut tenter une mise à jour tant que le
-- bail est en_attente_confirmation ou actif) ; la légalité fine de chaque
-- transition est entièrement à la charge du trigger A.3 — même répartition
-- RLS/trigger que pour lease_requests (Bail-4).
CREATE POLICY "leases_landlord_manage" ON public.leases
  FOR UPDATE
  USING (landlord_id = auth.uid() AND status IN ('en_attente_confirmation', 'actif'))
  WITH CHECK (landlord_id = auth.uid());

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP POLICY IF EXISTS "leases_landlord_manage" ON public.leases;
-- DROP POLICY IF EXISTS "leases_tenant_end_active" ON public.leases;
-- (leases_before_update reviendrait à la version Bail-2 ; leases_status_check
-- reviendrait à son ensemble de valeurs sans "annule")
