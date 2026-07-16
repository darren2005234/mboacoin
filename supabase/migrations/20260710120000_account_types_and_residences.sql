-- Chantier 1 — Types de comptes et résidences (fondations)
-- Additif uniquement : aucune annonce ni aucun profil existant n'est cassé.

-- ============================================================================
-- A.1 — PRÉ-VOL (à exécuter séparément AVANT le reste, en lecture seule)
-- ============================================================================
-- Ces deux requêtes ne modifient rien. Exécute-les d'abord dans le SQL Editor
-- Supabase pour savoir si `listings.property_type` a déjà une contrainte CHECK
-- (son nom réel doit remplacer `listings_property_type_check` en A.5 ci-dessous
-- si un nom différent est trouvé), et pour confirmer la fonction de génération
-- d'UUID utilisée par les autres tables (gen_random_uuid vs uuid_generate_v4).
--
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.listings'::regclass AND contype = 'c';
--
-- SELECT column_default FROM information_schema.columns
-- WHERE table_name = 'listings' AND column_name = 'id';

-- ============================================================================
-- A.2 — profiles.account_type
-- ============================================================================
ALTER TABLE public.profiles
  ADD COLUMN account_type text NOT NULL DEFAULT 'personne_physique'
  CHECK (account_type IN ('personne_physique', 'agence', 'residence'));

-- ============================================================================
-- A.3 — Table residences
-- ============================================================================
CREATE TABLE public.residences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  city text NOT NULL,
  neighborhood text,
  address_description text,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX residences_manager_id_idx ON public.residences(manager_id);

-- ============================================================================
-- A.4 — listings.residence_id + listings.price_period
-- ============================================================================
ALTER TABLE public.listings
  ADD COLUMN residence_id uuid REFERENCES public.residences(id) ON DELETE SET NULL,
  ADD COLUMN price_period text NOT NULL DEFAULT 'mensuel'
    CHECK (price_period IN ('mensuel', 'journalier'));

CREATE INDEX listings_residence_id_idx ON public.listings(residence_id);

-- ============================================================================
-- A.5 — Extension de property_type ("Bureau / Local commercial")
-- ============================================================================
-- N'exécuter ce bloc QUE si le pré-vol (A.1) a révélé une contrainte CHECK
-- existante sur listings.property_type. Remplacer XXX par son vrai nom.
-- Si aucune contrainte n'existe côté remote, ne rien faire ici : le champ est
-- du texte libre et la 5e valeur sera simplement acceptée telle quelle.
--
-- ALTER TABLE public.listings DROP CONSTRAINT XXX;
-- ALTER TABLE public.listings ADD CONSTRAINT listings_property_type_check
--   CHECK (property_type IN ('Studio', 'Appartement', 'Villa', 'Chambre', 'Bureau / Local commercial'));

-- ============================================================================
-- A.6 — RLS sur residences (proposition déduite des patterns existants —
-- à confronter à `SELECT * FROM pg_policies WHERE schemaname='public'`
-- avant exécution pour garantir la cohérence avec le modèle de sécurité réel)
-- ============================================================================
ALTER TABLE public.residences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "residences_select_public" ON public.residences
  FOR SELECT USING (true);

CREATE POLICY "residences_insert_own" ON public.residences
  FOR INSERT WITH CHECK (auth.uid() = manager_id);

CREATE POLICY "residences_update_own" ON public.residences
  FOR UPDATE USING (auth.uid() = manager_id);

CREATE POLICY "residences_delete_own" ON public.residences
  FOR DELETE USING (auth.uid() = manager_id);

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP TABLE IF EXISTS public.residences;
-- ALTER TABLE public.listings DROP COLUMN IF EXISTS residence_id;
-- ALTER TABLE public.listings DROP COLUMN IF EXISTS price_period;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS account_type;
