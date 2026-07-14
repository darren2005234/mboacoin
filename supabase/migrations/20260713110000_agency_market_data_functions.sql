-- Correctif chantier Analytique-1 — donnée de marché agrégée et anonymisée pour les agences
--
-- Bug : search_events n'autorise la lecture qu'à is_admin(). Les comptes agence
-- interrogeaient la table directement depuis le client (lib/market-data.ts),
-- filtrés seulement par un check JS sans effet sur la RLS -> zéro ligne, silencieusement.
--
-- Correctif : pas de policy SELECT pour les agences sur search_events (elles ne doivent
-- jamais voir une recherche individuelle ni l'identité de qui a cherché). À la place,
-- des fonctions SECURITY DEFINER qui vérifient elles-mêmes l'appelant et ne renvoient
-- que des agrégats.

-- ============================================================================
-- A. Garde-fous
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_agence()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND account_type = 'agence'
  );
$$;

REVOKE ALL ON FUNCTION public.is_agence() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_agence() TO authenticated;

-- Seuil minimum d'échantillon en dessous duquel un terme/mot-clé n'est pas restitué :
-- une recherche de texte libre est quasi-identifiante quand trop peu de personnes l'ont tapée.
CREATE OR REPLACE FUNCTION public.market_analytics_min_sample()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 5; $$;

-- ============================================================================
-- B. Demande par zone — top mots-clés recherchés
-- ============================================================================
CREATE OR REPLACE FUNCTION public.agency_market_top_terms(
  p_zone text DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_terms jsonb;
BEGIN
  IF NOT public.is_agence() THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;

  WITH win AS (
    SELECT lower(trim(keywords)) AS term
    FROM public.search_events
    WHERE keywords IS NOT NULL
      AND (p_zone IS NULL OR keywords ILIKE '%' || p_zone || '%')
    ORDER BY created_at DESC
    LIMIT 1000
  )
  SELECT count(*) INTO v_total FROM win WHERE term <> '';

  WITH win AS (
    SELECT lower(trim(keywords)) AS term
    FROM public.search_events
    WHERE keywords IS NOT NULL
      AND (p_zone IS NULL OR keywords ILIKE '%' || p_zone || '%')
    ORDER BY created_at DESC
    LIMIT 1000
  ),
  grouped AS (
    SELECT term, count(*) AS cnt
    FROM win
    WHERE term <> ''
    GROUP BY term
    HAVING count(*) >= public.market_analytics_min_sample()
    ORDER BY count(*) DESC
    LIMIT p_limit
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('term', term, 'count', cnt)), '[]'::jsonb)
  INTO v_terms
  FROM grouped;

  RETURN jsonb_build_object('terms', v_terms, 'sampleSize', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.agency_market_top_terms(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agency_market_top_terms(text, integer) TO authenticated;

-- ============================================================================
-- C. Répartition des budgets recherchés (mêmes tranches que l'observatoire admin)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.agency_market_budget_distribution(
  p_zone text DEFAULT NULL
)
RETURNS TABLE(bucket_label text, bucket_count integer, sample_size integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
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

  RETURN QUERY
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
  )
  SELECT l.label, COALESCE(b.cnt, 0)::integer, v_total
  FROM labels l
  LEFT JOIN (SELECT ord, count(*) AS cnt FROM bucketed GROUP BY ord) b ON b.ord = l.ord
  ORDER BY l.ord;
END;
$$;

REVOKE ALL ON FUNCTION public.agency_market_budget_distribution(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agency_market_budget_distribution(text) TO authenticated;

-- ============================================================================
-- D. Demande non satisfaite — top mots-clés parmi les recherches sans résultat
--    (remplace l'ancienne liste de recherches individuelles : jamais de ligne brute)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.agency_market_unmet_terms(
  p_zone text DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_terms jsonb;
BEGIN
  IF NOT public.is_agence() THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;

  WITH win AS (
    SELECT lower(trim(keywords)) AS term
    FROM public.search_events
    WHERE results_count = 0
      AND keywords IS NOT NULL
      AND (p_zone IS NULL OR keywords ILIKE '%' || p_zone || '%')
    ORDER BY created_at DESC
    LIMIT 1000
  )
  SELECT count(*) INTO v_total FROM win WHERE term <> '';

  WITH win AS (
    SELECT lower(trim(keywords)) AS term
    FROM public.search_events
    WHERE results_count = 0
      AND keywords IS NOT NULL
      AND (p_zone IS NULL OR keywords ILIKE '%' || p_zone || '%')
    ORDER BY created_at DESC
    LIMIT 1000
  ),
  grouped AS (
    SELECT term, count(*) AS cnt
    FROM win
    WHERE term <> ''
    GROUP BY term
    HAVING count(*) >= public.market_analytics_min_sample()
    ORDER BY count(*) DESC
    LIMIT p_limit
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('term', term, 'count', cnt)), '[]'::jsonb)
  INTO v_terms
  FROM grouped;

  RETURN jsonb_build_object('terms', v_terms, 'sampleSize', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.agency_market_unmet_terms(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agency_market_unmet_terms(text, integer) TO authenticated;

-- ============================================================================
-- E. Prix moyens du marché par ville / type de bien
--    (annonces publiées, déjà publiques : pas de risque de ré-identification, agrégée
--    ici pour la lisibilité et pour ne plus dépendre d'un check cote client)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.agency_market_average_prices(
  p_city text DEFAULT NULL,
  p_neighborhood text DEFAULT NULL
)
RETURNS TABLE(city text, property_type text, avg_price numeric, sample_size integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_agence() THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT l.city, l.property_type, round(avg(l.price))::numeric, count(*)::integer
  FROM public.listings l
  WHERE l.status = 'publiee'
    AND l.price_period = 'mensuel'
    AND (p_city IS NULL OR l.city ILIKE '%' || p_city || '%')
    AND (p_neighborhood IS NULL OR l.neighborhood ILIKE '%' || p_neighborhood || '%')
  GROUP BY l.city, l.property_type
  ORDER BY count(*) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.agency_market_average_prices(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agency_market_average_prices(text, text) TO authenticated;

-- ============================================================================
-- F. Évolution mensuelle des recherches
-- ============================================================================
CREATE OR REPLACE FUNCTION public.agency_market_trend(
  p_zone text DEFAULT NULL,
  p_months integer DEFAULT 6
)
RETURNS TABLE(month text, search_count integer, zero_result_count integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_agence() THEN
    RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT to_char(date_trunc('month', e.created_at), 'YYYY-MM'),
         count(*)::integer,
         count(*) FILTER (WHERE e.results_count = 0)::integer
  FROM public.search_events e
  WHERE e.created_at >= (now() - (p_months || ' months')::interval)
    AND (p_zone IS NULL OR e.keywords ILIKE '%' || p_zone || '%')
  GROUP BY 1
  ORDER BY 1;
END;
$$;

REVOKE ALL ON FUNCTION public.agency_market_trend(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.agency_market_trend(text, integer) TO authenticated;
