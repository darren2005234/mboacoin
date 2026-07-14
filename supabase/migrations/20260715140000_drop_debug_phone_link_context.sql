-- Nettoyage — l'instrumentation de diagnostic (20260715120000) a fait son
-- office : elle a permis de confirmer que auth.uid()/JWT/profile/normalized
-- étaient tous corrects et d'isoler la vraie cause (20260715130000). Plus
-- besoin de la garder en base.
DROP FUNCTION IF EXISTS public.debug_phone_link_context();
