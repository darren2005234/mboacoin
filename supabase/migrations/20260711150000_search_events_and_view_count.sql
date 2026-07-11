-- Chantier Analytique-1 — collecte des recherches + compteur de vues universel

-- ============================================================================
-- A. search_events
-- ============================================================================
CREATE TABLE public.search_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  keywords text,
  min_price numeric,
  max_price numeric,
  property_type text,
  min_rooms integer,
  min_bedrooms integer,
  furnishing text,
  car_access boolean,
  verified_only boolean,
  results_count integer NOT NULL
);

CREATE INDEX search_events_created_at_idx ON public.search_events(created_at);
CREATE INDEX search_events_results_count_idx ON public.search_events(results_count);

ALTER TABLE public.search_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "search_events_insert_anyone" ON public.search_events
  FOR INSERT WITH CHECK (true); -- y compris anonymes

CREATE POLICY "search_events_select_admin" ON public.search_events
  FOR SELECT USING (public.is_admin());

-- ============================================================================
-- B. Compteur de vues universel sur listings
-- ============================================================================
ALTER TABLE public.listings ADD COLUMN view_count integer NOT NULL DEFAULT 0;

-- Fonction d'incrémentation atomique, SECURITY DEFINER : contourne la RLS UPDATE
-- de `listings` (un visiteur anonyme n'a pas de droit d'UPDATE direct sur la table),
-- sans avoir à ouvrir cette table en écriture pour tout le monde. Un seul UPDATE
-- (view_count = view_count + 1) est atomique côté Postgres, pas de lecture-puis-
-- écriture côté client donc pas de course.
CREATE OR REPLACE FUNCTION public.increment_listing_view(p_listing_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.listings SET view_count = view_count + 1 WHERE id = p_listing_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.increment_listing_view(uuid) TO anon, authenticated;
