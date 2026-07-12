-- Chantier NOTIFICATIONS-2 — abonnements aux notifications push web (PWA).
--
-- Un utilisateur peut avoir plusieurs abonnements (plusieurs appareils/navigateurs).
-- `endpoint` est unique en base : c'est l'identifiant que le navigateur attribue
-- à l'abonnement push ; un même endpoint ne peut appartenir qu'à un seul compte
-- (le client fait un upsert ON CONFLICT (endpoint) — cas du changement de compte
-- sur le même appareil).
--
-- L'envoi effectif des push se fait depuis une Edge Function (clé service_role,
-- contourne RLS) déclenchée par un Database Webhook sur `notifications` — voir
-- supabase/functions/push-send. Aucune policy admin n'est donc nécessaire ici.

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_select_own" ON public.push_subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "push_subscriptions_insert_own" ON public.push_subscriptions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_subscriptions_update_own" ON public.push_subscriptions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_subscriptions_delete_own" ON public.push_subscriptions
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP TABLE IF EXISTS public.push_subscriptions;
