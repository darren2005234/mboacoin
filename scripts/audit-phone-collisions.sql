-- Lecture seule — à exécuter dans le SQL editor Supabase APRÈS la migration
-- 20260715110000_phone_normalization_fix.sql, pour détecter les baux déjà
-- rattachés (tenant_id renseigné) sous l'ancienne normalisation tronquée à 9
-- chiffres, dont le locataire lié n'est PAS réellement le même numéro complet
-- que tenant_phone. Ne modifie rien : à examiner à la main.
SELECT
  l.id AS lease_id,
  l.status,
  l.tenant_phone,
  l.tenant_id,
  p.phone AS linked_profile_phone,
  l.landlord_id
FROM public.leases l
JOIN public.profiles p ON p.id = l.tenant_id
WHERE l.tenant_id IS NOT NULL
  AND regexp_replace(coalesce(l.tenant_phone, ''), '\D', '', 'g')
      <> regexp_replace(coalesce(p.phone, ''), '\D', '', 'g');

-- Si cette requête renvoie des lignes : le bail a été rattaché au mauvais
-- compte à cause de la collision d'indicatif. Pour chaque ligne concernée,
-- décision à prendre au cas par cas (pas d'action automatique ici) :
--   - si le bail est encore "en_attente_confirmation" : UPDATE leases
--     SET tenant_id = NULL WHERE id = '<lease_id>'; le vrai locataire sera
--     rattaché correctement à sa prochaine connexion (link_my_pending_leases
--     tourne désormais à chaque chargement de page).
--   - si le bail est déjà "actif" (le mauvais locataire a pu le confirmer) :
--     nécessite une intervention manuelle côté produit/support — le mauvais
--     compte a pu voir loyer/adresse/quittances, potentiellement confirmer
--     le bail à la place du vrai locataire. Ne pas se contenter de remettre
--     tenant_id à NULL sans prévenir les deux parties concernées.
