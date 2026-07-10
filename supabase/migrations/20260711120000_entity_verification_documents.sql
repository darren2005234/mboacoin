-- Sous-chantier 3A — Vérification d'entité (agences et résidences)
-- Additif uniquement : nullable, aucune demande de particulier n'est affectée.

ALTER TABLE public.verification_requests
  ADD COLUMN entity_document_path text,
  ADD COLUMN entity_document_type text;
