-- Sous-chantier BAIL-1 — Socle du bail (création par le bailleur, rattachement par téléphone)
-- Additif uniquement : aucune annonce ni aucun profil existant n'est cassé.

-- ============================================================================
-- A.1 — PRÉ-VOL (à exécuter séparément AVANT le reste, en lecture seule)
-- ============================================================================
-- Confirme si listings.status a une contrainte CHECK (le code applicatif utilise
-- déjà 'louee', donc si une contrainte existe elle l'inclut forcément), et que
-- profiles.phone existe bien (utilisé par lib/profile.ts).
--
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.listings'::regclass AND contype = 'c';
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'profiles' AND column_name = 'phone';

-- ============================================================================
-- A.2 — Normalisation de téléphone
-- ============================================================================
-- Ne garde que les chiffres puis prend les 9 derniers (longueur d'un numéro
-- mobile camerounais) : "6XXXXXXXX", "+2376XXXXXXXX", "2376XXXXXXXX" et
-- "00 237 6XX XX XX XX" normalisent tous vers la même valeur.
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9);
$$;

-- Numéro de l'utilisateur connecté, normalisé. Priorité au JWT (donnée
-- d'authentification OTP, toujours à jour dans la session) avec repli sur
-- profiles.phone (même stratégie de repli que lib/profile.ts:33), pour ne
-- jamais dépendre d'une seule source pouvant être désynchronisée.
CREATE OR REPLACE FUNCTION public.current_user_phone_normalized()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.normalize_phone(
    coalesce(
      auth.jwt() ->> 'phone',
      (SELECT phone FROM public.profiles WHERE id = auth.uid())
    )
  );
$$;

-- ============================================================================
-- A.3 — Table leases
-- ============================================================================
CREATE TABLE public.leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id),
  landlord_id uuid NOT NULL REFERENCES public.profiles(id),
  residence_id uuid REFERENCES public.residences(id) ON DELETE SET NULL,
  tenant_phone text NOT NULL,
  tenant_phone_normalized text GENERATED ALWAYS AS (public.normalize_phone(tenant_phone)) STORED,
  tenant_id uuid REFERENCES public.profiles(id),
  start_date date NOT NULL,
  duration_months integer CHECK (duration_months IS NULL OR duration_months > 0),
  end_date date,
  rent_amount numeric NOT NULL,
  deposit_amount numeric,
  advance_amount numeric,
  payment_day integer CHECK (payment_day IS NULL OR payment_day BETWEEN 1 AND 31),
  payment_period text NOT NULL DEFAULT 'mensuel'
    CHECK (payment_period IN ('mensuel', 'journalier')),
  status text NOT NULL DEFAULT 'en_attente_confirmation'
    CHECK (status IN ('en_attente_confirmation', 'actif', 'rejete', 'termine', 'resilie', 'arrete')),
  end_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  ended_at timestamptz
);

CREATE INDEX leases_listing_id_idx ON public.leases(listing_id);
CREATE INDEX leases_landlord_id_idx ON public.leases(landlord_id);
CREATE INDEX leases_tenant_id_idx ON public.leases(tenant_id);
CREATE INDEX leases_tenant_phone_normalized_idx ON public.leases(tenant_phone_normalized);

-- Un seul bail "en cours" (en attente ou actif) à la fois par logement.
CREATE UNIQUE INDEX leases_one_pending_or_active_per_listing
  ON public.leases(listing_id)
  WHERE status IN ('en_attente_confirmation', 'actif');

-- ============================================================================
-- A.4 — Dérivation landlord_id/residence_id + garde de disponibilité +
-- bascule automatique de l'annonce en "louee"
-- ============================================================================
-- landlord_id/residence_id sont dérivés du logement (jamais envoyés par le
-- client) : un client ne peut donc pas mentir sur qui est le bailleur, quel
-- que soit ce qu'il envoie à l'insertion. La bascule "louee" se fait dans la
-- même transaction que la création du bail. Pas de SECURITY DEFINER
-- nécessaire : les policies listings autorisent déjà le propriétaire à lire
-- et modifier son propre logement.
CREATE OR REPLACE FUNCTION public.leases_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_residence_id uuid;
  v_status text;
BEGIN
  SELECT owner_id, residence_id, status
    INTO v_owner_id, v_residence_id, v_status
    FROM public.listings WHERE id = NEW.listing_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'listing_id invalide';
  END IF;

  IF v_status <> 'publiee' THEN
    RAISE EXCEPTION 'ce logement n''est pas disponible pour la création d''un bail';
  END IF;

  NEW.landlord_id := v_owner_id;
  NEW.residence_id := v_residence_id;

  UPDATE public.listings SET status = 'louee' WHERE id = NEW.listing_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER leases_before_insert_trigger
  BEFORE INSERT ON public.leases
  FOR EACH ROW
  EXECUTE FUNCTION public.leases_before_insert();

-- ============================================================================
-- A.5 — RLS
-- ============================================================================
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leases_select_landlord" ON public.leases
  FOR SELECT USING (auth.uid() = landlord_id);

CREATE POLICY "leases_select_tenant" ON public.leases
  FOR SELECT USING (
    tenant_id = auth.uid()
    OR (tenant_id IS NULL AND tenant_phone_normalized = public.current_user_phone_normalized())
  );

CREATE POLICY "leases_select_admin" ON public.leases
  FOR SELECT USING (public.is_admin());

-- landlord_id est réécrit par le trigger BEFORE INSERT avant l'évaluation de
-- WITH CHECK : cette policy n'autorise donc la création que si le trigger a
-- résolu landlord_id = auth.uid(), c'est-à-dire seulement sur un logement dont
-- l'utilisateur est réellement propriétaire.
CREATE POLICY "leases_insert_landlord" ON public.leases
  FOR INSERT WITH CHECK (auth.uid() = landlord_id);

-- Rattachement par téléphone : ne permet de modifier QUE tenant_id, QUE sur
-- une ligne pas encore rattachée, QUE si le téléphone correspond, et QUE vers
-- son propre uid (WITH CHECK). Aucune autre colonne n'est concernée.
CREATE POLICY "leases_link_tenant_by_phone" ON public.leases
  FOR UPDATE
  USING (tenant_id IS NULL AND tenant_phone_normalized = public.current_user_phone_normalized())
  WITH CHECK (tenant_id = auth.uid());

-- Pas de policy UPDATE pour le bailleur dans ce chantier (confirmation /
-- résiliation viendront au sous-chantier suivant).

-- ============================================================================
-- A.6 — Fonction de rattachement (appelée après connexion/inscription)
-- ============================================================================
-- SECURITY INVOKER : passe par la policy leases_link_tenant_by_phone
-- ci-dessus, qui reste la vraie garde de sécurité. Cette fonction n'est qu'un
-- raccourci pratique pour l'appeler en un seul aller-retour depuis l'app.
CREATE OR REPLACE FUNCTION public.link_my_pending_leases()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.leases
  SET tenant_id = auth.uid()
  WHERE tenant_id IS NULL
    AND tenant_phone_normalized = public.current_user_phone_normalized();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.link_my_pending_leases() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_my_pending_leases() TO authenticated;

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP TABLE IF EXISTS public.leases;
-- DROP FUNCTION IF EXISTS public.leases_before_insert();
-- DROP FUNCTION IF EXISTS public.link_my_pending_leases();
-- DROP FUNCTION IF EXISTS public.current_user_phone_normalized();
-- DROP FUNCTION IF EXISTS public.normalize_phone(text);
