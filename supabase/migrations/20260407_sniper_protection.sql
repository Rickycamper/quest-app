-- ─────────────────────────────────────────────────────────────────────────────
-- QUEST — Sniper protection for auctions
-- If a bid is placed in the last 10 seconds, extend duration by 5 seconds.
-- Returns jsonb: { amount, sniped, duration_seconds }
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop old version (returned numeric) so we can change the return type to jsonb
DROP FUNCTION IF EXISTS public.place_bid(uuid, uuid, numeric);

CREATE OR REPLACE FUNCTION public.place_bid(
  p_auction_id uuid,
  p_user_id    uuid,
  p_amount     numeric
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_auction  public.auctions;
  v_max_bid  numeric;
  v_end_time timestamptz;
  v_sniped   boolean := false;
  v_new_dur  integer;
BEGIN
  -- Lock the row so concurrent bids don't race
  SELECT * INTO v_auction FROM public.auctions
  WHERE id = p_auction_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subasta no encontrada';
  END IF;

  v_end_time := v_auction.start_time + (v_auction.duration_seconds || ' seconds')::interval;

  IF v_auction.status IN ('ended', 'cancelled') THEN
    RAISE EXCEPTION 'La subasta ya terminó';
  END IF;

  IF NOW() < v_auction.start_time THEN
    RAISE EXCEPTION 'La subasta no ha comenzado aún';
  END IF;

  IF NOW() > v_end_time THEN
    RAISE EXCEPTION 'La subasta ha terminado';
  END IF;

  SELECT COALESCE(MAX(amount), 0) INTO v_max_bid
  FROM public.auction_bids WHERE auction_id = p_auction_id;

  IF p_amount < v_auction.min_bid THEN
    RAISE EXCEPTION 'El bid mínimo es $%.2f', v_auction.min_bid;
  END IF;

  IF p_amount <= v_max_bid THEN
    RAISE EXCEPTION 'Debe superar el bid actual de $%.2f', v_max_bid;
  END IF;

  -- Insert the bid
  INSERT INTO public.auction_bids (auction_id, user_id, amount)
  VALUES (p_auction_id, p_user_id, p_amount);

  -- ── Sniper protection ──────────────────────────────────────────────────────
  -- Bid placed in the last 10 seconds → extend by 5 seconds
  IF (v_end_time - NOW()) <= interval '10 seconds' THEN
    v_new_dur := v_auction.duration_seconds + 5;
    UPDATE public.auctions
    SET duration_seconds = v_new_dur
    WHERE id = p_auction_id;
    v_sniped := true;
  ELSE
    v_new_dur := v_auction.duration_seconds;
  END IF;

  RETURN jsonb_build_object(
    'amount',           p_amount,
    'sniped',           v_sniped,
    'duration_seconds', v_new_dur
  );
END;
$$;
