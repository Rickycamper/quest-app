-- ─────────────────────────────────────────────
-- QUEST — Card Image Enrichment
-- ─────────────────────────────────────────────
-- Permite a cualquier usuario autenticado escribir image_url +
-- set_code + card_number + rarity en deck_cards via un RPC
-- SECURITY DEFINER. El RPC valida que la URL venga de un dominio
-- trusted (Scryfall, pokemontcg.io, digimoncard.io) para evitar
-- que alguien inyecte URLs maliciosas como image_url.

CREATE OR REPLACE FUNCTION set_deck_card_image(
  p_game        text,
  p_code        text,
  p_image_url   text,
  p_set_code    text DEFAULT NULL,
  p_card_number text DEFAULT NULL,
  p_rarity      text DEFAULT NULL,
  p_name        text DEFAULT NULL    -- opcional: overwrite name si vino más limpio del API
)
RETURNS deck_cards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card deck_cards;
  v_uid  uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Whitelist de dominios trusted. Si la image_url no matchea, rechazamos.
  IF p_image_url IS NOT NULL AND p_image_url <> '' THEN
    IF p_image_url NOT LIKE 'https://cards.scryfall.io/%'
       AND p_image_url NOT LIKE 'https://c1.scryfall.com/%'
       AND p_image_url NOT LIKE 'https://c2.scryfall.com/%'
       AND p_image_url NOT LIKE 'https://images.pokemontcg.io/%'
       AND p_image_url NOT LIKE 'https://assets.pokemon.com/%'
       AND p_image_url NOT LIKE 'https://images.digimoncard.io/%'
       AND p_image_url NOT LIKE 'https://digimoncard.io/%'
       AND p_image_url NOT LIKE 'https://en.onepiece-cardgame.com/%'
       AND p_image_url NOT LIKE 'https://asia-en.onepiece-cardgame.com/%'
    THEN
      RAISE EXCEPTION 'untrusted image url: %', p_image_url;
    END IF;
  END IF;

  -- Update + return. Solo modifica los campos que el caller pasó.
  -- Mantiene name original si p_name es NULL (no lo sobreescribe).
  UPDATE deck_cards
  SET image_url   = COALESCE(p_image_url,   image_url),
      set_code    = COALESCE(p_set_code,    set_code),
      card_number = COALESCE(p_card_number, card_number),
      rarity      = COALESCE(p_rarity,      rarity),
      name        = COALESCE(p_name,        name),
      updated_at  = now()
  WHERE game = p_game AND code = p_code
  RETURNING * INTO v_card;

  IF v_card.id IS NULL THEN
    RAISE EXCEPTION 'card not found: % %', p_game, p_code;
  END IF;

  RETURN v_card;
END;
$$;

GRANT EXECUTE ON FUNCTION set_deck_card_image(text, text, text, text, text, text, text) TO authenticated;
