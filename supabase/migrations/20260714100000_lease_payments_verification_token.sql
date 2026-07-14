-- Chantier Quittance vérifiable — jeton de vérification publique
--
-- Le receipt_number (MBC-2026-000014) est séquentiel : l'exposer comme clé
-- d'une page publique permettrait d'énumérer toutes les quittances de la
-- plateforme (montants, périodes, données de tous les utilisateurs). On
-- ajoute donc un jeton distinct, imprévisible, dédié à cet usage.
--
-- ============================================================================
-- A.1 — Colonne verification_token
-- ============================================================================
-- gen_random_uuid() est déjà le générateur utilisé pour tous les id de la
-- base (cf. lease_payments.id, receipt_number) : pas de nouvelle extension
-- (pgcrypto) à activer. 122 bits d'entropie (UUID v4), hors de portée d'une
-- énumération/brute-force.
--
-- Étant une fonction VOLATILE (pas une constante), gen_random_uuid() en
-- DEFAULT force Postgres à réécrire la table et à l'appeler une fois PAR
-- LIGNE existante : les paiements déjà en base reçoivent chacun un jeton
-- distinct par ce seul ALTER TABLE, pas de UPDATE séparé nécessaire.
ALTER TABLE public.lease_payments
  ADD COLUMN verification_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid();

-- Pas de REVOKE SELECT sur cette colonne : contrairement à visits.confirmation_code,
-- ici le bailleur/locataire du bail voient déjà leur propre ligne lease_payments
-- via les policies RLS existantes — voir leur propre jeton est inoffensif.

-- ============================================================================
-- A.2 — Fonction publique de vérification (SECURITY DEFINER)
-- ============================================================================
-- Pas de policy RLS "lecture par jeton" : une policy USING (true) (ou un
-- mécanisme de variable de session) ouvrirait la table plus largement que
-- nécessaire, et toute colonne sensible ajoutée plus tard à lease_payments
-- deviendrait publique par défaut sauf à penser à la REVOKE. Une fonction
-- SECURITY DEFINER a une liste blanche explicite de colonnes retournées
-- (RETURNS TABLE), cohérent avec le pattern déjà en place pour les agrégats
-- agence (agency_market_*). Elle permet aussi de joindre leases/profiles
-- pour le nom des parties sans ouvrir RLS sur ces tables pour anon.
--
-- Ne renvoie JAMAIS : lease_id, landlord_id, tenant_id, adresse, téléphone —
-- ces champs ne sont même pas sélectionnés.
--
-- issued_at = created_at (date d'émission réelle et immuable de la ligne),
-- volontairement distinct du champ "issuedAt" du PDF qui reflète, lui, la
-- date de génération/téléchargement du document.
CREATE OR REPLACE FUNCTION public.get_public_receipt(p_token uuid)
RETURNS TABLE(
  receipt_number text,
  period date,
  amount numeric,
  paid_at date,
  method text,
  issued_at timestamptz,
  tenant_name text,
  landlord_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lp.receipt_number, lp.period, lp.amount, lp.paid_at, lp.method, lp.created_at,
         tenant.full_name, landlord.full_name
  FROM public.lease_payments lp
  JOIN public.leases l ON l.id = lp.lease_id
  JOIN public.profiles tenant ON tenant.id = l.tenant_id
  JOIN public.profiles landlord ON landlord.id = l.landlord_id
  WHERE lp.verification_token = p_token;
$$;

REVOKE ALL ON FUNCTION public.get_public_receipt(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_receipt(uuid) TO anon, authenticated;

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- DROP FUNCTION IF EXISTS public.get_public_receipt(uuid);
-- ALTER TABLE public.lease_payments DROP COLUMN IF EXISTS verification_token;
