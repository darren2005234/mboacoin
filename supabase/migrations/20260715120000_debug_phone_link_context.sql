-- Instrumentation temporaire — diagnostic du rattachement de bail par
-- téléphone qui ne se produit pas malgré une normalisation confirmée
-- correcte en base. SECURITY INVOKER (comme current_user_phone_normalized
-- et link_my_pending_leases) : reflète exactement le contexte du VRAI
-- appelant, sans rien masquer. Ne modifie rien, lecture seule.
--
-- À appeler depuis le même client (donc la même requête/session) que
-- link_my_pending_leases() pour comparer les deux dans le même contexte.
-- À supprimer une fois le diagnostic terminé (voir ROLLBACK).
CREATE OR REPLACE FUNCTION public.debug_phone_link_context()
RETURNS TABLE(
  uid uuid,
  jwt_phone text,
  profile_phone text,
  normalized text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT auth.uid(),
         auth.jwt() ->> 'phone',
         (SELECT phone FROM public.profiles WHERE id = auth.uid()),
         public.current_user_phone_normalized();
$$;

REVOKE ALL ON FUNCTION public.debug_phone_link_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_phone_link_context() TO authenticated;

-- ============================================================================
-- ROLLBACK (à exécuter une fois le diagnostic terminé)
-- ============================================================================
-- DROP FUNCTION IF EXISTS public.debug_phone_link_context();
