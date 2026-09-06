-- ─────────────────────────────────────────────
-- QUEST — Torneos por CSV + reclamo de nombres
-- ─────────────────────────────────────────────
-- El equipo sube el CSV de resultados de un torneo (los nombres vienen del
-- software del torneo y NO coinciden con los usuarios de la app). Cada
-- fila cuyo nombre ya fue reclamado se convierte en un ranking_claims
-- APROBADO (así el leaderboard actual la suma sin tocar nada). Las filas
-- sin dueño quedan en tournament_import_rows; el jugador entra a la app,
-- reclama su nombre, y se le asignan TODAS sus filas — pasadas y futuras.
--
-- Tablas: player_aliases (nombre de CSV → usuario, por juego),
--         tournament_imports (un registro por CSV subido),
--         tournament_import_rows (una fila por jugador del CSV).
-- Vista:  unclaimed_import_names (lo que ve la gente para reclamar).
-- RPC:    import_tournament_csv (equipo), claim_player_name (usuario),
--         revoke_player_alias (equipo).
-- Aplicar en SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

-- Normaliza un nombre para comparar: minúsculas, sin acentos, solo
-- letras/números/espacios, espacios colapsados. "José  PÉREZ" = "jose perez".
CREATE OR REPLACE FUNCTION public.norm_name(t text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT nullif(btrim(regexp_replace(regexp_replace(
    lower(translate(coalesce(t, ''),
      'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
      'aaaaaeeeeiiiiooooouuuuncaaaaaeeeeiiiiooooouuuunc')),
    '[^a-z0-9 ]+', ' ', 'g'), '\s+', ' ', 'g')), '')
$$;
REVOKE EXECUTE ON FUNCTION public.norm_name(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.norm_name(text) TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.player_aliases (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game       text NOT NULL,
  name_norm  text NOT NULL,
  raw_name   text NOT NULL,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game, name_norm)
);
CREATE INDEX IF NOT EXISTS player_aliases_user_idx ON public.player_aliases (user_id);

CREATE TABLE IF NOT EXISTS public.tournament_imports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game            text NOT NULL,
  branch          text NOT NULL,
  tournament_name text NOT NULL,
  played_on       date NOT NULL,
  uploaded_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  rows_total      integer NOT NULL DEFAULT 0,
  rows_matched    integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tournament_import_rows (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id  uuid NOT NULL REFERENCES public.tournament_imports(id) ON DELETE CASCADE,
  position   integer NOT NULL CHECK (position >= 1),
  raw_name   text NOT NULL,
  name_norm  text NOT NULL,
  user_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  claim_id   uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tir_name_idx   ON public.tournament_import_rows (name_norm);
CREATE INDEX IF NOT EXISTS tir_import_idx ON public.tournament_import_rows (import_id);

-- ── RLS: leer con criterio; escribir SOLO por las funciones ──
ALTER TABLE public.player_aliases         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_imports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_import_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aliases read" ON public.player_aliases;
CREATE POLICY "aliases read" ON public.player_aliases
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR public.is_staff());
DROP POLICY IF EXISTS "imports staff read" ON public.tournament_imports;
CREATE POLICY "imports staff read" ON public.tournament_imports
  FOR SELECT USING (public.is_staff());
DROP POLICY IF EXISTS "import rows read" ON public.tournament_import_rows;
CREATE POLICY "import rows read" ON public.tournament_import_rows
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR public.is_staff());

REVOKE ALL ON public.player_aliases, public.tournament_imports, public.tournament_import_rows FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.player_aliases, public.tournament_imports, public.tournament_import_rows FROM authenticated;
GRANT  SELECT ON public.player_aliases, public.tournament_imports, public.tournament_import_rows TO authenticated;
GRANT  ALL    ON public.player_aliases, public.tournament_imports, public.tournament_import_rows TO service_role;

-- Lo que ve la gente para reclamar: nombres sin dueño, por juego.
CREATE OR REPLACE VIEW public.unclaimed_import_names AS
  SELECT ti.game,
         ir.name_norm,
         min(ir.raw_name)   AS raw_name,
         count(*)::int      AS results,
         min(ir.position)   AS best_position,
         max(ti.played_on)  AS last_played
  FROM public.tournament_import_rows ir
  JOIN public.tournament_imports ti ON ti.id = ir.import_id
  WHERE ir.user_id IS NULL
  GROUP BY ti.game, ir.name_norm;
-- Supabase le da SELECT a anon en toda vista nueva por default privileges:
-- se lo sacamos explícito. Reclamar exige sesión, así que anon no la necesita.
REVOKE ALL ON public.unclaimed_import_names FROM PUBLIC, anon;
GRANT SELECT ON public.unclaimed_import_names TO authenticated, service_role;

-- ── Importar un CSV (solo equipo) ──
-- p_rows = [{"position": 1, "name": "Juan Pérez"}, ...]
CREATE OR REPLACE FUNCTION public.import_tournament_csv(
  p_game text, p_branch text, p_tournament_name text, p_played_on date, p_rows jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_import  uuid;
  v_row     jsonb;
  v_pos     integer;
  v_raw     text;
  v_norm    text;
  v_user    uuid;
  v_claim   uuid;
  v_total   integer := 0;
  v_matched integer := 0;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Solo el equipo puede importar torneos';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'El CSV no tiene filas';
  END IF;
  IF jsonb_array_length(p_rows) > 500 THEN
    RAISE EXCEPTION 'Máximo 500 filas por CSV';
  END IF;
  IF nullif(btrim(coalesce(p_tournament_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Falta el nombre del torneo';
  END IF;
  -- Doble importación = puntos dobles. Mismo juego + nombre + fecha se rechaza.
  IF EXISTS (
    SELECT 1 FROM public.tournament_imports ti
     WHERE ti.game = p_game AND ti.played_on = p_played_on
       AND lower(btrim(ti.tournament_name)) = lower(btrim(p_tournament_name))
  ) THEN
    RAISE EXCEPTION 'Ese torneo ya fue importado (mismo nombre y fecha)';
  END IF;

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
    SELECT pa.user_id INTO v_user
      FROM public.player_aliases pa
     WHERE pa.game = p_game AND pa.name_norm = v_norm;

    IF v_user IS NOT NULL THEN
      INSERT INTO public.ranking_claims (user_id, tournament_name, game, branch, position, notes, status)
      VALUES (v_user, btrim(p_tournament_name), p_game, p_branch, v_pos, 'Importado de CSV', 'approved')
      RETURNING id INTO v_claim;
      v_matched := v_matched + 1;
    END IF;

    INSERT INTO public.tournament_import_rows (import_id, position, raw_name, name_norm, user_id, claim_id)
    VALUES (v_import, v_pos, v_raw, v_norm, v_user, v_claim);
  END LOOP;

  UPDATE public.tournament_imports SET rows_total = v_total, rows_matched = v_matched
   WHERE public.tournament_imports.id = v_import;

  RETURN jsonb_build_object('import_id', v_import, 'total', v_total,
                            'matched', v_matched, 'unmatched', v_total - v_matched);
END $$;
REVOKE EXECUTE ON FUNCTION public.import_tournament_csv(text, text, text, date, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.import_tournament_csv(text, text, text, date, jsonb) TO authenticated, service_role;

-- ── Reclamar un nombre (cualquier usuario logueado) ──
-- Vincula el nombre al usuario y le asigna TODAS las filas sin dueño de ese
-- nombre en ese juego (torneos pasados). Los CSV futuros ya lo reconocen.
CREATE OR REPLACE FUNCTION public.claim_player_name(p_game text, p_name_norm text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_owner uuid;
  v_raw   text;
  v_n     integer := 0;
  v_claim uuid;
  r       record;
  s       record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Tenés que iniciar sesión para reclamar un nombre'; END IF;

  SELECT pa.user_id INTO v_owner FROM public.player_aliases pa
   WHERE pa.game = p_game AND pa.name_norm = p_name_norm;
  IF v_owner IS NOT NULL AND v_owner <> v_uid THEN
    RAISE EXCEPTION 'Ese nombre ya fue reclamado por otro jugador. Si es tuyo, avisale al equipo.';
  END IF;

  SELECT ir.raw_name INTO v_raw
    FROM public.tournament_import_rows ir
    JOIN public.tournament_imports ti ON ti.id = ir.import_id
   WHERE ti.game = p_game AND ir.name_norm = p_name_norm
   LIMIT 1;
  IF v_raw IS NULL THEN RAISE EXCEPTION 'Ese nombre no está en ningún torneo importado'; END IF;

  IF v_owner IS NULL THEN
    INSERT INTO public.player_aliases (game, name_norm, raw_name, user_id)
    VALUES (p_game, p_name_norm, v_raw, v_uid);
  END IF;

  FOR r IN
    SELECT ir.id, ir.position, ti.tournament_name, ti.branch
      FROM public.tournament_import_rows ir
      JOIN public.tournament_imports ti ON ti.id = ir.import_id
     WHERE ti.game = p_game AND ir.name_norm = p_name_norm AND ir.user_id IS NULL
  LOOP
    INSERT INTO public.ranking_claims (user_id, tournament_name, game, branch, position, notes, status)
    VALUES (v_uid, r.tournament_name, p_game, r.branch, r.position, 'Importado de CSV', 'approved')
    RETURNING id INTO v_claim;
    UPDATE public.tournament_import_rows SET user_id = v_uid, claim_id = v_claim
     WHERE public.tournament_import_rows.id = r.id;
    v_n := v_n + 1;
  END LOOP;

  -- Aviso al equipo (best-effort: si falla, el reclamo igual queda hecho)
  BEGIN
    FOR s IN SELECT p.id FROM public.profiles p WHERE p.is_owner OR p.role IN ('staff', 'admin') LOOP
      PERFORM public.create_notification(
        s.id, 'claim_pending', '🔗 Nombre de CSV reclamado',
        format('Un jugador reclamó "%s" en %s: %s resultado(s) sumados al ranking. Si no es él, podés revertirlo en Rankings → Claims.', v_raw, p_game, v_n),
        jsonb_build_object('game', p_game, 'name', p_name_norm, 'user_id', v_uid)
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('results', v_n, 'name', v_raw);
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_player_name(text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_player_name(text, text) TO authenticated, service_role;

-- ── Revertir un reclamo (solo equipo): borra los claims que generó,
--    desvincula las filas y libera el nombre ──
CREATE OR REPLACE FUNCTION public.revoke_player_alias(p_alias_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_a record; v_n integer;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Solo el equipo puede revertir reclamos'; END IF;
  SELECT * INTO v_a FROM public.player_aliases pa WHERE pa.id = p_alias_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reclamo no encontrado'; END IF;

  DELETE FROM public.ranking_claims rc
   USING public.tournament_import_rows ir
   WHERE ir.claim_id = rc.id AND ir.user_id = v_a.user_id AND ir.name_norm = v_a.name_norm;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE public.tournament_import_rows ir SET user_id = NULL, claim_id = NULL
   WHERE ir.user_id = v_a.user_id AND ir.name_norm = v_a.name_norm;

  DELETE FROM public.player_aliases pa WHERE pa.id = p_alias_id;
  RETURN jsonb_build_object('claims_removed', v_n);
END $$;
REVOKE EXECUTE ON FUNCTION public.revoke_player_alias(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.revoke_player_alias(uuid) TO authenticated, service_role;

-- ── Verificación ──
-- 1) permisos (anon debe ser false en las 3 RPC; authenticated true)
-- 2) constraints de ranking_claims: si hay un CHECK sobre position o branch,
--    hay que saberlo ANTES del primer CSV grande.
SELECT 'rpc ' || p.proname AS chequeo,
       has_function_privilege('anon', p.oid, 'EXECUTE')::text AS anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE')::text AS auth
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('import_tournament_csv', 'claim_player_name', 'revoke_player_alias')
UNION ALL
SELECT 'constraint ranking_claims: ' || conname, pg_get_constraintdef(oid), ''
FROM pg_constraint WHERE conrelid = 'public.ranking_claims'::regclass AND contype = 'c';
