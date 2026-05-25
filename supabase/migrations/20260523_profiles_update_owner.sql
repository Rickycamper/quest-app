-- ─────────────────────────────────────────────
-- QUEST — profiles UPDATE policy: incluir is_owner
-- ─────────────────────────────────────────────
-- Bug previo: la policy `profiles_update` (migration 20260428_fix_permissive
-- _policies_batch2) solo permitía UPDATE si el caller era admin o staff.
-- NO incluía is_owner. Resultado: owners no podían:
--   - Asignar puntos a otros usuarios (staffAwardRankingPoints actualizaba
--     ranking_claims OK, pero adjustUserPoints → setUserPoints fallaba
--     silenciosamente — RLS reject = 0 rows affected = .single() error
--     "Usuario no encontrado")
--   - Cualquier otra escritura cross-user en profiles
--
-- Las otras tablas relacionadas (ranking_claims, ranking_points_override)
-- ya incluían is_owner en sus policies. Solo profiles estaba incompleta.

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE
  USING (
    (SELECT auth.uid()) = id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (
          p.is_owner = true
          OR p.role = ANY (ARRAY['admin'::user_role, 'staff'::user_role])
        )
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
        AND (
          p.is_owner = true
          OR p.role = ANY (ARRAY['admin'::user_role, 'staff'::user_role])
        )
    )
  );
