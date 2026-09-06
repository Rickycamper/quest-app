-- ─────────────────────────────────────────────
-- QUEST — Puntos solo para el top 4: 4 · 3 · 2 · 1
-- ─────────────────────────────────────────────
-- Antes: 1°=3, 2°=2, 3°=1 y 1 punto por participar (cualquier puesto).
-- Ahora: 1°=4, 2°=3, 3°=2, 4°=1 y el resto NO suma. Pedido del dueño.
--
-- La regla queda en UNA sola función, ranking_pts(), que usan el
-- leaderboard, la importación de CSV, el reclamo de nombres y la
-- reversión. Antes estaba copiada en 5 lugares distintos.
-- Aplicar en SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ranking_pts(p_position integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_position WHEN 1 THEN 4 WHEN 2 THEN 3 WHEN 3 THEN 2 WHEN 4 THEN 1 ELSE 0 END
$$;
REVOKE EXECUTE ON FUNCTION public.ranking_pts(integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.ranking_pts(integer) TO anon, authenticated, service_role;

-- ── Leaderboard por juego (misma firma y permisos que antes) ──
CREATE OR REPLACE FUNCTION public.get_game_leaderboard(p_game text, p_branch text DEFAULT NULL)
RETURNS TABLE (
  id uuid, username text, avatar_url text, branch text, verified boolean,
  role text, is_owner boolean, points bigint, season_badges text[]
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH claim_pts AS (
    SELECT rc.user_id, SUM(public.ranking_pts(rc.position))::bigint AS pts
    FROM ranking_claims rc
    WHERE rc.status = 'approved' AND rc.game = p_game
      AND (p_branch IS NULL OR rc.branch = p_branch)
    GROUP BY rc.user_id
  ),
  override_pts AS (
    SELECT rpo.user_id, rpo.points::bigint AS pts
    FROM ranking_points_override rpo
    WHERE rpo.game = p_game AND rpo.branch = COALESCE(p_branch, '')
  ),
  combined AS (
    SELECT user_id, pts FROM override_pts
    UNION ALL
    SELECT c.user_id, c.pts FROM claim_pts c
    WHERE NOT EXISTS (SELECT 1 FROM override_pts o WHERE o.user_id = c.user_id)
  )
  SELECT pr.id, pr.username, pr.avatar_url, pr.branch, pr.verified, pr.role, pr.is_owner,
         cm.pts AS points, COALESCE(pr.season_badges, '{}')::text[] AS season_badges
  FROM combined cm JOIN profiles pr ON pr.id = cm.user_id
  WHERE cm.pts > 0
  ORDER BY cm.pts DESC
  LIMIT 50;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_game_leaderboard(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_game_leaderboard(text, text) TO anon, authenticated, service_role;

-- ── Importar CSV: solo top 4 genera claim, y suma al total global del perfil ──
CREATE OR REPLACE FUNCTION public.import_tournament_csv(
  p_game text, p_branch text, p_tournament_name text, p_played_on date, p_rows jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_import uuid; v_row jsonb; v_pos integer; v_raw text; v_norm text;
  v_user uuid; v_claim uuid; v_pts integer;
  v_total integer := 0; v_matched integer := 0;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Solo el equipo puede importar torneos'; END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'El CSV no tiene filas';
  END IF;
  IF jsonb_array_length(p_rows) > 500 THEN RAISE EXCEPTION 'Máximo 500 filas por CSV'; END IF;
  IF nullif(btrim(coalesce(p_tournament_name, '')), '') IS NULL THEN RAISE EXCEPTION 'Falta el nombre del torneo'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.tournament_imports ti
     WHERE ti.game = p_game AND ti.played_on = p_played_on
       AND lower(btrim(ti.tournament_name)) = lower(btrim(p_tournament_name))
  ) THEN RAISE EXCEPTION 'Ese torneo ya fue importado (mismo nombre y fecha)'; END IF;

  INSERT INTO public.tournament_imports (game, branch, tournament_name, played_on, uploaded_by)
  VALUES (p_game, p_branch, btrim(p_tournament_name), p_played_on, auth.uid())
  RETURNING id INTO v_import;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_pos  := greatest(1, coalesce((v_row->>'position')::integer, 0));
    v_raw  := left(btrim(coalesce(v_row->>'name', '')), 80);
    v_norm := public.norm_name(v_raw);
    IF v_norm IS NULL THEN CONTINUE; END IF;
    v_total := v_total + 1;

    v_user := NULL; v_claim := NULL;
    SELECT pa.user_id INTO v_user FROM public.player_aliases pa
     WHERE pa.game = p_game AND pa.name_norm = v_norm;

    IF v_user IS NOT NULL THEN
      v_matched := v_matched + 1;
      v_pts := public.ranking_pts(v_pos);
      IF v_pts > 0 THEN
        INSERT INTO public.ranking_claims (user_id, tournament_name, game, branch, position, notes, status)
        VALUES (v_user, btrim(p_tournament_name), p_game, p_branch, v_pos, 'Importado de CSV', 'approved')
        RETURNING id INTO v_claim;
        UPDATE public.profiles SET points = coalesce(points, 0) + v_pts WHERE public.profiles.id = v_user;
      END IF;
    END IF;

    INSERT INTO public.tournament_import_rows (import_id, position, raw_name, name_norm, user_id, claim_id)
    VALUES (v_import, v_pos, v_raw, v_norm, v_user, v_claim);
  END LOOP;

  UPDATE public.tournament_imports SET rows_total = v_total, rows_matched = v_matched
   WHERE public.tournament_imports.id = v_import;
  RETURN jsonb_build_object('import_id', v_import, 'total', v_total, 'matched', v_matched, 'unmatched', v_total - v_matched);
END $$;

-- ── Reclamar nombre: solo top 4 suma ──
CREATE OR REPLACE FUNCTION public.claim_player_name(p_game text, p_name_norm text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_owner uuid; v_raw text; v_claim uuid; v_pts integer;
  v_n integer := 0; v_sum integer := 0; r record; s record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Tenés que iniciar sesión para reclamar un nombre'; END IF;
  SELECT pa.user_id INTO v_owner FROM public.player_aliases pa WHERE pa.game = p_game AND pa.name_norm = p_name_norm;
  IF v_owner IS NOT NULL AND v_owner <> v_uid THEN
    RAISE EXCEPTION 'Ese nombre ya fue reclamado por otro jugador. Si es tuyo, avisale al equipo.';
  END IF;
  SELECT ir.raw_name INTO v_raw FROM public.tournament_import_rows ir
    JOIN public.tournament_imports ti ON ti.id = ir.import_id
   WHERE ti.game = p_game AND ir.name_norm = p_name_norm LIMIT 1;
  IF v_raw IS NULL THEN RAISE EXCEPTION 'Ese nombre no está en ningún torneo importado'; END IF;
  IF v_owner IS NULL THEN
    INSERT INTO public.player_aliases (game, name_norm, raw_name, user_id) VALUES (p_game, p_name_norm, v_raw, v_uid);
  END IF;

  FOR r IN
    SELECT ir.id, ir.position, ti.tournament_name, ti.branch
      FROM public.tournament_import_rows ir JOIN public.tournament_imports ti ON ti.id = ir.import_id
     WHERE ti.game = p_game AND ir.name_norm = p_name_norm AND ir.user_id IS NULL
  LOOP
    v_claim := NULL;
    v_pts := public.ranking_pts(r.position);
    IF v_pts > 0 THEN
      INSERT INTO public.ranking_claims (user_id, tournament_name, game, branch, position, notes, status)
      VALUES (v_uid, r.tournament_name, p_game, r.branch, r.position, 'Importado de CSV', 'approved')
      RETURNING id INTO v_claim;
      v_sum := v_sum + v_pts;
    END IF;
    UPDATE public.tournament_import_rows SET user_id = v_uid, claim_id = v_claim WHERE public.tournament_import_rows.id = r.id;
    v_n := v_n + 1;
  END LOOP;
  IF v_sum > 0 THEN
    UPDATE public.profiles SET points = coalesce(points, 0) + v_sum WHERE public.profiles.id = v_uid;
  END IF;

  BEGIN
    FOR s IN SELECT p.id FROM public.profiles p WHERE p.is_owner OR p.role IN ('staff', 'admin') LOOP
      PERFORM public.create_notification(
        s.id, 'claim_pending', '🔗 Nombre de CSV reclamado',
        format('Un jugador reclamó "%s" en %s: %s torneo(s), %s pts al ranking. Si no es él, se revierte con revoke_player_alias.', v_raw, p_game, v_n, v_sum),
        jsonb_build_object('game', p_game, 'name', p_name_norm, 'user_id', v_uid)
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('results', v_n, 'points', v_sum, 'name', v_raw);
END $$;

-- ── Revertir: resta del total global lo que había sumado ──
CREATE OR REPLACE FUNCTION public.revoke_player_alias(p_alias_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_a record; v_n integer; v_pts integer;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Solo el equipo puede revertir reclamos'; END IF;
  SELECT * INTO v_a FROM public.player_aliases pa WHERE pa.id = p_alias_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reclamo no encontrado'; END IF;

  SELECT coalesce(sum(public.ranking_pts(rc.position)), 0) INTO v_pts
    FROM public.ranking_claims rc JOIN public.tournament_import_rows ir ON ir.claim_id = rc.id
   WHERE ir.user_id = v_a.user_id AND ir.name_norm = v_a.name_norm;

  DELETE FROM public.ranking_claims rc USING public.tournament_import_rows ir
   WHERE ir.claim_id = rc.id AND ir.user_id = v_a.user_id AND ir.name_norm = v_a.name_norm;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE public.tournament_import_rows ir SET user_id = NULL, claim_id = NULL
   WHERE ir.user_id = v_a.user_id AND ir.name_norm = v_a.name_norm;
  UPDATE public.profiles SET points = greatest(0, coalesce(points, 0) - v_pts) WHERE public.profiles.id = v_a.user_id;
  DELETE FROM public.player_aliases pa WHERE pa.id = p_alias_id;
  RETURN jsonb_build_object('claims_removed', v_n, 'points_removed', v_pts);
END $$;

-- ── Sincronizar el total global de cada perfil con la regla nueva ──
-- (el ranking se acaba de reiniciar, así que esto solo corrige lo poco
--  que se haya reclamado con la regla vieja)
UPDATE public.profiles p
   SET points = coalesce((SELECT sum(public.ranking_pts(rc.position))
                            FROM public.ranking_claims rc
                           WHERE rc.user_id = p.id AND rc.status = 'approved'), 0)
 WHERE coalesce(p.points, 0) <> coalesce((SELECT sum(public.ranking_pts(rc.position))
                                            FROM public.ranking_claims rc
                                           WHERE rc.user_id = p.id AND rc.status = 'approved'), 0);

-- ── Verificación ──
SELECT 'ranking_pts(1..5)' AS que,
       concat_ws(' · ', public.ranking_pts(1), public.ranking_pts(2), public.ranking_pts(3), public.ranking_pts(4), public.ranking_pts(5)) AS valor
UNION ALL
SELECT 'leaderboard ejecutable por anon', has_function_privilege('anon', 'public.get_game_leaderboard(text,text)', 'EXECUTE')::text
UNION ALL
SELECT 'perfiles con puntos', count(*)::text FROM public.profiles WHERE points > 0;
