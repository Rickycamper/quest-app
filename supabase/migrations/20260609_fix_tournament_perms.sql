-- ─────────────────────────────────────────────
-- QUEST — Fix permisos de ADMIN en torneos (defensivo / aditivo)
-- ─────────────────────────────────────────────
-- Da a staff/admin/owner (vía is_staff()) permiso de escritura sobre
-- tournaments / tournament_participants, que el cliente ya gatea con isStaff.
-- ADITIVO (solo otorga, nunca quita) y con guard to_regclass() por si la tabla
-- no existe en algún entorno. Depende de is_staff() (20260609_fix_admin_perms.sql).
-- ─────────────────────────────────────────────

-- tournaments: crear / editar / borrar
DO $$ BEGIN
  IF to_regclass('public.tournaments') IS NOT NULL THEN
    EXECUTE $q$DROP POLICY IF EXISTS "tournaments_staff_insert_v2" ON public.tournaments$q$;
    EXECUTE $q$CREATE POLICY "tournaments_staff_insert_v2" ON public.tournaments FOR INSERT WITH CHECK (public.is_staff())$q$;
    EXECUTE $q$DROP POLICY IF EXISTS "tournaments_staff_update_v2" ON public.tournaments$q$;
    EXECUTE $q$CREATE POLICY "tournaments_staff_update_v2" ON public.tournaments FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff())$q$;
    EXECUTE $q$DROP POLICY IF EXISTS "tournaments_staff_delete_v2" ON public.tournaments$q$;
    EXECUTE $q$CREATE POLICY "tournaments_staff_delete_v2" ON public.tournaments FOR DELETE USING (public.is_staff())$q$;
  END IF;
END $$;

-- tournament_participants: inscripción propia / remoción / pago por staff
DO $$ BEGIN
  IF to_regclass('public.tournament_participants') IS NOT NULL THEN
    EXECUTE $q$DROP POLICY IF EXISTS "tparticipants_insert_v2" ON public.tournament_participants$q$;
    EXECUTE $q$CREATE POLICY "tparticipants_insert_v2" ON public.tournament_participants FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id OR public.is_staff())$q$;
    EXECUTE $q$DROP POLICY IF EXISTS "tparticipants_delete_v2" ON public.tournament_participants$q$;
    EXECUTE $q$CREATE POLICY "tparticipants_delete_v2" ON public.tournament_participants FOR DELETE USING ((SELECT auth.uid()) = user_id OR public.is_staff())$q$;
    EXECUTE $q$DROP POLICY IF EXISTS "tparticipants_update_v2" ON public.tournament_participants$q$;
    EXECUTE $q$CREATE POLICY "tparticipants_update_v2" ON public.tournament_participants FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff())$q$;
  END IF;
END $$;
