-- Chantier — Carte et géolocalisation des annonces.
--
-- Contexte : au Cameroun l'adressage n'est pas normalisé, tout géocodage
-- automatique adresse->GPS échouerait pour la majorité des annonces. Le
-- bailleur place donc lui-même son marqueur, et choisit lui-même le niveau
-- de précision affiché publiquement (défaut prudent : approximatif).
--
-- Point le plus sensible : quand le bailleur choisit "approximatif", les
-- coordonnées précises restent stockées mais ne doivent JAMAIS transiter
-- vers un client non autorisé, même dans une réponse réseau que l'UI
-- n'affiche pas telle quelle. Comme pour profiles.suspended_at
-- (20260717130000_account_suspension.sql), la RLS est par ligne, pas par
-- colonne : latitude/longitude sont donc verrouillées en lecture directe
-- (REVOKE), lisibles uniquement via les fonctions SECURITY DEFINER
-- ci-dessous qui appliquent la règle de révélation.
--
-- ⚠️ Ne pas exécuter automatiquement : migration manuelle. listings n'est
-- PAS versionnée dans ce repo (schéma de base) — avant d'exécuter ce
-- fichier, vérifier qu'aucune policy RLS existante ne restreint les
-- colonnes modifiables par le propriétaire :
--   SELECT polname, qual, with_check FROM pg_policies WHERE tablename = 'listings';

-- ============================================================================
-- A — Colonnes (optionnelles : une annonce sans coordonnées reste valide et
-- publiable, n'apparaît simplement pas sur la carte).
-- ============================================================================
ALTER TABLE public.listings
  ADD COLUMN latitude double precision,
  ADD COLUMN longitude double precision,
  ADD COLUMN location_precision text NOT NULL DEFAULT 'approximatif'
    CHECK (location_precision IN ('approximatif', 'precis')),
  ADD CONSTRAINT listings_lat_lng_together CHECK ((latitude IS NULL) = (longitude IS NULL)),
  ADD CONSTRAINT listings_lat_range CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  ADD CONSTRAINT listings_lng_range CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180);

-- Verrouillées en lecture directe pour tout le monde, y compris le
-- propriétaire (lui aussi passe par get_listing_location ci-dessous).
-- N'affecte pas l'écriture : owner_id = auth.uid() reste couvert par la
-- policy RLS UPDATE/INSERT déjà existante sur listings.
REVOKE SELECT (latitude, longitude) ON public.listings FROM authenticated, anon;

-- ============================================================================
-- B — Fonction pivot : qui a droit au point exact ?
-- ============================================================================
-- Seuil de révélation : visits.status = 'effectuee' (visite déjà réalisée,
-- code validé sur place — le locataire connaît déjà le lieu, sert surtout à
-- ce qu'il retrouve l'exact en repensant à une visite passée) OU
-- visits.status = 'confirmee' avec un créneau dans MOINS DE 24H.
--
-- Ne pas révéler dès 'confirmee' sans condition de délai : une visite
-- confirmée reste annulable par le locataire jusqu'à 3h avant le créneau
-- (voir visits_guard, 20260713100000_visits.sql) — sans ce délai, un
-- locataire de mauvaise foi pourrait confirmer une visite, récupérer
-- l'adresse exacte instantanément, puis annuler sans jamais avoir eu
-- l'intention de s'y rendre (surtout si les frais de visite sont à 0). Ne
-- révéler qu'à l'approche du créneau (24h) résout le paradoxe inverse
-- (uniquement 'effectuee' révélerait l'adresse APRÈS que le locataire s'y
-- soit déjà rendu, ce qui ne l'aide pas à s'y rendre) tout en rendant
-- l'abus coûteux : il faut bloquer un vrai créneau au moins 24h avant de
-- voir quoi que ce soit de plus précis que le cercle approximatif. Le
-- propriétaire et l'admin voient toujours l'exact, quel que soit le mode
-- choisi (nécessaire pour que le propriétaire modifie son propre marqueur).
CREATE OR REPLACE FUNCTION public.listing_location_is_exact(
  p_listing_id uuid, p_owner_id uuid, p_precision text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_precision = 'precis'
    OR auth.uid() = p_owner_id
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM visits
      WHERE listing_id = p_listing_id AND tenant_id = auth.uid()
        AND (
          status = 'effectuee'
          OR (status = 'confirmee' AND scheduled_at <= now() + interval '24 hours')
        )
    );
$$;

REVOKE ALL ON FUNCTION public.listing_location_is_exact(uuid, uuid, text) FROM PUBLIC;

-- ============================================================================
-- C — Lecture, annonce par annonce (fiche + formulaire d'édition).
-- ============================================================================
-- Arrondi à 2 décimales (grille ~1,1 km), rayon affiché 800 m. Le rayon doit
-- excéder le pire décalage possible de l'arrondi pour que le cercle affiché
-- contienne TOUJOURS réellement le point exact : à 2 décimales, chaque
-- coordonnée peut être décalée d'au plus ~555 m, soit ~785 m au pire cas
-- combiné (latitude ET longitude) — d'où 800 m, avec une petite marge.
CREATE OR REPLACE FUNCTION public.get_listing_location(p_listing_id uuid)
RETURNS TABLE(is_exact boolean, latitude double precision, longitude double precision, radius_meters int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lat double precision;
  v_lng double precision;
  v_precision text;
  v_owner uuid;
  v_exact boolean;
BEGIN
  SELECT l.latitude, l.longitude, l.location_precision, l.owner_id
    INTO v_lat, v_lng, v_precision, v_owner
  FROM listings l WHERE l.id = p_listing_id;

  IF v_lat IS NULL OR v_lng IS NULL THEN
    RETURN; -- pas de localisation : aucune ligne, le client n'affiche pas de carte
  END IF;

  v_exact := public.listing_location_is_exact(p_listing_id, v_owner, v_precision);

  IF v_exact THEN
    RETURN QUERY SELECT true, v_lat, v_lng, NULL::int;
  ELSE
    RETURN QUERY SELECT false, round(v_lat::numeric, 2)::float8, round(v_lng::numeric, 2)::float8, 800;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_listing_location(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_listing_location(uuid) TO authenticated, anon;

-- ============================================================================
-- D — Lecture en masse, pour la carte de recherche. Mêmes filtres que
-- searchListings (lib/search.ts) ; un seul aller-retour réseau pour toute
-- la carte, pas un appel par marqueur.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_map_listings(
  p_city text DEFAULT NULL,
  p_neighborhood text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_property_type text DEFAULT NULL
) RETURNS TABLE(
  id uuid, title text, price numeric, price_period text, image_url text,
  is_exact boolean, latitude double precision, longitude double precision, radius_meters int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.title, l.price, l.price_period, l.image_url,
    ic.is_exact,
    CASE WHEN ic.is_exact THEN l.latitude ELSE round(l.latitude::numeric, 2)::float8 END,
    CASE WHEN ic.is_exact THEN l.longitude ELSE round(l.longitude::numeric, 2)::float8 END,
    CASE WHEN ic.is_exact THEN NULL ELSE 800 END
  FROM listings l
  CROSS JOIN LATERAL (
    SELECT public.listing_location_is_exact(l.id, l.owner_id, l.location_precision) AS is_exact
  ) ic
  WHERE l.status = 'publiee'
    AND l.latitude IS NOT NULL AND l.longitude IS NOT NULL
    AND (p_city IS NULL OR l.city ILIKE '%' || p_city || '%')
    AND (p_neighborhood IS NULL OR l.neighborhood ILIKE '%' || p_neighborhood || '%')
    AND (p_min_price IS NULL OR l.price >= p_min_price)
    AND (p_max_price IS NULL OR l.price <= p_max_price)
    AND (p_property_type IS NULL OR l.property_type = p_property_type)
  LIMIT 500;
$$;

REVOKE ALL ON FUNCTION public.get_map_listings(text, text, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_map_listings(text, text, numeric, numeric, text) TO authenticated, anon;

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP FUNCTION IF EXISTS public.get_map_listings(text, text, numeric, numeric, text);
-- DROP FUNCTION IF EXISTS public.get_listing_location(uuid);
-- DROP FUNCTION IF EXISTS public.listing_location_is_exact(uuid, uuid, text);
-- GRANT SELECT (latitude, longitude) ON public.listings TO authenticated, anon;
-- ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_lng_range;
-- ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_lat_range;
-- ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_lat_lng_together;
-- ALTER TABLE public.listings DROP COLUMN IF EXISTS location_precision;
-- ALTER TABLE public.listings DROP COLUMN IF EXISTS longitude;
-- ALTER TABLE public.listings DROP COLUMN IF EXISTS latitude;
