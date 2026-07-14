-- Correctif : ré-identification par échantillon trop faible sur le tableau de bord agence
--
-- Bug : agency_market_average_prices renvoyait un groupe (ville + type de bien) même
-- calculé sur une seule annonce ("Villa · Bertoua · 1 annonce · 1 000 000 FCFA") : ce n'est
-- pas une moyenne, c'est le prix exact d'un bien identifiable. Le seul étiquetage
-- "échantillon trop faible" (affiché en plus du chiffre) ne protège rien : le chiffre est
-- déjà là. Il faut ne JAMAIS transmettre au client un agrégat calculé sous le seuil minimum.
--
-- Cette migration :
--  1. Applique le masquage par groupe (HAVING >= market_analytics_min_sample()) à
--     agency_market_average_prices : un groupe sous le seuil n'est simplement jamais
--     renvoyé, ni son compte ni son prix.
--  2. Fait remonter, pour CHAQUE fonction, le volume total sous-jacent (avant filtrage/
--     regroupement) à côté de la liste déjà filtrée. Ça permet à l'UI de distinguer :
--       total = 0            -> "Pas encore de données."
--       total > 0, liste vide -> "Données insuffisantes pour cette zone." (jamais un chiffre)
--       liste non vide        -> affichage normal
--     au lieu du message contradictoire "Calculé sur 13 recherches" + "Pas encore de données."

-- ============================================================================
-- A. Prix moyens du marché — masquage par groupe (le correctif principal)
-- ============================================================================
DROP FUNCTION IF EXISTS public.agency_market_average_prices(text, text);

CREATE FUNCTION public.agency_market_average_prices(
  p_city text DEFAULT NULL,
  p_neighborhood text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_groups jsonb;
BEGIN
  IF NOT public.is_agence() THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.listings l
  WHERE l.status = 'publiee'
    AND l.price_period = 'mensuel'
    AND (p_city IS NULL OR l.city ILIKE '%' || p_city || '%')
    AND (p_neighborhood IS NULL OR l.neighborhood ILIKE '%' || p_neighborhood || '%');

  WITH grouped AS (
    SELECT l.city, l.property_type, round(avg(l.price)) AS avg_price, count(*) AS cnt
    FROM public.listings l
    WHERE l.status = 'publiee'
      AND l.price_period = 'mensuel'
      AND (p_city IS NULL OR l.city ILIKE '%' || p_city || '%')
      AND (p_neighborhood IS NULL OR l.neighborhood ILIKE '%' || p_neighborhood || '%')
    GROUP BY l.city, l.property_type
    HAVING count(*) >= public.market_analytics_min_sample()
    ORDER BY count(*) DESC
  )
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'city', city, 'propertyType', property_type, 'avgPrice', avg_price, 'count', cnt
    )),
    '[]'::jsonb
  )
  INTO v_groups
  FROM grouped;

  RETURN jsonb_build_object('groups', v_groups, 'totalListings', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.agency_market_average_prices(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agency_market_average_prices(text, text) TO authenticated;

-- ============================================================================
-- B. Budgets recherchés — masquage de la distribution entière sous le seuil global
--    (contrairement aux prix, une tranche de budget n'est pas rattachable à un bien
--    précis ; le seuil s'applique donc au volume total, pas tranche par tranche)
-- ============================================================================
DROP FUNCTION IF EXISTS public.agency_market_budget_distribution(text);

CREATE FUNCTION public.agency_market_budget_distribution(
  p_zone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_buckets jsonb;
BEGIN
  IF NOT public.is_agence() THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total FROM (
    SELECT 1
    FROM public.search_events
    WHERE (min_price IS NOT NULL OR max_price IS NOT NULL)
      AND (p_zone IS NULL OR keywords ILIKE '%' || p_zone || '%')
    ORDER BY created_at DESC
    LIMIT 1000
  ) w;

  IF v_total < public.market_analytics_min_sample() THEN
    RETURN jsonb_build_object('buckets', '[]'::jsonb, 'sampleSize', v_total);
  END IF;

  WITH win AS (
    SELECT COALESCE(max_price, min_price) AS value
    FROM public.search_events
    WHERE (min_price IS NOT NULL OR max_price IS NOT NULL)
      AND (p_zone IS NULL OR keywords ILIKE '%' || p_zone || '%')
    ORDER BY created_at DESC
    LIMIT 1000
  ),
  bucketed AS (
    SELECT CASE
      WHEN value < 50000 THEN 1
      WHEN value < 100000 THEN 2
      WHEN value < 150000 THEN 3
      WHEN value < 250000 THEN 4
      WHEN value < 500000 THEN 5
      ELSE 6
    END AS ord
    FROM win
  ),
  labels(ord, label) AS (
    VALUES (1, '< 50 000 FCFA'), (2, '50 000 – 100 000 FCFA'), (3, '100 000 – 150 000 FCFA'),
           (4, '150 000 – 250 000 FCFA'), (5, '250 000 – 500 000 FCFA'), (6, '500 000 FCFA et plus')
  ),
  final AS (
    SELECT l.label, COALESCE(b.cnt, 0)::integer AS bucket_count
    FROM labels l
    LEFT JOIN (SELECT ord, count(*) AS cnt FROM bucketed GROUP BY ord) b ON b.ord = l.ord
    ORDER BY l.ord
  )
  SELECT jsonb_agg(jsonb_build_object('label', label, 'count', bucket_count))
  INTO v_buckets
  FROM final;

  RETURN jsonb_build_object('buckets', v_buckets, 'sampleSize', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.agency_market_budget_distribution(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agency_market_budget_distribution(text) TO authenticated;

-- ============================================================================
-- C. Évolution dans le temps — même logique : le volume total (pas juste le nombre
--    de mois distincts) détermine si le graphe est affiché
-- ============================================================================
DROP FUNCTION IF EXISTS public.agency_market_trend(text, integer);

CREATE FUNCTION public.agency_market_trend(
  p_zone text DEFAULT NULL,
  p_months integer DEFAULT 6
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_points jsonb;
BEGIN
  IF NOT public.is_agence() THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.search_events e
  WHERE e.created_at >= (now() - (p_months || ' months')::interval)
    AND (p_zone IS NULL OR e.keywords ILIKE '%' || p_zone || '%');

  IF v_total < public.market_analytics_min_sample() THEN
    RETURN jsonb_build_object('points', '[]'::jsonb, 'totalSearches', v_total);
  END IF;

  WITH monthly AS (
    SELECT to_char(date_trunc('month', e.created_at), 'YYYY-MM') AS month,
           count(*) AS search_count,
           count(*) FILTER (WHERE e.results_count = 0) AS zero_result_count
    FROM public.search_events e
    WHERE e.created_at >= (now() - (p_months || ' months')::interval)
      AND (p_zone IS NULL OR e.keywords ILIKE '%' || p_zone || '%')
    GROUP BY 1
    ORDER BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
    'month', month, 'searchCount', search_count, 'zeroResultCount', zero_result_count
  ))
  INTO v_points
  FROM monthly;

  RETURN jsonb_build_object('points', v_points, 'totalSearches', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.agency_market_trend(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agency_market_trend(text, integer) TO authenticated;
