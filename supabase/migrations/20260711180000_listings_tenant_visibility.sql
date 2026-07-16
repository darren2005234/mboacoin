-- Correctif — 404 sur la fiche d'un logement loué, pour son locataire
-- Additif uniquement : élargit l'accès à des lignes précises pour des
-- utilisateurs précis, ne retire ni ne restreint jamais rien.

-- ============================================================================
-- A.1 — PRÉ-VOL (à exécuter séparément AVANT le reste, en lecture seule)
-- ============================================================================
-- Confirme la policy actuelle sur listings (celle qui cause la 404 pour un
-- locataire non-propriétaire dès que l'annonce n'est plus "publiee"), retrouve
-- le nom exact des policies "visible par participants conversation" / "visible
-- si en favori", et vérifie si l'admin a déjà un accès dédié (auquel cas le
-- bloc A.3 plus bas est inutile).
--
SELECT polname, polcmd, permissive,
    pg_get_expr(polqual, polrelid) AS using_expr,
    pg_get_expr(polwithcheck, polrelid) AS check_expr
    FROM pg_policy
    WHERE polrelid = 'public.listings'::regclass
    ORDER BY polcmd, polname;

-- ============================================================================
-- A.2 — Le locataire (bail en attente ou actif) voit son logement
-- ============================================================================
-- Inclut volontairement "en_attente_confirmation" en plus d'"actif" : le lien
-- "Voir la fiche" existe aussi sur la page de confirmation (Bail-2) pour un
-- bail pas encore confirmé, où l'annonce est déjà "louee" — le même bug s'y
-- produirait sinon.
CREATE POLICY "listings_select_tenant_lease" ON public.listings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.listing_id = listings.id
        AND leases.tenant_id = auth.uid()
        AND leases.status IN ('en_attente_confirmation', 'actif')
    )
  );

-- ============================================================================
-- A.3 — Admin (conditionnel : n'exécuter que si le pré-vol A.1 ne montre
-- aucune policy is_admin() déjà présente sur listings)
-- ============================================================================
-- CREATE POLICY "listings_select_admin" ON public.listings
--   FOR SELECT USING (public.is_admin());

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP POLICY IF EXISTS "listings_select_admin" ON public.listings;
-- DROP POLICY IF EXISTS "listings_select_tenant_lease" ON public.listings;
