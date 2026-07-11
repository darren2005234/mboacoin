-- Sous-chantier BAIL-2 — Confirmation du bail par le locataire + socle de l'espace locataire
-- Additif uniquement : aucun bail ni aucune annonce existante n'est cassé.
-- Voir le plan complet dans .claude/plans (ou l'historique de conversation) pour le contexte.

-- ============================================================================
-- A.1 — PRÉ-VOL (à exécuter séparément AVANT le reste, en lecture seule)
-- ============================================================================
-- Confirme si listings.SELECT est déjà public (USING true) ou restreint par
-- statut/propriétaire. Si restreint, le bloc C plus bas est nécessaire pour que
-- le locataire voie SON logement même en statut "louee". Si déjà public, le
-- bloc C reste inoffensif (il n'élargit rien qui ne le soit déjà).
--
-- SELECT polname, polcmd, pg_get_expr(polqual, polrelid), pg_get_expr(polwithcheck, polrelid)
-- FROM pg_policy WHERE polrelid = 'public.listings'::regclass;

-- ============================================================================
-- A.2 — Trigger de confirmation/refus par le locataire
-- ============================================================================
-- Même logique de défense en profondeur que leases_before_insert (Bail-1) :
-- les colonnes autres que status/confirmed_at/ended_at sont verrouillées à
-- leur valeur d'origine, jamais fiées au payload client.
CREATE OR REPLACE FUNCTION public.leases_before_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.tenant_id THEN
    -- Action du locataire (confirmer/refuser). Toute autre voie de mise à jour
    -- (bailleur, admin) sera traitée par un futur chantier et n'entre pas ici.
    IF OLD.status <> 'en_attente_confirmation' THEN
      RAISE EXCEPTION 'ce bail ne peut plus être confirmé ou refusé';
    END IF;
    IF NEW.status NOT IN ('actif', 'rejete') THEN
      RAISE EXCEPTION 'transition de statut invalide';
    END IF;

    -- Verrouille toutes les colonnes sauf status/confirmed_at/ended_at : un
    -- payload client ne peut pas profiter de cette action pour modifier le
    -- loyer, les dates, etc.
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
    NEW.end_reason := OLD.end_reason;
    NEW.created_at := OLD.created_at;
    NEW.confirmed_at := CASE WHEN NEW.status = 'actif' THEN now() ELSE OLD.confirmed_at END;
    NEW.ended_at := CASE WHEN NEW.status = 'rejete' THEN now() ELSE OLD.ended_at END;

    IF NEW.status = 'rejete' THEN
      -- La location n'a pas eu lieu : l'annonce redevient disponible à la
      -- recherche (même geste que "Remettre en ligne" dans lib/my-listings.ts).
      -- SECURITY DEFINER est nécessaire ici (contrairement à Bail-1) : le
      -- locataire n'est pas propriétaire du logement, donc sans DEFINER cette
      -- UPDATE serait filtrée par la RLS de listings et échouerait silencieusement.
      UPDATE public.listings SET status = 'publiee' WHERE id = NEW.listing_id AND status = 'louee';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER leases_before_update_trigger
  BEFORE UPDATE ON public.leases
  FOR EACH ROW
  EXECUTE FUNCTION public.leases_before_update();

-- ============================================================================
-- A.3 — RLS : le locataire peut confirmer/refuser
-- ============================================================================
-- Double garde avec le trigger ci-dessus : cette policy filtre déjà quelle
-- ligne est modifiable et vers quel statut ; le trigger verrouille en plus les
-- colonnes annexes. Ni l'un ni l'autre seul ne suffirait (la policy seule
-- n'empêche pas de modifier rent_amount en même temps que status).
CREATE POLICY "leases_tenant_confirm_or_reject" ON public.leases
  FOR UPDATE
  USING (tenant_id = auth.uid() AND status = 'en_attente_confirmation')
  WITH CHECK (tenant_id = auth.uid() AND status IN ('actif', 'rejete'));

-- ============================================================================
-- A.4 — Additif conditionnel : lecture du logement par son locataire
-- ============================================================================
-- À exécuter seulement si le pré-vol (A.1) montre que listings n'est pas déjà
-- lisible publiquement quel que soit le statut. Additive uniquement (élargit,
-- ne restreint jamais) : garantit que le locataire voit la fiche de son propre
-- logement même si son statut ("louee") le sortirait autrement d'une policy
-- publique restreinte à "publiee".
--
-- CREATE POLICY "listings_select_tenant_with_lease" ON public.listings
--   FOR SELECT USING (
--     EXISTS (SELECT 1 FROM public.leases WHERE leases.listing_id = listings.id AND leases.tenant_id = auth.uid())
--   );

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP POLICY IF EXISTS "listings_select_tenant_with_lease" ON public.listings;
-- DROP POLICY IF EXISTS "leases_tenant_confirm_or_reject" ON public.leases;
-- DROP TRIGGER IF EXISTS leases_before_update_trigger ON public.leases;
-- DROP FUNCTION IF EXISTS public.leases_before_update();
