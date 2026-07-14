-- Correctif — rattachement de bail par téléphone : bug de sécurité.
--
-- normalize_phone() ne gardait que les 9 derniers chiffres du numéro,
-- supprimant l'indicatif pays. +237600000003 (Cameroun) et +33600000003
-- (France) normalisaient tous deux vers "600000003" : un utilisateur pouvait
-- se voir rattacher le bail d'un locataire d'un tout autre pays (loyer,
-- adresse, quittances visibles, et pouvait même confirmer le bail à sa
-- place).
--
-- Correction : on garde tous les chiffres, indicatif pays inclus, sans
-- troncature. Le "+" est de toute façon retiré par regexp_replace, donc un
-- numéro E.164 avec ou sans "+" (auth.users.phone est stocké sans "+" par
-- Supabase Auth, tenant_phone avec "+" via components/mboacoin/phone-field.tsx)
-- normalise déjà vers la même chaîne de chiffres — aucun autre changement
-- n'est nécessaire pour que les deux formats continuent de matcher.
--
-- (Le second bug signalé — link_my_pending_leases() appelée seulement à la
-- vérification OTP, jamais rejouée pour une session qui persiste sans
-- nouveau code — est corrigé côté application, app/(app)/layout.tsx, appelé
-- à chaque chargement de page. La fonction elle-même était correcte, rien à
-- changer ici.)
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(coalesce(phone, ''), '\D', '', 'g');
$$;

-- tenant_phone_normalized est une colonne GENERATED ... STORED : remplacer
-- la fonction ne recalcule pas rétroactivement les lignes déjà en base.
-- On force le recalcul par une écriture neutre. Cette écriture ne vient
-- d'aucun acteur légitime au sens de leases_before_update (ni le bailleur,
-- ni le locataire) : on passe par le même drapeau que declare_payment_batch/
-- lease_amendments_guard pour la laisser passer sans déclencher la machine
-- à états du trigger.
SELECT set_config('app.bypass_leases_guard', 'true', true);
UPDATE public.leases SET tenant_phone = tenant_phone;
SELECT set_config('app.bypass_leases_guard', 'false', true);

-- ============================================================================
-- ROLLBACK (à garder de côté, ne pas exécuter sauf besoin)
-- ============================================================================
-- Revenir à l'ancienne troncature à 9 chiffres réintroduirait la faille :
-- ne pas faire de rollback fonctionnel de ce correctif. En cas de besoin
-- réel, restaurer l'ancienne définition puis rejouer le même forçage de
-- recalcul de tenant_phone_normalized ci-dessus.
