-- Permet à un utilisateur de supprimer ses propres notifications
-- (suppression individuelle + "tout effacer" côté UI).
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE USING (user_id = auth.uid());
