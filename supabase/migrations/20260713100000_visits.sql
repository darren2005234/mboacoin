-- Sous-chantier TRANS-1a — parcours de demande de visite (sans paiement).
--
-- PRÉ-VOL (lecture seule, à exécuter avant cette migration) : confirme que
-- profiles.verification, profiles.id et conversations(listing_id, tenant_id,
-- owner_id) existent bien tels qu'assumés ci-dessous (colonnes non
-- versionnées, prédent depuis les chantiers notifications / messagerie) :
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'profiles' AND column_name IN ('verification');
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'conversations' AND column_name IN ('listing_id', 'tenant_id', 'owner_id');

-- ============================================================================
-- A — Frais de visite sur l'annonce, réservés aux comptes vérifiés
-- ============================================================================
ALTER TABLE public.listings
  ADD COLUMN visit_fee_amount numeric NOT NULL DEFAULT 0
  CHECK (visit_fee_amount >= 0 AND visit_fee_amount <= 10000);

-- Même prédicat que listings_insert_requires_verification, réutilisé ici et
-- appelé à devenir LE prédicat standard pour "recevoir de l'argent exige un
-- compte vérifié" dans les prochains chantiers transactionnels (paiement de
-- loyer, séquestre de visite...).
CREATE POLICY "listings_visit_fee_requires_verification_ins" ON public.listings
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (
    visit_fee_amount = 0 OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.verification = 'verifie'
    )
  );

CREATE POLICY "listings_visit_fee_requires_verification_upd" ON public.listings
  AS RESTRICTIVE FOR UPDATE
  WITH CHECK (
    visit_fee_amount = 0 OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.verification = 'verifie'
    )
  );

-- ============================================================================
-- B — Tables visits / visit_slots
-- ============================================================================
CREATE TABLE public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id),
  tenant_id uuid NOT NULL REFERENCES public.profiles(id),
  landlord_id uuid NOT NULL REFERENCES public.profiles(id),
  conversation_id uuid REFERENCES public.conversations(id),
  fee_amount numeric NOT NULL DEFAULT 0,
  -- Code de preuve de présence : imprévisible (pas une séquence, contrairement
  -- à lease_payments.receipt_number qui n'est qu'une référence).
  confirmation_code text NOT NULL UNIQUE
    DEFAULT lpad(floor(random() * 1000000)::text, 6, '0'),
  code_attempts integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'demandee' CHECK (status IN (
    'demandee', 'creneau_propose', 'confirmee', 'effectuee',
    'annulee', 'refusee', 'expiree'
  )),
  scheduled_at timestamptz,
  no_show boolean NOT NULL DEFAULT false,
  reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

CREATE TABLE public.visit_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  proposed_by uuid NOT NULL REFERENCES public.profiles(id),
  slot_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX visits_tenant_idx ON public.visits(tenant_id);
CREATE INDEX visits_landlord_idx ON public.visits(landlord_id);
CREATE INDEX visits_status_scheduled_idx ON public.visits(status, scheduled_at);
CREATE INDEX visit_slots_visit_idx ON public.visit_slots(visit_id);

-- ============================================================================
-- C — Protection du code de confirmation au niveau colonne
-- ============================================================================
-- RLS filtre des lignes, pas des colonnes : si le bailleur peut lire la ligne
-- (nécessaire pour le reste), une policy ne peut pas lui cacher spécifiquement
-- confirmation_code. On retire donc le privilège SELECT sur la colonne elle-
-- même ; seule get_visit_code() (SECURITY DEFINER, ci-dessous) peut la lire,
-- après avoir vérifié que l'appelant est bien le locataire de cette visite.
REVOKE SELECT (confirmation_code) ON public.visits FROM authenticated, anon;

-- ============================================================================
-- D — RLS
-- ============================================================================
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visits_select_parties" ON public.visits
  FOR SELECT USING (tenant_id = auth.uid() OR landlord_id = auth.uid());
CREATE POLICY "visits_select_admin" ON public.visits
  FOR SELECT USING (public.is_admin());

-- Pas de policy INSERT : création uniquement via request_visit() (SECURITY
-- DEFINER), même logique que notifications_create — landlord_id/fee_amount/
-- confirmation_code ne doivent jamais être fournis par le client.
CREATE POLICY "visits_update_parties" ON public.visits
  FOR UPDATE USING (tenant_id = auth.uid() OR landlord_id = auth.uid())
  WITH CHECK (
    (tenant_id = auth.uid() OR landlord_id = auth.uid())
    AND status <> 'effectuee' -- verrou : "effectuee" est inatteignable par un UPDATE normal
  );

ALTER TABLE public.visit_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visit_slots_select_parties" ON public.visit_slots
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.visits v WHERE v.id = visit_slots.visit_id
      AND (v.tenant_id = auth.uid() OR v.landlord_id = auth.uid())
  ));
CREATE POLICY "visit_slots_select_admin" ON public.visit_slots
  FOR SELECT USING (public.is_admin());

-- Seule la contre-proposition du bailleur passe par une INSERT client directe ;
-- les créneaux initiaux du locataire sont insérés par request_visit()
-- (SECURITY DEFINER), pas besoin de policy INSERT locataire.
CREATE POLICY "visit_slots_insert_landlord_counter" ON public.visit_slots
  FOR INSERT WITH CHECK (
    proposed_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.visits v WHERE v.id = visit_slots.visit_id
        AND v.landlord_id = auth.uid() AND v.status = 'demandee'
    )
  );

-- ============================================================================
-- E — Création d'une demande de visite
-- ============================================================================
CREATE OR REPLACE FUNCTION public.request_visit(
  p_listing_id uuid, p_slots timestamptz[]
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner_id uuid; v_fee numeric; v_conversation_id uuid; v_visit_id uuid; v_slot timestamptz;
BEGIN
  IF array_length(p_slots, 1) IS NULL OR array_length(p_slots, 1) NOT BETWEEN 2 AND 3 THEN
    RAISE EXCEPTION 'Proposez 2 ou 3 créneaux.';
  END IF;

  SELECT owner_id, visit_fee_amount INTO v_owner_id, v_fee
  FROM public.listings WHERE id = p_listing_id AND status = 'publiee';

  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'Logement introuvable ou non publié.'; END IF;
  IF v_owner_id = auth.uid() THEN RAISE EXCEPTION 'Vous ne pouvez pas visiter votre propre annonce.'; END IF;

  -- Même logique de find-or-create que openConversation() côté client
  -- (lib/conversations.ts) : on ne fait jamais confiance à un conversation_id
  -- fourni par l'appelant, on le dérive nous-mêmes (listing_id, tenant_id).
  SELECT id INTO v_conversation_id FROM public.conversations
  WHERE listing_id = p_listing_id AND tenant_id = auth.uid();

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (listing_id, tenant_id, owner_id)
    VALUES (p_listing_id, auth.uid(), v_owner_id)
    RETURNING id INTO v_conversation_id;
  END IF;

  INSERT INTO public.visits (listing_id, tenant_id, landlord_id, conversation_id, fee_amount)
  VALUES (p_listing_id, auth.uid(), v_owner_id, v_conversation_id, v_fee)
  RETURNING id INTO v_visit_id;

  FOREACH v_slot IN ARRAY p_slots LOOP
    INSERT INTO public.visit_slots (visit_id, proposed_by, slot_at) VALUES (v_visit_id, auth.uid(), v_slot);
  END LOOP;

  RETURN v_visit_id;
END; $$;

-- ============================================================================
-- F — Machine à états
-- ============================================================================
CREATE OR REPLACE FUNCTION public.visits_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'demandee' AND NEW.status = 'confirmee' AND auth.uid() = OLD.landlord_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.visit_slots
      WHERE visit_id = NEW.id AND slot_at = NEW.scheduled_at AND proposed_by = OLD.tenant_id
    ) THEN
      RAISE EXCEPTION 'Créneau invalide.';
    END IF;

  ELSIF OLD.status = 'demandee' AND NEW.status = 'creneau_propose' AND auth.uid() = OLD.landlord_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.visit_slots WHERE visit_id = NEW.id AND proposed_by = OLD.landlord_id) THEN
      RAISE EXCEPTION 'Proposez au moins un créneau.';
    END IF;

  ELSIF OLD.status = 'creneau_propose' AND NEW.status = 'confirmee' AND auth.uid() = OLD.tenant_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.visit_slots
      WHERE visit_id = NEW.id AND slot_at = NEW.scheduled_at AND proposed_by = OLD.landlord_id
    ) THEN
      RAISE EXCEPTION 'Créneau invalide.';
    END IF;

  ELSIF OLD.status IN ('demandee', 'creneau_propose') AND NEW.status = 'refusee' AND auth.uid() = OLD.landlord_id THEN
    NULL;

  ELSIF OLD.status IN ('demandee', 'creneau_propose') AND NEW.status = 'annulee' AND auth.uid() = OLD.tenant_id THEN
    NEW.cancelled_at := now();

  ELSIF OLD.status = 'confirmee' AND NEW.status = 'annulee' AND auth.uid() = OLD.tenant_id THEN
    IF OLD.scheduled_at - now() <= interval '3 hours' THEN
      RAISE EXCEPTION 'Annulation impossible à moins de 3h du créneau.';
    END IF;
    NEW.cancelled_at := now();

  ELSIF OLD.status = 'confirmee' AND NEW.status = 'effectuee' THEN
    NULL; -- le code a déjà été vérifié par confirm_visit_with_code() avant cet UPDATE

  ELSIF OLD.status = 'confirmee' AND NEW.status = 'expiree' THEN
    NULL; -- déclenché par le job planifié (service_role), jamais par un utilisateur

  ELSIF OLD.status = 'confirmee' AND NEW.no_show IS DISTINCT FROM OLD.no_show AND auth.uid() = OLD.landlord_id THEN
    IF OLD.scheduled_at > now() THEN RAISE EXCEPTION 'Le créneau n''est pas encore passé.'; END IF;

  ELSE
    RAISE EXCEPTION 'Transition non autorisée (% -> %).', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER visits_guard_trigger BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.visits_guard();

-- ============================================================================
-- G — Code de confirmation : lecture (locataire) et vérification (bailleur)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_visit_code(p_visit_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text;
BEGIN
  SELECT confirmation_code INTO v_code FROM public.visits
  WHERE id = p_visit_id AND tenant_id = auth.uid();
  RETURN v_code; -- NULL si l'appelant n'est pas le locataire de cette visite
END; $$;

CREATE OR REPLACE FUNCTION public.confirm_visit_with_code(p_visit_id uuid, p_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_match boolean;
BEGIN
  SELECT (confirmation_code = trim(p_code)) INTO v_match
  FROM public.visits WHERE id = p_visit_id AND landlord_id = auth.uid() AND status = 'confirmee';

  IF v_match IS NULL THEN RAISE EXCEPTION 'Visite introuvable.'; END IF;

  IF v_match THEN
    UPDATE public.visits SET status = 'effectuee', completed_at = now() WHERE id = p_visit_id;
  ELSE
    UPDATE public.visits SET code_attempts = code_attempts + 1 WHERE id = p_visit_id;
  END IF;
  RETURN v_match;
END; $$;

-- ============================================================================
-- H — Notifications (in-app ; le push suit automatiquement via le Database
-- Webhook du chantier NOTIFICATIONS-2, une fois les types ajoutés à
-- PUSHABLE_TYPES dans supabase/functions/push-send/index.ts)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.visits_after_insert_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notifications_create(NEW.landlord_id, NEW.tenant_id, 'visit_requested',
    'Nouvelle demande de visite', NULL, '/visits/' || NEW.id, NULL, NULL, NULL, NEW.listing_id);
  RETURN NEW;
END; $$;

CREATE TRIGGER visits_after_insert_notify_trigger
  AFTER INSERT ON public.visits FOR EACH ROW EXECUTE FUNCTION public.visits_after_insert_notify();

CREATE OR REPLACE FUNCTION public.visits_after_update_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'creneau_propose' THEN
      PERFORM public.notifications_create(NEW.tenant_id, NEW.landlord_id, 'visit_slot_proposed',
        'Le bailleur propose d''autres créneaux', NULL, '/visits/' || NEW.id, NULL, NULL, NULL, NEW.listing_id);
    ELSIF NEW.status = 'confirmee' THEN
      PERFORM public.notifications_create(NEW.tenant_id, NULL, 'visit_confirmed',
        'Votre visite est confirmée', NULL, '/visits/' || NEW.id, NULL, NULL, NULL, NEW.listing_id);
      PERFORM public.notifications_create(NEW.landlord_id, NULL, 'visit_confirmed',
        'Visite confirmée', NULL, '/visits/' || NEW.id, NULL, NULL, NULL, NEW.listing_id);
    ELSIF NEW.status = 'refusee' THEN
      PERFORM public.notifications_create(NEW.tenant_id, NEW.landlord_id, 'visit_refused',
        'Votre demande de visite a été refusée', NULL, '/visits/' || NEW.id, NULL, NULL, NULL, NEW.listing_id);
    ELSIF NEW.status = 'annulee' THEN
      PERFORM public.notifications_create(NEW.landlord_id, NEW.tenant_id, 'visit_cancelled',
        'Le locataire a annulé la visite', NULL, '/visits/' || NEW.id, NULL, NULL, NULL, NEW.listing_id);
    ELSIF NEW.status = 'effectuee' THEN
      PERFORM public.notifications_create(NEW.tenant_id, NULL, 'visit_completed',
        'Visite validée', NULL, '/visits/' || NEW.id, NULL, NULL, NULL, NEW.listing_id);
      PERFORM public.notifications_create(NEW.landlord_id, NULL, 'visit_completed',
        'Visite validée', NULL, '/visits/' || NEW.id, NULL, NULL, NULL, NEW.listing_id);
    ELSIF NEW.status = 'expiree' THEN
      PERFORM public.notifications_create(NEW.tenant_id, NULL, 'visit_expired',
        'Votre visite a expiré', NULL, '/visits/' || NEW.id, NULL, NULL, NULL, NEW.listing_id);
      PERFORM public.notifications_create(NEW.landlord_id, NULL, 'visit_expired',
        'La visite a expiré sans validation', NULL, '/visits/' || NEW.id, NULL, NULL, NULL, NEW.listing_id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER visits_after_update_notify_trigger
  AFTER UPDATE ON public.visits FOR EACH ROW EXECUTE FUNCTION public.visits_after_update_notify();

-- ============================================================================
-- I — Expiration (72h) et rappel (~24h avant) : purs flips de statut sur
-- condition de temps, aucune logique métier TS à réutiliser (contrairement à
-- rent-reminders) — une fonction SQL planifiée par pg_cron suffit, pas
-- besoin d'Edge Function. Le flip vers "expiree" déclenche automatiquement
-- les notifications ci-dessus via visits_after_update_notify.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.visits_process_scheduled()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.visits SET status = 'expiree'
  WHERE status = 'confirmee' AND scheduled_at + interval '72 hours' < now();

  PERFORM public.notifications_create(v.tenant_id, NULL, 'visit_reminder',
    'Visite prévue demain', NULL, '/visits/' || v.id, NULL, NULL, NULL, v.listing_id)
  FROM public.visits v
  WHERE v.status = 'confirmee' AND v.reminder_sent_at IS NULL
    AND v.scheduled_at > now() AND v.scheduled_at - now() <= interval '24 hours';

  PERFORM public.notifications_create(v.landlord_id, NULL, 'visit_reminder',
    'Visite prévue demain', NULL, '/visits/' || v.id, NULL, NULL, NULL, v.listing_id)
  FROM public.visits v
  WHERE v.status = 'confirmee' AND v.reminder_sent_at IS NULL
    AND v.scheduled_at > now() AND v.scheduled_at - now() <= interval '24 hours';

  UPDATE public.visits SET reminder_sent_at = now()
  WHERE status = 'confirmee' AND reminder_sent_at IS NULL
    AND scheduled_at > now() AND scheduled_at - now() <= interval '24 hours';
END; $$;

-- ⚠️ Geste manuel après merge (même convention que rent-reminders : jamais
-- versionné en SQL dans ce repo) : programmer l'appel périodique de
-- visits_process_scheduled(), par ex. via un Cron Job du Dashboard Supabase
-- (ou `SELECT cron.schedule('visits-process-scheduled', '*/15 * * * *',
-- 'SELECT public.visits_process_scheduled()')` si l'extension pg_cron est
-- déjà active sur le projet), toutes les 15-30 minutes.

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP TRIGGER IF EXISTS visits_after_update_notify_trigger ON public.visits;
-- DROP TRIGGER IF EXISTS visits_after_insert_notify_trigger ON public.visits;
-- DROP TRIGGER IF EXISTS visits_guard_trigger ON public.visits;
-- DROP FUNCTION IF EXISTS public.visits_process_scheduled();
-- DROP FUNCTION IF EXISTS public.visits_after_update_notify();
-- DROP FUNCTION IF EXISTS public.visits_after_insert_notify();
-- DROP FUNCTION IF EXISTS public.confirm_visit_with_code(uuid, text);
-- DROP FUNCTION IF EXISTS public.get_visit_code(uuid);
-- DROP FUNCTION IF EXISTS public.visits_guard();
-- DROP FUNCTION IF EXISTS public.request_visit(uuid, timestamptz[]);
-- DROP TABLE IF EXISTS public.visit_slots;
-- DROP TABLE IF EXISTS public.visits;
-- ALTER TABLE public.listings DROP COLUMN IF EXISTS visit_fee_amount;
