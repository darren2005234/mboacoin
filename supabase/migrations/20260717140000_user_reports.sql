-- Chantier — Signalement de compte par les utilisateurs.
--
-- La plomberie existe déjà mais n'est branchée nulle part : reports.reported_user_id,
-- lib/reports.ts::reportUser(), components/mboacoin/report-dialog.tsx (targetType
-- "user") sont tous déjà en place, seul <ReportDialog targetType="user" .../>
-- n'est rendu par aucune page. Ce fichier ne recrée donc pas reports pour les
-- comptes : il formalise en base des invariants aujourd'hui garantis
-- uniquement par la discipline du code appelant (une seule cible à la fois,
-- jamais soi-même, motifs cohérents pour un signalement de compte), et ajoute
-- les fonctions de détection d'abus pour l'admin.
--
-- ⚠️ Ne pas exécuter automatiquement : migration manuelle. reports n'est PAS
-- versionnée dans ce repo (schéma de base) — avant d'exécuter ce fichier,
-- lancer dans Supabase :
--   1. SELECT count(*) FROM reports WHERE (listing_id IS NOT NULL) = (reported_user_id IS NOT NULL);
--      → doit renvoyer 0 (sinon une ligne viole déjà l'invariant "une seule cible").
--   2. SELECT count(*) FROM reports WHERE reported_user_id = reporter_id;
--      → doit renvoyer 0.
--   3. SELECT DISTINCT reason FROM reports WHERE reported_user_id IS NOT NULL;
--      → doit être vide (targetType="user" n'ayant jamais été rendu, aucun
--      signalement de compte n'a pu être créé) ou déjà dans 
la liste de la
--      section A ci-dessous.
--   4. SELECT polname, qual, with_check FROM pg_policies WHERE tablename = 'reports';
--      → confirmer qu'aucune policy SELECT n'expose un signalement au signalé
--      ni au signaleur au-delà de ses propres signalements ÉMIS (seul
--      public.is_admin() doit voir les signalements REÇUS par un compte).

-- ============================================================================
-- A — Invariants formalisés en base (défense en profondeur : pas seulement
-- côté app). Additif : reports garde sa structure actuelle (listing_id +
-- reported_user_id en colonnes parallèles, chacune avec son propre index
-- unique anti-doublon déjà en place) — pas de cible polymorphe, inutile ici
-- puisqu'il n'y a que deux cibles possibles, pas une famille ouverte.
-- ============================================================================

-- Exactement une cible : jamais les deux, jamais aucune.
ALTER TABLE public.reports
  ADD CONSTRAINT reports_exactly_one_target
  CHECK ((listing_id IS NOT NULL) <> (reported_user_id IS NOT NULL));

-- Un utilisateur ne peut pas se signaler lui-même — dernière ligne de
-- défense en base, en plus de masquer le bouton sur son propre profil public
-- (les deux autres points d'entrée, conversation et bail, sont
-- structurellement jamais soi-même).
ALTER TABLE public.reports
  ADD CONSTRAINT reports_no_self_report
  CHECK (reported_user_id IS DISTINCT FROM reporter_id);

-- Motifs codés pour un signalement de COMPTE uniquement. Volontairement pas
-- de motif "paiement hors plateforme" : aucun paiement ne transite par l'app
-- en v1, payer hors plateforme est donc le fonctionnement
-- normal — le vrai problème (paiement anticipé frauduleux avant tout
-- engagement réel) est couvert par 'arnaque'. Les motifs d'annonce restent du
-- texte libre existant, non touchés ici.
ALTER TABLE public.reports
  ADD CONSTRAINT reports_user_reason_check
  CHECK (
    reported_user_id IS NULL
    OR reason IN ('arnaque', 'usurpation', 'harcelement', 'comportement_inapproprie', 'autre')
  );

-- ============================================================================
-- B — Détection d'abus pour l'admin (lecture uniquement, jamais d'action
-- automatique déclenchée par ces chiffres — l'admin juge, jamais la base).
-- ============================================================================

-- Compteurs en masse, pour annoter une liste de signalements ou un badge de
-- fiche sans un aller-retour par utilisateur (même patron que
-- list_suspended_user_ids de la suspension de compte).
CREATE OR REPLACE FUNCTION public.get_report_stats_for_users(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, received_count int, emitted_count int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id,
    (SELECT count(*)::int FROM reports WHERE reported_user_id = u.id),
    (SELECT count(*)::int FROM reports WHERE reporter_id = u.id)
  FROM unnest(p_user_ids) AS u(id)
  WHERE public.is_admin();
$$;

REVOKE ALL ON FUNCTION public.get_report_stats_for_users(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_report_stats_for_users(uuid[]) TO authenticated;

-- « De la part de qui » : détail des signalements reçus par un compte, pour
-- la fiche admin — distinguer un vrai problème (plusieurs signaleurs
-- indépendants) d'un signalement malveillant isolé.
CREATE OR REPLACE FUNCTION public.get_reports_received(p_user_id uuid)
RETURNS TABLE(
  id uuid, reporter_id uuid, reporter_name text, reason text,
  details text, status text, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.reporter_id, p.full_name, r.reason, r.details, r.status, r.created_at
  FROM reports r
  JOIN profiles p ON p.id = r.reporter_id
  WHERE r.reported_user_id = p_user_id AND public.is_admin()
  ORDER BY r.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_reports_received(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reports_received(uuid) TO authenticated;

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP FUNCTION IF EXISTS public.get_reports_received(uuid);
-- DROP FUNCTION IF EXISTS public.get_report_stats_for_users(uuid[]);
-- ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_user_reason_check;
-- ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_no_self_report;
-- ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_exactly_one_target;
