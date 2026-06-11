-- ─────────────────────────────────────────────
-- QUEST — Fix permisos de ADMIN en torneos
-- ─────────────────────────────────────────────
-- Las policies RLS de `tournaments` / `tournament_participants` NO están en el
-- repo (se crearon directo en la DB) y pueden tener el mismo drift que packages:
-- el cliente gatea crear/editar/confirmar-pago con isStaff (=staff|admin|owner),
-- pero la DB podría limitarlo a un rol que excluye 'admin'.
--
-- Esta migración es ADITIVA y SEGURA:
--   - Solo agrega policies PERMISSIVE de ESCRITURA (insert/update/delete).
--   - NO toca las policies de SELECT (lectura) existentes.
--   - NO habilita/deshabilita RLS.
-- Como las policies permissive se combinan con OR, esto SOLO puede OTORGAR
-- acceso a staff/admin/owner; nunca le quita acceso a nadie. Nombres con sufijo
-- _v2 para no colisionar con policies existentes. Idempotente (DROP IF EXISTS).
--
-- Depende de is_staff() (owner|staff|admin), definida en 20260609_fix_admin_perms.sql.
-- Aplicar esa migración primero (o en la misma corrida).
-- ─────────────────────────────────────────────

-- ══ tournaments: crear / editar / borrar = staff|admin|owner ══════════════════
DROP POLICY IF EXISTS "tournaments_staff_insert_v2" ON public.tournaments;
CREATE POLICY "tournaments_staff_insert_v2" ON public.tournaments
  FOR INSERT WITH CHECK ( public.is_staff() );

DROP POLICY IF EXISTS "tournaments_staff_update_v2" ON public.tournaments;
CREATE POLICY "tournaments_staff_update_v2" ON public.tournaments
  FOR UPDATE USING ( public.is_staff() ) WITH CHECK ( public.is_staff() );

DROP POLICY IF EXISTS "tournaments_staff_delete_v2" ON public.tournaments;
CREATE POLICY "tournaments_staff_delete_v2" ON public.tournaments
  FOR DELETE USING ( public.is_staff() );

-- ══ tournament_participants ══════════════════════════════════════════════════
-- INSERT: el jugador se inscribe a sí mismo (user_id = uid) o lo agrega staff.
DROP POLICY IF EXISTS "tparticipants_insert_v2" ON public.tournament_participants;
CREATE POLICY "tparticipants_insert_v2" ON public.tournament_participants
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) = user_id
    OR public.is_staff()
  );

-- DELETE: el jugador se baja a sí mismo, o staff lo remueve.
DROP POLICY IF EXISTS "tparticipants_delete_v2" ON public.tournament_participants;
CREATE POLICY "tparticipants_delete_v2" ON public.tournament_participants
  FOR DELETE USING (
    (SELECT auth.uid()) = user_id
    OR public.is_staff()
  );

-- UPDATE: marcar pago / estado lo hace staff (setTournamentPayment).
DROP POLICY IF EXISTS "tparticipants_update_v2" ON public.tournament_participants;
CREATE POLICY "tparticipants_update_v2" ON public.tournament_participants
  FOR UPDATE USING ( public.is_staff() ) WITH CHECK ( public.is_staff() );
