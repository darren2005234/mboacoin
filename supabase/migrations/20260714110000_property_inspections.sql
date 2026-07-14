-- Chantier ÉTAT DES LIEUX — état des lieux photographique contradictoire
-- (entrée / sortie), pièce par pièce, verrouillé une fois validé.
-- Additif uniquement : aucune table existante n'est modifiée, à l'exception
-- de leases_after_update_notify (Partie E) qui est étendue via CREATE OR
-- REPLACE pour notifier la disponibilité de la sortie.
--
-- Principe central : une fois status = 'valide', la ligne etat_des_lieux et
-- tout son contenu (pièces, photos, observations) sont définitivement
-- immuables — ni le bailleur, ni le locataire, ni l'administrateur ne
-- peuvent les modifier ou les supprimer. Photos et observations sont
-- append-only dès leur création (jamais d'UPDATE/DELETE, même en brouillon),
-- cohérent avec lease_request_attachments/lease_request_messages : rien
-- n'est jamais silencieusement modifié, tout est historisé.

-- ============================================================================
-- A — Bucket privé etat-des-lieux (photos par pièce)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('etat-des-lieux', 'etat-des-lieux', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- B — Tables
-- ============================================================================
CREATE TABLE public.etat_des_lieux (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id),
  type text NOT NULL CHECK (type IN ('entree', 'sortie')),
  status text NOT NULL DEFAULT 'brouillon'
    CHECK (status IN ('brouillon', 'soumis', 'conteste', 'valide')),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  submitted_at timestamptz,
  submitted_by uuid REFERENCES public.profiles(id),
  validated_at timestamptz,
  validated_by uuid REFERENCES public.profiles(id),
  disputed_at timestamptz,
  disputed_by uuid REFERENCES public.profiles(id),
  dispute_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lease_id, type)
);

CREATE INDEX etat_des_lieux_lease_id_idx ON public.etat_des_lieux(lease_id);

-- Libre : le bailleur choisit le libellé réel de la pièce ; type_piece ne
-- sert que de catégorie (icône/tri), pas de contrainte sur les logements.
CREATE TABLE public.etat_des_lieux_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etat_des_lieux_id uuid NOT NULL REFERENCES public.etat_des_lieux(id),
  type_piece text NOT NULL DEFAULT 'autre'
    CHECK (type_piece IN ('salon', 'chambre', 'cuisine', 'salle_de_bain', 'exterieur', 'autre')),
  libelle text NOT NULL CHECK (btrim(libelle) <> ''),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX etat_des_lieux_pieces_etat_des_lieux_id_idx ON public.etat_des_lieux_pieces(etat_des_lieux_id);

-- Append-only : jamais d'UPDATE/DELETE (voir Partie D). uploaded_by/auteur_role
-- identifient sans ambiguïté qui a pris la photo (bailleur ou locataire).
CREATE TABLE public.etat_des_lieux_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id uuid NOT NULL REFERENCES public.etat_des_lieux_pieces(id),
  storage_path text NOT NULL,
  auteur_id uuid NOT NULL REFERENCES public.profiles(id),
  auteur_role text NOT NULL CHECK (auteur_role IN ('bailleur', 'locataire')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX etat_des_lieux_photos_piece_id_idx ON public.etat_des_lieux_photos(piece_id);

-- Append-only comme les photos : une observation est un événement horodaté
-- et attribué, pas un champ éditable — l'historique complet (y compris à
-- travers des cycles de contestation) est conservé. L'UI affiche la
-- dernière observation de chaque rôle par pièce comme "texte courant".
CREATE TABLE public.etat_des_lieux_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id uuid NOT NULL REFERENCES public.etat_des_lieux_pieces(id),
  auteur_id uuid NOT NULL REFERENCES public.profiles(id),
  auteur_role text NOT NULL CHECK (auteur_role IN ('bailleur', 'locataire')),
  texte text NOT NULL CHECK (btrim(texte) <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX etat_des_lieux_observations_piece_id_idx ON public.etat_des_lieux_observations(piece_id);

-- ============================================================================
-- C — Triggers : dérivation serveur + machine à états + verrou définitif
-- ============================================================================
-- RLS décide qui peut tenter une écriture ; ce trigger tranche la légalité
-- fine de la transition et dérive toutes les colonnes sensibles côté
-- serveur (jamais fié à une valeur client), même principe que
-- leases_before_update / lease_amendments_guard.
--
-- Condition la plus importante du chantier : une fois OLD.status = 'valide',
-- AUCUNE écriture n'est autorisée, sans aucune exception (pas de flag de
-- bypass comme app.bypass_leases_guard) — même l'administrateur ne peut pas
-- passer outre.
CREATE OR REPLACE FUNCTION public.etat_des_lieux_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_landlord_id uuid;
  v_tenant_id uuid;
  v_lease_status text;
  v_end_date date;
  v_new_dispute_reason text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT landlord_id, tenant_id, status, end_date
      INTO v_landlord_id, v_tenant_id, v_lease_status, v_end_date
    FROM public.leases WHERE id = NEW.lease_id;

    IF v_landlord_id IS NULL THEN
      RAISE EXCEPTION 'bail introuvable';
    END IF;
    IF auth.uid() IS DISTINCT FROM v_landlord_id THEN
      RAISE EXCEPTION 'seul le bailleur peut créer un état des lieux';
    END IF;

    -- Porte de disponibilité de la sortie : bail terminé, ou bail actif à
    -- moins de 30 jours de sa fin prévue.
    IF NEW.type = 'sortie' AND NOT (
      v_lease_status IN ('termine', 'resilie', 'arrete')
      OR (v_lease_status = 'actif' AND v_end_date IS NOT NULL AND v_end_date - current_date <= 30)
    ) THEN
      RAISE EXCEPTION 'état des lieux de sortie pas encore disponible';
    END IF;

    NEW.created_by := auth.uid();
    NEW.status := 'brouillon';
    NEW.submitted_at := NULL; NEW.submitted_by := NULL;
    NEW.validated_at := NULL; NEW.validated_by := NULL;
    NEW.disputed_at := NULL; NEW.disputed_by := NULL;
    RETURN NEW;
  END IF;

  IF OLD.status = 'valide' THEN
    RAISE EXCEPTION 'état des lieux verrouillé, aucune modification possible';
  END IF;

  SELECT landlord_id, tenant_id INTO v_landlord_id, v_tenant_id
  FROM public.leases WHERE id = OLD.lease_id;

  v_new_dispute_reason := NEW.dispute_reason;

  -- Verrouille tout par défaut ; seules les branches ci-dessous autorisent
  -- une évolution précise, sur les colonnes qu'elles dérivent elles-mêmes.
  NEW.lease_id := OLD.lease_id;
  NEW.type := OLD.type;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  NEW.submitted_at := OLD.submitted_at;
  NEW.submitted_by := OLD.submitted_by;
  NEW.validated_at := OLD.validated_at;
  NEW.validated_by := OLD.validated_by;
  NEW.disputed_at := OLD.disputed_at;
  NEW.disputed_by := OLD.disputed_by;
  NEW.dispute_reason := OLD.dispute_reason;

  IF auth.uid() = v_landlord_id THEN
    IF NOT (OLD.status IN ('brouillon', 'conteste') AND NEW.status = 'soumis') THEN
      RAISE EXCEPTION 'transition de statut invalide pour le bailleur';
    END IF;
    NEW.submitted_at := now();
    NEW.submitted_by := auth.uid();

  ELSIF auth.uid() = v_tenant_id THEN
    IF OLD.status <> 'soumis' THEN
      RAISE EXCEPTION 'transition de statut invalide pour le locataire';
    END IF;

    IF NEW.status = 'valide' THEN
      NEW.validated_at := now();
      NEW.validated_by := auth.uid();
    ELSIF NEW.status = 'conteste' THEN
      IF v_new_dispute_reason IS NULL OR btrim(v_new_dispute_reason) = '' THEN
        RAISE EXCEPTION 'un motif de contestation est requis';
      END IF;
      NEW.disputed_at := now();
      NEW.disputed_by := auth.uid();
      NEW.dispute_reason := v_new_dispute_reason;
    ELSE
      RAISE EXCEPTION 'transition de statut invalide pour le locataire';
    END IF;

  ELSE
    RAISE EXCEPTION 'non autorisé';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER etat_des_lieux_guard_trigger
  BEFORE INSERT OR UPDATE ON public.etat_des_lieux
  FOR EACH ROW
  EXECUTE FUNCTION public.etat_des_lieux_guard();

-- Pièces : libellé/type modifiables ou supprimables uniquement tant que
-- l'état des lieux est en brouillon (avant que quiconque l'ait vu) ; ajout
-- possible aussi après contestation (le bailleur peut ajouter une pièce
-- oubliée en corrigeant). Toujours réservé au bailleur.
CREATE OR REPLACE FUNCTION public.etat_des_lieux_pieces_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_landlord_id uuid;
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT e.status, l.landlord_id INTO v_status, v_landlord_id
    FROM public.etat_des_lieux e
    JOIN public.leases l ON l.id = e.lease_id
    WHERE e.id = OLD.etat_des_lieux_id;

    IF auth.uid() IS DISTINCT FROM v_landlord_id THEN
      RAISE EXCEPTION 'seul le bailleur peut supprimer une pièce';
    END IF;
    IF v_status <> 'brouillon' THEN
      RAISE EXCEPTION 'pièce non supprimable après soumission';
    END IF;
    RETURN OLD;
  END IF;

  SELECT e.status, l.landlord_id INTO v_status, v_landlord_id
  FROM public.etat_des_lieux e
  JOIN public.leases l ON l.id = e.lease_id
  WHERE e.id = NEW.etat_des_lieux_id;

  IF v_landlord_id IS NULL THEN
    RAISE EXCEPTION 'état des lieux introuvable';
  END IF;
  IF auth.uid() IS DISTINCT FROM v_landlord_id THEN
    RAISE EXCEPTION 'seul le bailleur peut modifier les pièces';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF v_status NOT IN ('brouillon', 'conteste') THEN
      RAISE EXCEPTION 'ajout de pièce impossible dans cet état';
    END IF;
    NEW.created_by := auth.uid();
    RETURN NEW;
  END IF;

  -- UPDATE
  IF v_status <> 'brouillon' THEN
    RAISE EXCEPTION 'pièce non modifiable après soumission';
  END IF;
  NEW.etat_des_lieux_id := OLD.etat_des_lieux_id;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

CREATE TRIGGER etat_des_lieux_pieces_guard_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.etat_des_lieux_pieces
  FOR EACH ROW
  EXECUTE FUNCTION public.etat_des_lieux_pieces_guard();

-- Photos et observations : dérive auteur_id/auteur_role depuis auth.uid()
-- comparé aux parties du bail (jamais fié à une valeur client), et
-- n'autorise l'ajout que si le rôle de l'appelant correspond au statut
-- courant de l'état des lieux (bailleur en brouillon/conteste, locataire en
-- soumis). Pas de trigger UPDATE/DELETE : ces tables n'ont aucune policy
-- correspondante (Partie D), donc rien à garder ici.
CREATE OR REPLACE FUNCTION public.etat_des_lieux_photos_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_landlord_id uuid;
  v_tenant_id uuid;
BEGIN
  SELECT e.status, l.landlord_id, l.tenant_id INTO v_status, v_landlord_id, v_tenant_id
  FROM public.etat_des_lieux_pieces p
  JOIN public.etat_des_lieux e ON e.id = p.etat_des_lieux_id
  JOIN public.leases l ON l.id = e.lease_id
  WHERE p.id = NEW.piece_id;

  IF v_landlord_id IS NULL THEN
    RAISE EXCEPTION 'pièce introuvable';
  END IF;

  NEW.auteur_id := auth.uid();

  IF auth.uid() = v_landlord_id THEN
    IF v_status NOT IN ('brouillon', 'conteste') THEN
      RAISE EXCEPTION 'ajout de photo impossible dans cet état';
    END IF;
    NEW.auteur_role := 'bailleur';
  ELSIF auth.uid() = v_tenant_id THEN
    IF v_status <> 'soumis' THEN
      RAISE EXCEPTION 'ajout de photo impossible dans cet état';
    END IF;
    NEW.auteur_role := 'locataire';
  ELSE
    RAISE EXCEPTION 'non autorisé';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER etat_des_lieux_photos_before_insert_trigger
  BEFORE INSERT ON public.etat_des_lieux_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.etat_des_lieux_photos_before_insert();

CREATE OR REPLACE FUNCTION public.etat_des_lieux_observations_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_landlord_id uuid;
  v_tenant_id uuid;
BEGIN
  SELECT e.status, l.landlord_id, l.tenant_id INTO v_status, v_landlord_id, v_tenant_id
  FROM public.etat_des_lieux_pieces p
  JOIN public.etat_des_lieux e ON e.id = p.etat_des_lieux_id
  JOIN public.leases l ON l.id = e.lease_id
  WHERE p.id = NEW.piece_id;

  IF v_landlord_id IS NULL THEN
    RAISE EXCEPTION 'pièce introuvable';
  END IF;

  NEW.auteur_id := auth.uid();

  IF auth.uid() = v_landlord_id THEN
    IF v_status NOT IN ('brouillon', 'conteste') THEN
      RAISE EXCEPTION 'ajout d''observation impossible dans cet état';
    END IF;
    NEW.auteur_role := 'bailleur';
  ELSIF auth.uid() = v_tenant_id THEN
    IF v_status <> 'soumis' THEN
      RAISE EXCEPTION 'ajout d''observation impossible dans cet état';
    END IF;
    NEW.auteur_role := 'locataire';
  ELSE
    RAISE EXCEPTION 'non autorisé';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER etat_des_lieux_observations_before_insert_trigger
  BEFORE INSERT ON public.etat_des_lieux_observations
  FOR EACH ROW
  EXECUTE FUNCTION public.etat_des_lieux_observations_before_insert();

-- ============================================================================
-- D — RLS
-- ============================================================================
ALTER TABLE public.etat_des_lieux ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etat_des_lieux_pieces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etat_des_lieux_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etat_des_lieux_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "etat_des_lieux_select_parties" ON public.etat_des_lieux
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = etat_des_lieux.lease_id
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  );

CREATE POLICY "etat_des_lieux_select_admin" ON public.etat_des_lieux
  FOR SELECT USING (public.is_admin());

-- La légalité fine (type, disponibilité de la sortie) est à la charge du
-- trigger C ci-dessus ; cette policy autorise seulement le bailleur du bail.
CREATE POLICY "etat_des_lieux_insert_landlord" ON public.etat_des_lieux
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = etat_des_lieux.lease_id
        AND leases.landlord_id = auth.uid()
    )
  );

-- Premier verrou : status <> 'valide' (aucune ligne ne matche une fois
-- verrouillée). Deuxième verrou, sans aucune exception : le trigger C.
CREATE POLICY "etat_des_lieux_update_parties" ON public.etat_des_lieux
  FOR UPDATE USING (
    status <> 'valide'
    AND EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = etat_des_lieux.lease_id
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id = etat_des_lieux.lease_id
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  );

-- Pas de policy DELETE : un état des lieux n'est jamais supprimé, même en
-- brouillon (simplicité, cohérent avec "aucune suppression").

CREATE POLICY "etat_des_lieux_pieces_select_parties" ON public.etat_des_lieux_pieces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.etat_des_lieux e
      JOIN public.leases l ON l.id = e.lease_id
      WHERE e.id = etat_des_lieux_pieces.etat_des_lieux_id
        AND (l.landlord_id = auth.uid() OR l.tenant_id = auth.uid())
    )
  );

CREATE POLICY "etat_des_lieux_pieces_select_admin" ON public.etat_des_lieux_pieces
  FOR SELECT USING (public.is_admin());

-- Légalité fine (statut brouillon/conteste) à la charge du trigger C.
CREATE POLICY "etat_des_lieux_pieces_insert_landlord" ON public.etat_des_lieux_pieces
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.etat_des_lieux e
      JOIN public.leases l ON l.id = e.lease_id
      WHERE e.id = etat_des_lieux_pieces.etat_des_lieux_id
        AND l.landlord_id = auth.uid()
    )
  );

CREATE POLICY "etat_des_lieux_pieces_update_landlord" ON public.etat_des_lieux_pieces
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.etat_des_lieux e
      JOIN public.leases l ON l.id = e.lease_id
      WHERE e.id = etat_des_lieux_pieces.etat_des_lieux_id
        AND l.landlord_id = auth.uid()
        AND e.status = 'brouillon'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.etat_des_lieux e
      JOIN public.leases l ON l.id = e.lease_id
      WHERE e.id = etat_des_lieux_pieces.etat_des_lieux_id
        AND l.landlord_id = auth.uid()
    )
  );

CREATE POLICY "etat_des_lieux_pieces_delete_landlord" ON public.etat_des_lieux_pieces
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.etat_des_lieux e
      JOIN public.leases l ON l.id = e.lease_id
      WHERE e.id = etat_des_lieux_pieces.etat_des_lieux_id
        AND l.landlord_id = auth.uid()
        AND e.status = 'brouillon'
    )
  );

CREATE POLICY "etat_des_lieux_photos_select_parties" ON public.etat_des_lieux_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.etat_des_lieux_pieces p
      JOIN public.etat_des_lieux e ON e.id = p.etat_des_lieux_id
      JOIN public.leases l ON l.id = e.lease_id
      WHERE p.id = etat_des_lieux_photos.piece_id
        AND (l.landlord_id = auth.uid() OR l.tenant_id = auth.uid())
    )
  );

CREATE POLICY "etat_des_lieux_photos_select_admin" ON public.etat_des_lieux_photos
  FOR SELECT USING (public.is_admin());

-- Légalité fine (rôle vs statut) à la charge du trigger avant-insertion.
CREATE POLICY "etat_des_lieux_photos_insert_parties" ON public.etat_des_lieux_photos
  FOR INSERT WITH CHECK (
    auteur_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.etat_des_lieux_pieces p
      JOIN public.etat_des_lieux e ON e.id = p.etat_des_lieux_id
      JOIN public.leases l ON l.id = e.lease_id
      WHERE p.id = etat_des_lieux_photos.piece_id
        AND (l.landlord_id = auth.uid() OR l.tenant_id = auth.uid())
    )
  );
-- Pas de policy UPDATE/DELETE : append-only, comme lease_request_attachments.

CREATE POLICY "etat_des_lieux_observations_select_parties" ON public.etat_des_lieux_observations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.etat_des_lieux_pieces p
      JOIN public.etat_des_lieux e ON e.id = p.etat_des_lieux_id
      JOIN public.leases l ON l.id = e.lease_id
      WHERE p.id = etat_des_lieux_observations.piece_id
        AND (l.landlord_id = auth.uid() OR l.tenant_id = auth.uid())
    )
  );

CREATE POLICY "etat_des_lieux_observations_select_admin" ON public.etat_des_lieux_observations
  FOR SELECT USING (public.is_admin());

CREATE POLICY "etat_des_lieux_observations_insert_parties" ON public.etat_des_lieux_observations
  FOR INSERT WITH CHECK (
    auteur_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.etat_des_lieux_pieces p
      JOIN public.etat_des_lieux e ON e.id = p.etat_des_lieux_id
      JOIN public.leases l ON l.id = e.lease_id
      WHERE p.id = etat_des_lieux_observations.piece_id
        AND (l.landlord_id = auth.uid() OR l.tenant_id = auth.uid())
    )
  );
-- Pas de policy UPDATE/DELETE : append-only.

-- ============================================================================
-- D.2 — Storage RLS etat-des-lieux
-- ============================================================================
-- Chemin : ${leaseId}/${pieceId}/${timestamp}-${random}.${ext} — premier
-- segment = lease_id, même convention que lease-requests. La policy storage
-- ne vérifie que l'appartenance au bail ; la règle fine (quel rôle peut
-- uploader à quel statut) est appliquée à l'insertion de la ligne de
-- métadonnées etat_des_lieux_photos (même compromis déjà accepté pour
-- lease-requests : un objet orphelin en storage sans ligne de métadonnées
-- n'est pas plus grave qu'ailleurs dans le code).
CREATE POLICY "etat_des_lieux_bucket_select_parties" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'etat-des-lieux'
    AND EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id::text = (storage.foldername(name))[1]
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  );

CREATE POLICY "etat_des_lieux_bucket_select_admin" ON storage.objects
  FOR SELECT USING (bucket_id = 'etat-des-lieux' AND public.is_admin());

CREATE POLICY "etat_des_lieux_bucket_insert_parties" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'etat-des-lieux'
    AND EXISTS (
      SELECT 1 FROM public.leases
      WHERE leases.id::text = (storage.foldername(name))[1]
        AND (leases.landlord_id = auth.uid() OR leases.tenant_id = auth.uid())
    )
  );
-- Pas de policy UPDATE/DELETE : photos non écrasables/supprimables (upload
-- côté client avec upsert: false en plus, comme lease-requests).

-- ============================================================================
-- E — Notifications
-- ============================================================================
-- Types ajoutés : etat_des_lieux_submitted (→ locataire), etat_des_lieux_validated
-- (→ bailleur), etat_des_lieux_disputed (→ bailleur), etat_des_lieux_sortie_available
-- (→ les deux, voir extension de leases_after_update_notify plus bas).
CREATE OR REPLACE FUNCTION public.etat_des_lieux_after_update_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_landlord_id uuid;
  v_tenant_id uuid;
  v_listing_id uuid;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT landlord_id, tenant_id, listing_id INTO v_landlord_id, v_tenant_id, v_listing_id
    FROM public.leases WHERE id = NEW.lease_id;

    IF NEW.status = 'soumis' THEN
      PERFORM public.notifications_create(v_tenant_id, NEW.submitted_by, 'etat_des_lieux_submitted',
        'État des lieux à valider', NULL, '/my-lease/' || NEW.lease_id || '/inspections/' || NEW.type,
        NEW.lease_id, NULL, NULL, v_listing_id);
    ELSIF NEW.status = 'valide' THEN
      PERFORM public.notifications_create(v_landlord_id, NEW.validated_by, 'etat_des_lieux_validated',
        'État des lieux validé', NULL, '/my-leases/' || NEW.lease_id || '/inspections/' || NEW.type,
        NEW.lease_id, NULL, NULL, v_listing_id);
    ELSIF NEW.status = 'conteste' THEN
      PERFORM public.notifications_create(v_landlord_id, NEW.disputed_by, 'etat_des_lieux_disputed',
        'État des lieux contesté', NEW.dispute_reason, '/my-leases/' || NEW.lease_id || '/inspections/' || NEW.type,
        NEW.lease_id, NULL, NULL, v_listing_id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER etat_des_lieux_after_update_notify_trigger
  AFTER UPDATE ON public.etat_des_lieux
  FOR EACH ROW EXECUTE FUNCTION public.etat_des_lieux_after_update_notify();

-- Extension de leases_after_update_notify (définie dans
-- 20260712180000_notifications.sql) : reprend le corps existant à
-- l'identique et ajoute la notification de disponibilité de la sortie.
CREATE OR REPLACE FUNCTION public.leases_after_update_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.tenant_id IS NULL AND NEW.tenant_id IS NOT NULL AND NEW.status = 'en_attente_confirmation' THEN
    PERFORM public.notifications_create(NEW.tenant_id, NEW.landlord_id, 'lease_created',
      'Un bail vous a été créé', 'Confirmez ou refusez ce bail.',
      '/my-lease/' || NEW.id, NEW.id, NULL, NULL, NEW.listing_id);
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.status = 'en_attente_confirmation' AND NEW.status = 'actif' THEN
      PERFORM public.notifications_create(NEW.landlord_id, NEW.tenant_id, 'lease_confirmed',
        'Votre locataire a confirmé le bail', NULL, '/my-leases/' || NEW.id, NEW.id, NULL, NULL, NEW.listing_id);
    ELSIF OLD.status = 'en_attente_confirmation' AND NEW.status = 'rejete' THEN
      PERFORM public.notifications_create(NEW.landlord_id, NEW.tenant_id, 'lease_rejected',
        'Votre locataire a refusé le bail', NULL, '/my-leases/' || NEW.id, NEW.id, NULL, NULL, NEW.listing_id);
    ELSIF OLD.status = 'actif' AND NEW.status = 'resilie' THEN
      PERFORM public.notifications_create(NEW.landlord_id, NEW.tenant_id, 'lease_resiliated',
        'Votre locataire a résilié le bail', NEW.end_reason, '/my-leases/' || NEW.id, NEW.id, NULL, NULL, NEW.listing_id);
    ELSIF OLD.status = 'actif' AND NEW.status IN ('termine', 'arrete') THEN
      PERFORM public.notifications_create(NEW.tenant_id, NEW.landlord_id, 'lease_ended',
        'Votre bailleur a mis fin au bail', NEW.end_reason, '/my-lease/' || NEW.id, NEW.id, NULL, NULL, NEW.listing_id);
    END IF;

    -- Ajout chantier état des lieux : la sortie devient disponible dès que
    -- le bail atteint un statut de fin, si elle n'existe pas déjà (le
    -- déclenchement anticipé "à 30 jours de la fin" reste géré côté UI,
    -- sans notification poussée pour cette v1).
    IF NEW.status IN ('termine', 'resilie', 'arrete')
       AND NOT EXISTS (
         SELECT 1 FROM public.etat_des_lieux WHERE lease_id = NEW.id AND type = 'sortie'
       ) THEN
      PERFORM public.notifications_create(NEW.landlord_id, NULL, 'etat_des_lieux_sortie_available',
        'État des lieux de sortie disponible', NULL, '/my-leases/' || NEW.id || '/inspections/sortie',
        NEW.id, NULL, NULL, NEW.listing_id);
      PERFORM public.notifications_create(NEW.tenant_id, NULL, 'etat_des_lieux_sortie_available',
        'État des lieux de sortie disponible', NULL, '/my-lease/' || NEW.id || '/inspections/sortie',
        NEW.id, NULL, NULL, NEW.listing_id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP TRIGGER IF EXISTS etat_des_lieux_after_update_notify_trigger ON public.etat_des_lieux;
-- DROP FUNCTION IF EXISTS public.etat_des_lieux_after_update_notify();
-- DROP TRIGGER IF EXISTS etat_des_lieux_observations_before_insert_trigger ON public.etat_des_lieux_observations;
-- DROP FUNCTION IF EXISTS public.etat_des_lieux_observations_before_insert();
-- DROP TRIGGER IF EXISTS etat_des_lieux_photos_before_insert_trigger ON public.etat_des_lieux_photos;
-- DROP FUNCTION IF EXISTS public.etat_des_lieux_photos_before_insert();
-- DROP TRIGGER IF EXISTS etat_des_lieux_pieces_guard_trigger ON public.etat_des_lieux_pieces;
-- DROP FUNCTION IF EXISTS public.etat_des_lieux_pieces_guard();
-- DROP TRIGGER IF EXISTS etat_des_lieux_guard_trigger ON public.etat_des_lieux;
-- DROP FUNCTION IF EXISTS public.etat_des_lieux_guard();
-- DROP POLICY IF EXISTS "etat_des_lieux_bucket_insert_parties" ON storage.objects;
-- DROP POLICY IF EXISTS "etat_des_lieux_bucket_select_admin" ON storage.objects;
-- DROP POLICY IF EXISTS "etat_des_lieux_bucket_select_parties" ON storage.objects;
-- DROP TABLE IF EXISTS public.etat_des_lieux_observations;
-- DROP TABLE IF EXISTS public.etat_des_lieux_photos;
-- DROP TABLE IF EXISTS public.etat_des_lieux_pieces;
-- DROP TABLE IF EXISTS public.etat_des_lieux;
-- DELETE FROM storage.buckets WHERE id = 'etat-des-lieux';
-- Remettre leases_after_update_notify à sa version d'origine (voir
-- 20260712180000_notifications.sql) si ce chantier est complètement retiré.
