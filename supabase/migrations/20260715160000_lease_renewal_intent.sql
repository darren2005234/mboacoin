-- Chantier RENOUVELLEMENT-AVANCE — intention de renouvellement du locataire
--
-- La fin de période payée (mode avance) n'est pas qu'un rappel de paiement :
-- c'est une question posée au locataire ("comptez-vous rester ?") qui appelle
-- une réponse. L'absence de réponse ne vaut JAMAIS départ — l'app ne décide
-- jamais à la place de quelqu'un et ne libère jamais un logement
-- automatiquement (règle déjà posée pour la fin de bail classique, étendue
-- ici). "Sans réponse" est donc simplement l'ABSENCE de ligne pour le cycle
-- de couverture en cours, pas un troisième état stocké.
--
-- ============================================================================
-- A — Table lease_renewal_intents
-- ============================================================================
-- coverage_end_date scope la réponse à UN cycle de couverture précis (le
-- end_date du bail au moment de la sollicitation). Si le bailleur déclare un
-- nouveau versement qui prolonge end_date, c'est un NOUVEAU cycle : l'ancienne
-- réponse reste en base (historique), mais ne compte plus pour la période
-- actuelle — une nouvelle question se posera à son J-60 à elle. Toujours
-- dérivé côté serveur (voir set_lease_renewal_intent), jamais fourni par le
-- client, même logique que amount/declared_by sur lease_payments.
CREATE TABLE public.lease_renewal_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  coverage_end_date date NOT NULL,
  intent text NOT NULL CHECK (intent IN ('reste', 'part')),
  responded_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lease_id, coverage_end_date)
);

CREATE INDEX lease_renewal_intents_lease_id_idx ON public.lease_renewal_intents(lease_id);

-- ============================================================================
-- B — RLS : lecture pour bailleur/locataire/admin, AUCUNE policy d'écriture.
-- Toute écriture passe par set_lease_renewal_intent() (SECURITY DEFINER,
-- ci-dessous) : la validation (qui, quel bail, quel délai) vit à un seul
-- endroit, pas dupliquée entre policy et trigger.
-- ============================================================================
ALTER TABLE public.lease_renewal_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lease_renewal_intents_select_landlord" ON public.lease_renewal_intents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.leases WHERE leases.id = lease_renewal_intents.lease_id AND leases.landlord_id = auth.uid())
  );

CREATE POLICY "lease_renewal_intents_select_tenant" ON public.lease_renewal_intents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.leases WHERE leases.id = lease_renewal_intents.lease_id AND leases.tenant_id = auth.uid())
  );

CREATE POLICY "lease_renewal_intents_select_admin" ON public.lease_renewal_intents
  FOR SELECT USING (public.is_admin());

-- ============================================================================
-- C — set_lease_renewal_intent() : seul chemin d'écriture. Dérive
-- coverage_end_date du end_date ACTUEL du bail (jamais fourni par le client),
-- vérifie que l'appelant est bien le locataire de ce bail, que le bail est
-- actif en mode avance avec une couverture en cours, et que cette couverture
-- n'est pas déjà échue (fenêtre de modification : "tant que la période n'est
-- pas échue", quelqu'un peut changer d'avis jusque-là, plus après).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_lease_renewal_intent(p_lease_id uuid, p_intent text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lease record;
BEGIN
  IF p_intent NOT IN ('reste', 'part') THEN
    RAISE EXCEPTION 'intention invalide';
  END IF;

  SELECT tenant_id, status, payment_mode, end_date INTO v_lease
  FROM public.leases WHERE id = p_lease_id;

  IF v_lease IS NULL OR v_lease.tenant_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'non autorisé';
  END IF;
  IF v_lease.status <> 'actif' OR v_lease.payment_mode <> 'avance' THEN
    RAISE EXCEPTION 'ce bail n''accepte pas d''intention de renouvellement';
  END IF;
  IF v_lease.end_date IS NULL THEN
    RAISE EXCEPTION 'aucune période payée pour ce bail';
  END IF;
  IF v_lease.end_date < current_date THEN
    RAISE EXCEPTION 'la période est déjà échue, contactez votre bailleur directement';
  END IF;

  INSERT INTO public.lease_renewal_intents (lease_id, coverage_end_date, intent, responded_at, updated_at)
  VALUES (p_lease_id, v_lease.end_date, p_intent, now(), now())
  ON CONFLICT (lease_id, coverage_end_date)
  DO UPDATE SET intent = excluded.intent, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.set_lease_renewal_intent(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_lease_renewal_intent(uuid, text) TO authenticated;

-- ============================================================================
-- D — Notification au gestionnaire quand le locataire répond, dans les deux
-- sens (création ET changement d'avis). Deux triggers plutôt qu'un seul
-- combiné : le WHEN d'un trigger UPDATE peut comparer OLD/NEW, celui d'un
-- INSERT ne le peut pas (OLD n'existe pas encore) — les combiner forcerait à
-- déplacer la condition dans le corps de la fonction pour un même résultat,
-- pour rien de plus simple.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.lease_renewal_intents_after_write_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_landlord_id uuid;
  v_listing_id uuid;
  v_tenant_label text;
BEGIN
  SELECT l.landlord_id, l.listing_id, coalesce(p.full_name, 'Votre locataire')
    INTO v_landlord_id, v_listing_id, v_tenant_label
  FROM public.leases l
  JOIN public.profiles p ON p.id = l.tenant_id
  WHERE l.id = NEW.lease_id;

  PERFORM public.notifications_create(v_landlord_id, NULL,
    CASE WHEN NEW.intent = 'reste' THEN 'lease_renewal_staying' ELSE 'lease_renewal_leaving' END,
    CASE WHEN NEW.intent = 'reste'
      THEN v_tenant_label || ' compte rester à la fin de sa période payée'
      ELSE v_tenant_label || ' compte partir à la fin de sa période payée'
    END,
    NULL, '/my-leases/' || NEW.lease_id, NEW.lease_id, NULL, NULL, v_listing_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER lease_renewal_intents_insert_notify
  AFTER INSERT ON public.lease_renewal_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.lease_renewal_intents_after_write_notify();

CREATE TRIGGER lease_renewal_intents_update_notify
  AFTER UPDATE ON public.lease_renewal_intents
  FOR EACH ROW
  WHEN (OLD.intent IS DISTINCT FROM NEW.intent)
  EXECUTE FUNCTION public.lease_renewal_intents_after_write_notify();

-- ============================================================================
-- E — lease_payment_reminders : dédup séparée pour la relance J-30. La
-- sollicitation initiale (coverage_ending_sent_at, déjà là depuis
-- 20260715100000) passe de J-30 à J-60 côté fonction planifiée (le seuil
-- COVERAGE_ENDING_SOON_DAYS harmonisé, voir lib/lease-schedule.ts) ; cette
-- nouvelle colonne marque la relance à J-30, qui ne doit partir que si
-- toujours sans réponse à ce moment-là.
-- ============================================================================
ALTER TABLE public.lease_payment_reminders
  ADD COLUMN coverage_ending_reminder_sent_at timestamptz;

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- ALTER TABLE public.lease_payment_reminders DROP COLUMN IF EXISTS coverage_ending_reminder_sent_at;
-- DROP TRIGGER IF EXISTS lease_renewal_intents_update_notify ON public.lease_renewal_intents;
-- DROP TRIGGER IF EXISTS lease_renewal_intents_insert_notify ON public.lease_renewal_intents;
-- DROP FUNCTION IF EXISTS public.lease_renewal_intents_after_write_notify();
-- DROP FUNCTION IF EXISTS public.set_lease_renewal_intent(uuid, text);
-- DROP TABLE IF EXISTS public.lease_renewal_intents;
