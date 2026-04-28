-- ─────────────────────────────────────────────
-- QUEST — Fix two regression crashes from security migration
--
-- 1) redeem_points was not re-granted after REVOKE ON ALL FUNCTIONS FROM PUBLIC
--    → any user trying to redeem Q Points got "permission denied"
--
-- 2) place_bid overload ambiguity → 08P01 "protocol_violation"
--    Migrations created place_bid(uuid, uuid, numeric) (3-param, with explicit
--    p_user_id) on top of the existing place_bid(uuid, numeric) (2-param, uses
--    auth.uid() internally). PostgREST cannot resolve which overload to use and
--    throws 08P01 for ALL calls to place_bid — which cascades to any screen
--    that also happens to call another function on the same round-trip.
--    Fix: drop the 3-param legacy overload; keep only the 2-param version.
-- ─────────────────────────────────────────────

-- ── 1. Grant redeem_points to authenticated (was missing) ─────────────────────
DO $$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.redeem_points(integer) TO authenticated';
EXCEPTION
  WHEN undefined_function THEN NULL;
  WHEN undefined_object   THEN NULL;
END $$;

-- ── 2. Drop legacy 3-param place_bid overloads ────────────────────────────────
-- These were created by 20260328_auctions.sql, 20260329_fix_function_search_path.sql,
-- and 20260407_sniper_protection.sql. If they coexist with the 2-param version
-- already in the DB, PostgREST throws 08P01 on every place_bid call.
DROP FUNCTION IF EXISTS public.place_bid(uuid, uuid, numeric);

-- ── 3. Ensure the canonical 2-param place_bid exists with sniper protection ───
-- Uses auth.uid() internally — no need to pass user id as a parameter.
-- Returns jsonb: { amount, sniped, duration_seconds }
CREATE OR REPLACE FUNCTION public.place_bid(
  p_auction_id uuid,
  p_amount     numeric
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_auction  public.auctions;
  v_max_bid  numeric;
  v_end_time timestamptz;
  v_sniped   boolean := false;
  v_new_dur  integer;
BEGIN
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

  INSERT INTO public.auction_bids (auction_id, user_id, amount)
  VALUES (p_auction_id, auth.uid(), p_amount);

  -- Sniper protection: bid in last 10 s → extend by 5 s
  IF (v_end_time - NOW()) <= interval '10 seconds' THEN
    v_new_dur := v_auction.duration_seconds + 5;
    UPDATE public.auctions SET duration_seconds = v_new_dur WHERE id = p_auction_id;
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

REVOKE EXECUTE ON FUNCTION public.place_bid(uuid, numeric) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.place_bid(uuid, numeric) TO authenticated;
