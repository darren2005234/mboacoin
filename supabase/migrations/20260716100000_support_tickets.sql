-- Chantier EF-SUP — Support client
--
-- Deux portes : un utilisateur connecté (identité automatiquement rattachée)
-- et un visiteur non connecté (email/téléphone de contact obligatoires,
-- suivi par jeton). Schéma calqué sur lease_requests (BAIL-4), avec une
-- différence structurelle centrale : lease_requests a toujours DEUX parties
-- identifiées (bailleur/locataire) ; ici, une des deux parties peut n'avoir
-- AUCUNE identité côté base. Toute la conception RLS en découle.
--
-- Décision clé : AUCUNE policy INSERT sur support_tickets. Avec RLS activée
-- et zéro policy pour une commande, Postgres refuse cette commande à tout
-- rôle standard — seule une fonction SECURITY DEFINER (create_support_ticket
-- ci-dessous) peut écrire. Raison : un INSERT ... RETURNING est filtré par
-- les policies SELECT de la table ; si `anon` n'a AUCUNE policy SELECT (et
-- il n'en aura aucune — sinon un visiteur pourrait lister les tickets de
-- tout le monde), un insert anonyme direct renverrait un RETURNING vide
-- malgré un insert réussi, empêchant de renvoyer follow_up_token à son
-- créateur. Une fonction SECURITY DEFINER n'a pas ce problème : elle renvoie
-- une valeur calculée, jamais une lecture filtrée par RLS (même raison que
-- declare_payment_batch RETURNS uuid plutôt qu'un SELECT après insert).

-- ============================================================================
-- A.1 — Bucket privé support-tickets (captures d'écran)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-tickets', 'support-tickets', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- A.2 — Tables
-- ============================================================================
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id),                     -- null = visiteur
  contact_email text,
  contact_phone text,
  category text NOT NULL CHECK (category IN ('verification', 'paiement', 'litige', 'arnaque', 'compte', 'autre')),
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'nouveau' CHECK (status IN ('nouveau', 'en_cours', 'resolu', 'ferme')),
  -- Capacité de suivi visiteur, jamais dérivée d'un id séquentiel — même
  -- garantie que lease_payments.verification_token (UUID v4, 122 bits).
  -- Générée pour toutes les lignes, connectées ou non : uniformise le
  -- chemin de stockage des pièces jointes (A.6) et rend le jeton inoffensif
  -- à afficher à son propriétaire (même raisonnement que verification_token).
  follow_up_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  -- Best-effort, jamais bloquant (voir A.3) : reste NULL si l'en-tête n'est
  -- pas disponible, ce qui désactive silencieusement le seul garde-fou qui
  -- en dépend, sans jamais empêcher une soumission légitime.
  origin_ip inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_tickets_contact_required_if_anonymous
    CHECK (user_id IS NOT NULL OR contact_email IS NOT NULL OR contact_phone IS NOT NULL)
);

CREATE INDEX support_tickets_user_id_idx ON public.support_tickets(user_id);
CREATE INDEX support_tickets_status_idx ON public.support_tickets(status);
CREATE INDEX support_tickets_origin_ip_idx ON public.support_tickets(origin_ip);

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id),   -- null = visiteur, ou expéditeur anonyme
  -- Dérivé serveur (voir triggers), jamais fourni par le client : sinon
  -- n'importe quel utilisateur pourrait se faire passer pour l'équipe dans
  -- son propre fil.
  is_admin boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_messages_ticket_id_idx ON public.support_messages(ticket_id);

CREATE TABLE public.support_ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.support_messages(id),
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES public.profiles(id),  -- null = visiteur
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX support_ticket_attachments_ticket_id_idx ON public.support_ticket_attachments(ticket_id);

-- ============================================================================
-- A.3 — create_support_ticket() : SEUL chemin de création, pour tout le
-- monde (connecté ou non). Un seul appel côté client, pas de branche
-- dupliquée. Anti-abus à trois niveaux (voir le corps) :
--   - IP (best-effort, cf. ci-dessus) : 20 / heure. Seuil volontairement
--     large — beaucoup d'utilisateurs au Cameroun partagent une même IP
--     (connexion mobile partagée, cybercafé, réseau d'entreprise) ; un
--     seuil serré bloquerait des personnes réellement distinctes. Ce garde-
--     fou est un filet contre le bourrinage grossier, pas la limite fine.
--   - Contact (visiteurs uniquement) : 5 / jour, email OU téléphone. C'est
--     la limite qui compte réellement : rattachée à quelque chose qu'un
--     visiteur ne peut pas faire varier à volonté sans perdre le bénéfice
--     du suivi (il doit garder CE contact pour recevoir une réponse).
--   - Compte (connectés) : 5 / heure.
-- Aucun de ces seuils n'a de table de compteurs dédiée : tout se compte
-- directement sur support_tickets (origin_ip, contact_email/phone,
-- user_id, created_at) — pas de nouvelle table à maintenir en plus.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_support_ticket(
  p_category text,
  p_subject text,
  p_description text,
  p_contact_email text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL
) RETURNS TABLE(id uuid, follow_up_token uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_ip inet;
  v_id uuid;
  v_token uuid;
BEGIN
  IF v_user_id IS NULL AND p_contact_email IS NULL AND p_contact_phone IS NULL THEN
    RAISE EXCEPTION 'un moyen de contact est requis';
  END IF;
  IF p_category NOT IN ('verification', 'paiement', 'litige', 'arnaque', 'compte', 'autre') THEN
    RAISE EXCEPTION 'catégorie invalide';
  END IF;
  IF coalesce(trim(p_subject), '') = '' OR coalesce(trim(p_description), '') = '' THEN
    RAISE EXCEPTION 'sujet et description requis';
  END IF;

  -- Extraction de l'IP strictement best-effort : toute erreur de parsing
  -- (en-tête absent, JSON invalide, format inattendu) est absorbée ici et
  -- ne doit JAMAIS remonter — le pire scénario n'est pas quelques spams,
  -- c'est un utilisateur en détresse bloqué par un garde-fou qui a mal
  -- fonctionné.
  BEGIN
    v_ip := nullif(
      split_part(
        nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for',
        ',', 1
      ), ''
    )::inet;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  IF v_ip IS NOT NULL AND (
    SELECT count(*) FROM support_tickets
    WHERE origin_ip = v_ip AND created_at > now() - interval '1 hour'
  ) >= 20 THEN
    RAISE EXCEPTION 'Trop de demandes envoyées récemment depuis cette connexion. Réessayez plus tard.';
  END IF;

  IF v_user_id IS NULL AND (
    SELECT count(*) FROM support_tickets
    WHERE (contact_email = p_contact_email OR contact_phone = p_contact_phone)
      AND created_at > now() - interval '1 day'
  ) >= 5 THEN
    RAISE EXCEPTION 'Trop de demandes envoyées récemment avec ce contact. Réessayez plus tard.';
  END IF;

  IF v_user_id IS NOT NULL AND (
    SELECT count(*) FROM support_tickets
    WHERE user_id = v_user_id AND created_at > now() - interval '1 hour'
  ) >= 5 THEN
    RAISE EXCEPTION 'Trop de demandes envoyées récemment.';
  END IF;

  INSERT INTO support_tickets (user_id, contact_email, contact_phone, category, subject, description, origin_ip)
  VALUES (v_user_id, p_contact_email, p_contact_phone, p_category, trim(p_subject), trim(p_description), v_ip)
  RETURNING support_tickets.id, support_tickets.follow_up_token INTO v_id, v_token;

  RETURN QUERY SELECT v_id, v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.create_support_ticket(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(text, text, text, text, text) TO anon, authenticated;

-- ============================================================================
-- A.4 — Lecture/réponse par jeton (visiteur). Même philosophie que
-- get_public_receipt : liste blanche explicite de colonnes, jamais
-- contact_email/contact_phone/origin_ip ni user_id en retour.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_support_ticket_by_token(p_token uuid)
RETURNS TABLE(
  id uuid,
  category text,
  subject text,
  description text,
  status text,
  created_at timestamptz,
  status_changed_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT st.id, st.category, st.subject, st.description, st.status, st.created_at, st.status_changed_at
  FROM public.support_tickets st
  WHERE st.follow_up_token = p_token;
$$;

CREATE OR REPLACE FUNCTION public.get_support_ticket_messages_by_token(p_token uuid)
RETURNS TABLE(id uuid, is_admin boolean, body text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sm.id, sm.is_admin, sm.body, sm.created_at
  FROM public.support_messages sm
  JOIN public.support_tickets st ON st.id = sm.ticket_id
  WHERE st.follow_up_token = p_token
  ORDER BY sm.created_at ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_support_ticket_attachments_by_token(p_token uuid)
RETURNS TABLE(id uuid, message_id uuid, storage_path text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sta.id, sta.message_id, sta.storage_path
  FROM public.support_ticket_attachments sta
  JOIN public.support_tickets st ON st.id = sta.ticket_id
  WHERE st.follow_up_token = p_token;
$$;

CREATE OR REPLACE FUNCTION public.add_support_ticket_message_by_token(p_token uuid, p_body text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id uuid;
BEGIN
  IF coalesce(trim(p_body), '') = '' THEN
    RAISE EXCEPTION 'message vide';
  END IF;

  SELECT id INTO v_ticket_id FROM support_tickets WHERE follow_up_token = p_token;
  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'lien de suivi invalide';
  END IF;

  -- sender_id/is_admin ne sont pas passés ici : support_messages_before_insert
  -- les dérive systématiquement de auth.uid()/is_admin() à l'insertion, quel
  -- que soit le chemin d'écriture (direct ou via cette fonction) — les fixer
  -- ici serait sans effet et donnerait l'impression trompeuse que cette
  -- fonction en a le contrôle.
  INSERT INTO support_messages (ticket_id, body)
  VALUES (v_ticket_id, trim(p_body));
END;
$$;

CREATE OR REPLACE FUNCTION public.add_support_ticket_attachment_by_token(
  p_token uuid, p_storage_path text, p_message_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id uuid;
BEGIN
  SELECT id INTO v_ticket_id FROM support_tickets WHERE follow_up_token = p_token;
  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'lien de suivi invalide';
  END IF;
  IF p_message_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM support_messages WHERE id = p_message_id AND ticket_id = v_ticket_id
  ) THEN
    RAISE EXCEPTION 'message introuvable';
  END IF;

  -- uploaded_by n'est pas passé ici : support_ticket_attachments_before_insert
  -- le dérive systématiquement de auth.uid() (même remarque que ci-dessus
  -- pour sender_id/is_admin sur support_messages). ticket_id est fourni
  -- directement (pas déduit de message_id) : cette fonction sert aussi à
  -- attacher un fichier à la description initiale (message_id NULL), cas où
  -- le trigger n'aurait rien à déduire.
  INSERT INTO support_ticket_attachments (ticket_id, message_id, storage_path)
  VALUES (v_ticket_id, p_message_id, p_storage_path);
END;
$$;

REVOKE ALL ON FUNCTION public.get_support_ticket_by_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_support_ticket_messages_by_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_support_ticket_attachments_by_token(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_support_ticket_message_by_token(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_support_ticket_attachment_by_token(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_support_ticket_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_support_ticket_messages_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_support_ticket_attachments_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_support_ticket_message_by_token(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_support_ticket_attachment_by_token(uuid, text, uuid) TO anon, authenticated;

-- ============================================================================
-- A.5 — Triggers (chemin connecté/admin)
-- ============================================================================
-- Dérive sender_id/is_admin ; jamais fournis par le client. Pas SECURITY
-- DEFINER : l'appelant (locataire propriétaire du ticket, ou admin) a déjà
-- accès en lecture à ce dont ce trigger a besoin via les policies normales.
CREATE OR REPLACE FUNCTION public.support_messages_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.sender_id := auth.uid();
  NEW.is_admin := public.is_admin();
  RETURN NEW;
END;
$$;

CREATE TRIGGER support_messages_before_insert_trigger
  BEFORE INSERT ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.support_messages_before_insert();

-- Un message non-admin sur un ticket résolu/fermé le rouvre automatiquement
-- (l'utilisateur ou le visiteur "rouvre" juste en écrivant, pas de bouton
-- dédié) ; un message admin ne change jamais le statut de lui-même (l'admin
-- pilote le statut explicitement). SECURITY DEFINER : nécessaire, l'auteur
-- du message (locataire, ou visiteur via add_support_ticket_message_by_token
-- qui appelle cet insert sous son propre contexte SECURITY DEFINER) n'a pas
-- de droit UPDATE sur support_tickets (réservé à l'admin, cf. A.7).
CREATE OR REPLACE FUNCTION public.support_messages_after_insert_reopen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT NEW.is_admin THEN
    UPDATE public.support_tickets
    SET status = 'en_cours', status_changed_at = now()
    WHERE id = NEW.ticket_id AND status IN ('resolu', 'ferme');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER support_messages_after_insert_reopen_trigger
  AFTER INSERT ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.support_messages_after_insert_reopen();

-- Notifie l'utilisateur connecté quand l'équipe répond (no-op silencieux si
-- ticket.user_id est null, via la garde déjà présente dans
-- notifications_create — rien à dupliquer ici). Aucune notification pour un
-- visiteur : il n'y a pas de canal in-app à notifier, c'est tout l'objet du
-- jeton de suivi.
CREATE OR REPLACE FUNCTION public.support_messages_after_insert_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NEW.is_admin THEN
    SELECT user_id INTO v_user_id FROM public.support_tickets WHERE id = NEW.ticket_id;
    PERFORM public.notifications_create(v_user_id, NULL, 'support_reply',
      'MboaCoin a répondu à votre demande', NULL, '/support/' || NEW.ticket_id, NULL, NULL, NULL, NULL);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER support_messages_after_insert_notify_trigger
  AFTER INSERT ON public.support_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.support_messages_after_insert_notify();

-- Dérive uploaded_by, et ticket_id depuis le message si message_id est
-- fourni (même pattern que lease_request_attachments_before_insert).
CREATE OR REPLACE FUNCTION public.support_ticket_attachments_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_ticket_id uuid;
BEGIN
  NEW.uploaded_by := auth.uid();
  IF NEW.message_id IS NOT NULL THEN
    SELECT ticket_id INTO v_ticket_id FROM public.support_messages WHERE id = NEW.message_id;
    IF v_ticket_id IS NULL THEN
      RAISE EXCEPTION 'message introuvable';
    END IF;
    NEW.ticket_id := v_ticket_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER support_ticket_attachments_before_insert_trigger
  BEFORE INSERT ON public.support_ticket_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.support_ticket_attachments_before_insert();

-- ============================================================================
-- A.6 — Bornage des UPDATE sur support_tickets : admin uniquement, tout
-- reste figé sauf status (+ status_changed_at dérivé). Pas de machine à
-- états fine comme lease_requests_guard (bailleur/locataire s'auto-limitent
-- l'un l'autre) : ici seul un rôle de confiance (admin) peut écrire, aucune
-- raison de lui interdire une transition de statut particulière.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.support_tickets_before_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.user_id := OLD.user_id;
  NEW.contact_email := OLD.contact_email;
  NEW.contact_phone := OLD.contact_phone;
  NEW.category := OLD.category;
  NEW.subject := OLD.subject;
  NEW.description := OLD.description;
  NEW.follow_up_token := OLD.follow_up_token;
  NEW.origin_ip := OLD.origin_ip;
  NEW.created_at := OLD.created_at;

  IF NEW.status <> OLD.status THEN
    NEW.status_changed_at := now();
  ELSE
    NEW.status_changed_at := OLD.status_changed_at;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER support_tickets_before_update_trigger
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.support_tickets_before_update();

-- ============================================================================
-- A.7 — RLS
-- ============================================================================
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Pas de policy INSERT sur support_tickets : voir le commentaire d'en-tête.
CREATE POLICY "support_tickets_select_own" ON public.support_tickets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "support_tickets_select_admin" ON public.support_tickets
  FOR SELECT USING (public.is_admin());

CREATE POLICY "support_tickets_update_admin" ON public.support_tickets
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "support_messages_select_owner" ON public.support_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.support_tickets WHERE id = support_messages.ticket_id AND user_id = auth.uid())
  );

CREATE POLICY "support_messages_select_admin" ON public.support_messages
  FOR SELECT USING (public.is_admin());

CREATE POLICY "support_messages_insert_owner_or_admin" ON public.support_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.is_admin()
      OR EXISTS (SELECT 1 FROM public.support_tickets WHERE id = support_messages.ticket_id AND user_id = auth.uid())
    )
  );

CREATE POLICY "support_ticket_attachments_select_owner" ON public.support_ticket_attachments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.support_tickets WHERE id = support_ticket_attachments.ticket_id AND user_id = auth.uid())
  );

CREATE POLICY "support_ticket_attachments_select_admin" ON public.support_ticket_attachments
  FOR SELECT USING (public.is_admin());

CREATE POLICY "support_ticket_attachments_insert_owner_or_admin" ON public.support_ticket_attachments
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      public.is_admin()
      OR EXISTS (SELECT 1 FROM public.support_tickets WHERE id = support_ticket_attachments.ticket_id AND user_id = auth.uid())
    )
  );

-- Pas de policy UPDATE/DELETE sur support_messages ni
-- support_ticket_attachments : immuables une fois créés, comme
-- lease_request_messages/lease_request_attachments.

-- ============================================================================
-- A.8 — Storage RLS support-tickets. Chemin de stockage :
-- ${followUpToken}/... — PAS ${ticketId}/... C'est le point qui débloque le
-- cas visiteur : lease-requests utilise l'id du bail comme préfixe parce que
-- les deux parties ont une identité stable (landlord_id/tenant_id) pour la
-- policy ; un visiteur n'a AUCUNE identité, seul son jeton en fait foi. Une
-- seule paire de policies, valable pour tout le monde (connecté, admin,
-- visiteur) : le jeton est la seule clé, comme pour les lectures/réponses.
-- Sûr pour la même raison qu'un jeton l'est ailleurs dans ce projet : le
-- préfixe doit correspondre à un jeton réel existant, et un jeton n'est pas
-- énumérable (122 bits, jamais listé nulle part — storage.objects.list()
-- est lui-même filtré par cette policy, donc pas de découverte possible
-- sans déjà connaître un jeton).
-- ============================================================================
CREATE POLICY "support_tickets_bucket_select_token" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'support-tickets'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE follow_up_token::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "support_tickets_bucket_insert_token" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'support-tickets'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE follow_up_token::text = (storage.foldername(name))[1]
    )
  );

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP POLICY IF EXISTS "support_tickets_bucket_insert_token" ON storage.objects;
-- DROP POLICY IF EXISTS "support_tickets_bucket_select_token" ON storage.objects;
-- DROP TABLE IF EXISTS public.support_ticket_attachments;
-- DROP TABLE IF EXISTS public.support_messages;
-- DROP TABLE IF EXISTS public.support_tickets;
-- DROP FUNCTION IF EXISTS public.support_ticket_attachments_before_insert();
-- DROP FUNCTION IF EXISTS public.support_tickets_before_update();
-- DROP FUNCTION IF EXISTS public.support_messages_after_insert_notify();
-- DROP FUNCTION IF EXISTS public.support_messages_after_insert_reopen();
-- DROP FUNCTION IF EXISTS public.support_messages_before_insert();
-- DROP FUNCTION IF EXISTS public.add_support_ticket_attachment_by_token(uuid, text, uuid);
-- DROP FUNCTION IF EXISTS public.add_support_ticket_message_by_token(uuid, text);
-- DROP FUNCTION IF EXISTS public.get_support_ticket_attachments_by_token(uuid);
-- DROP FUNCTION IF EXISTS public.get_support_ticket_messages_by_token(uuid);
-- DROP FUNCTION IF EXISTS public.get_support_ticket_by_token(uuid);
-- DROP FUNCTION IF EXISTS public.create_support_ticket(text, text, text, text, text);
-- DELETE FROM storage.buckets WHERE id = 'support-tickets';
