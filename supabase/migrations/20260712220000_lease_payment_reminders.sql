-- Chantier NOTIFICATIONS-3 — rappels d'échéance et alertes de retard de loyer.
--
-- Table de suivi interne (jamais lue/écrite par un client) : une ligne par
-- (bail, période), sert à la fois de garde anti-doublon et d'historique pour
-- la tâche planifiée supabase/functions/rent-reminders. Voir ce fichier pour
-- la sémantique exacte des deux colonnes *_at.

CREATE TABLE public.lease_payment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  period date NOT NULL,
  due_soon_sent_at timestamptz,
  late_last_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lease_id, period)
);

ALTER TABLE public.lease_payment_reminders ENABLE ROW LEVEL SECURITY;
-- Aucune policy : table de bookkeeping interne, jamais accédée par un client
-- authentifié. Seule la Edge Function rent-reminders (clé service_role,
-- contourne RLS) y lit/écrit.

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP TABLE IF EXISTS public.lease_payment_reminders;
