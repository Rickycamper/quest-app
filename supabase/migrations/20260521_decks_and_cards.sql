-- ─────────────────────────────────────────────
-- QUEST — Decks + Cards System
-- ─────────────────────────────────────────────
-- Fase 1: foundation para que usuarios puedan importar/guardar decks
-- pasteando desde sitios externos (egmanevents, onepiecetopdecks, MTG
-- Arena export, etc.). El parser extrae qty + código de cada línea y
-- las cartas nuevas se auto-insertan en `cards` así la DB crece
-- orgánicamente con el uso.
--
-- Imágenes de carta vienen en Fase 2 (Scryfall/pokemontcg.io APIs +
-- admin upload manual para los TCGs sin API pública).
-- Integración con torneos viene en Fase 3.

-- ── cards — catálogo central, una row por carta única ──────────────
CREATE TABLE IF NOT EXISTS cards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game        text NOT NULL,           -- 'MTG', 'Pokemon', 'One Piece', etc.
  code        text NOT NULL,           -- 'OP01-001', 'M21-162', 'PAL-254', etc.
  name        text NOT NULL,
  -- Optional metadata — se llena en Fase 2 cuando integramos APIs/scrape
  image_url   text,
  set_code    text,                    -- 'OP01', 'M21', 'PAL'
  card_number text,                    -- '001', '162'
  rarity      text,
  card_type   text,
  -- Tracking — quién la creó y si está verificada por admin
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  verified    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- Una sola row por (juego, código) — el código es único dentro del juego
  UNIQUE (game, code)
);

CREATE INDEX IF NOT EXISTS idx_cards_game        ON cards (game);
CREATE INDEX IF NOT EXISTS idx_cards_game_code   ON cards (game, code);
-- Trigram index para búsqueda fuzzy por nombre (e.g. "lightning bolt" → Lightning Bolt)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_cards_name_trgm   ON cards USING gin (name gin_trgm_ops);

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede LEER el catálogo
CREATE POLICY "cards: read all"
  ON cards FOR SELECT
  USING (true);

-- Cualquier usuario autenticado puede INSERTAR cartas nuevas (se auto-creates
-- durante el import de un deck). created_by debe matchear el caller.
CREATE POLICY "cards: insert authenticated"
  ON cards FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Solo admins/owner pueden ACTUALIZAR/borrar cartas (image_url, verified, etc.)
CREATE POLICY "cards: update admin"
  ON cards FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR p.is_owner = true)
  ));

CREATE POLICY "cards: delete admin"
  ON cards FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND (p.role = 'admin' OR p.is_owner = true)
  ));


-- ── decks — biblioteca personal del usuario ─────────────────────────
CREATE TABLE IF NOT EXISTS decks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game        text NOT NULL,
  name        text NOT NULL,            -- 'Luffy Aggro', 'Mono Red Burn', etc.
  format      text,                     -- 'Standard', 'Commander', 'OP01-OP15', etc. — opcional
  -- list: array de { code, qty, name, sideboard? }
  --   ej. [
  --     { "code": "OP01-001", "qty": 4, "name": "Monkey D. Luffy" },
  --     { "code": "OP01-013", "qty": 4, "name": "Roronoa Zoro" },
  --     { "code": "OP01-006", "qty": 2, "name": "Nami", "sideboard": true }
  --   ]
  list        jsonb NOT NULL DEFAULT '[]'::jsonb,
  card_count  integer NOT NULL DEFAULT 0,       -- suma de qty (excluye sideboard)
  -- Visibility — privado por default. 'public' = visible para todos (perfil ajeno).
  -- 'tournament' = solo visible para el organizer del torneo al que está adjuntado.
  visibility  text NOT NULL DEFAULT 'private'
                CHECK (visibility IN ('private', 'public', 'tournament')),
  notes       text,                              -- nota libre del owner
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decks_user_id    ON decks (user_id);
CREATE INDEX IF NOT EXISTS idx_decks_game       ON decks (game);
CREATE INDEX IF NOT EXISTS idx_decks_visibility ON decks (visibility);

ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

-- Owner ve siempre sus decks. Decks public son visibles para todos.
-- Decks tournament son visibles solo via la integración del torneo (Fase 3).
CREATE POLICY "decks: read own or public"
  ON decks FOR SELECT
  USING (
    user_id = auth.uid()
    OR visibility = 'public'
  );

-- Solo el owner puede crear sus decks
CREATE POLICY "decks: insert own"
  ON decks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Solo el owner puede editar
CREATE POLICY "decks: update own"
  ON decks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Solo el owner puede borrar
CREATE POLICY "decks: delete own"
  ON decks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION decks_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_decks_updated_at ON decks;
CREATE TRIGGER trg_decks_updated_at
  BEFORE UPDATE ON decks
  FOR EACH ROW EXECUTE FUNCTION decks_touch_updated_at();


-- ── upsert_cards_batch — usado durante el import del deck ──────────
-- Toma un array de { game, code, name } y para cada uno:
--   - Si (game, code) ya existe → no hace nada
--   - Si no existe → INSERT con created_by = caller
-- Retorna las rows resultantes (las que ya existían + las nuevas)
-- así el frontend puede mostrarlas con cualquier metadata adicional
-- (image_url) si ya estaba guardada de un import anterior.
CREATE OR REPLACE FUNCTION upsert_cards_batch(p_cards jsonb)
RETURNS SETOF cards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card jsonb;
  v_uid  uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Insert cualquier carta nueva, ignorando duplicates (game, code)
  FOR v_card IN SELECT * FROM jsonb_array_elements(p_cards)
  LOOP
    INSERT INTO cards (game, code, name, created_by)
    VALUES (
      v_card->>'game',
      v_card->>'code',
      COALESCE(v_card->>'name', v_card->>'code'),
      v_uid
    )
    ON CONFLICT (game, code) DO NOTHING;
  END LOOP;

  -- Retornar todas las cartas mencionadas (para que el frontend hidrate)
  RETURN QUERY
    SELECT c.* FROM cards c
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_cards) elt
      WHERE elt->>'game' = c.game AND elt->>'code' = c.code
    );
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_cards_batch(jsonb) TO authenticated;
