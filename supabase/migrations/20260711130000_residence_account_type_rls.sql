-- Correctif 3B — durcit les policies RLS de `residences` : en plus de la propriété
-- (auth.uid() = manager_id), exige que le compte soit bien de type 'residence'.
-- Complément défense-en-profondeur à la garde applicative dans lib/residences.ts.

ALTER POLICY "residences_insert_own" ON public.residences
  WITH CHECK (
    auth.uid() = manager_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.account_type = 'residence'
    )
  );

ALTER POLICY "residences_update_own" ON public.residences
  USING (
    auth.uid() = manager_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.account_type = 'residence'
    )
  );

ALTER POLICY "residences_delete_own" ON public.residences
  USING (
    auth.uid() = manager_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.account_type = 'residence'
    )
  );
