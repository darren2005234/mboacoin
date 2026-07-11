-- Sous-chantier 3C — durcit l'INSERT sur `listings` : une policy RESTRICTIVE
-- (combinée en AND avec les policies PERMISSIVE existantes, sans avoir besoin
-- de connaître leur nom) bloque la publication par un compte agence/résidence
-- non vérifié, en défense-en-profondeur de la garde applicative dans
-- lib/create-listing.ts.

CREATE POLICY "listings_insert_requires_verification" ON public.listings
  AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.account_type IN ('agence', 'residence')
        AND profiles.verification <> 'verifie'
    )
  );
