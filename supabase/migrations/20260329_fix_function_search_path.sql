-- Fix security warning: function_search_path_mutable
-- Add SET search_path = public to all SECURITY DEFINER functions
-- Prevents search_path injection attacks

-- ── place_bid ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.place_bid(
  p_auction_id uuid,
  p_user_id    uuid,
  p_amount     numeric
) RETURNS numeric
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_auction    public.auctions;
  v_max_bid    numeric;
  v_end_time   timestamptz;
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
  VALUES (p_auction_id, p_user_id, p_amount);

  RETURN p_amount;
END;
$$;

-- ── end_auction ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.end_auction(p_auction_id uuid)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_auction  public.auctions;
  v_top_bid  public.auction_bids;
  v_end_time timestamptz;
BEGIN
  SELECT * INTO v_auction FROM public.auctions
  WHERE id = p_auction_id FOR UPDATE;

  IF NOT FOUND OR v_auction.status IN ('ended', 'cancelled') THEN
    RETURN;
  END IF;

  v_end_time := v_auction.start_time + (v_auction.duration_seconds || ' seconds')::interval;

  IF NOW() < v_end_time THEN RETURN; END IF;

  -- Get top bid
  SELECT * INTO v_top_bid
  FROM public.auction_bids
  WHERE auction_id = p_auction_id
  ORDER BY amount DESC
  LIMIT 1;

  IF v_top_bid.id IS NOT NULL AND v_top_bid.amount >= v_auction.min_bid THEN
    -- Winner found
    UPDATE public.auctions SET
      status         = 'ended',
      winner_id      = v_top_bid.user_id,
      winning_amount = v_top_bid.amount
    WHERE id = p_auction_id;

    -- Notify winner
    INSERT INTO public.notifications (user_id, type, title, body, meta)
    VALUES (
      v_top_bid.user_id,
      'auction_won',
      '🏆 ¡Ganaste la subasta!',
      'Ganaste "' || v_auction.title || '" por $' || v_top_bid.amount::text,
      jsonb_build_object(
        'auctionId',  p_auction_id,
        'amount',     v_top_bid.amount,
        'title',      v_auction.title,
        'imageUrl',   v_auction.image_url
      )
    );

    -- Notify all admins
    INSERT INTO public.notifications (user_id, type, title, body, meta)
    SELECT
      p.id,
      'auction_ended',
      '🔨 Subasta finalizada',
      '"' || v_auction.title || '" vendida por $' || v_top_bid.amount::text,
      jsonb_build_object(
        'auctionId',  p_auction_id,
        'amount',     v_top_bid.amount,
        'winnerId',   v_top_bid.user_id,
        'title',      v_auction.title,
        'imageUrl',   v_auction.image_url
      )
    FROM public.profiles p
    WHERE p.role = 'admin';

  ELSE
    -- No valid bids — item not sold
    UPDATE public.auctions SET status = 'cancelled' WHERE id = p_auction_id;
  END IF;
END;
$$;

-- ── notify_auction_watchers ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_auction_watchers(p_auction_id uuid)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_auction public.auctions;
BEGIN
  SELECT * INTO v_auction FROM public.auctions
  WHERE id = p_auction_id FOR UPDATE;

  IF NOT FOUND OR v_auction.notified_watchers THEN RETURN; END IF;

  UPDATE public.auctions SET notified_watchers = true WHERE id = p_auction_id;

  INSERT INTO public.notifications (user_id, type, title, body, meta)
  SELECT
    w.user_id,
    'auction_live',
    '🔨 Subasta en vivo ahora',
    '"' || v_auction.title || '" está en subasta — ¡entra a pujar!',
    jsonb_build_object('auctionId', p_auction_id, 'title', v_auction.title, 'imageUrl', v_auction.image_url)
  FROM public.auction_watches w
  WHERE w.auction_id = p_auction_id
    AND w.user_id != COALESCE(v_auction.created_by, '00000000-0000-0000-0000-000000000000'::uuid);
END;
$$;

-- ── get_game_leaderboard ──────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS get_game_leaderboard(text, text);

CREATE OR REPLACE FUNCTION public.get_game_leaderboard(p_game text, p_branch text DEFAULT NULL)
RETURNS TABLE (
  id         uuid,
  username   text,
  avatar_url text,
  branch     text,
  verified   boolean,
  role       text,
  is_owner   boolean,
  points     bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.username,
    pr.avatar_url,
    pr.branch::text,
    pr.verified,
    pr.role::text,
    pr.is_owner,
    SUM(
      CASE rc.position
        WHEN 1 THEN 3
        WHEN 2 THEN 2
        WHEN 3 THEN 1
        ELSE 1
      END
    )::bigint AS points
  FROM ranking_claims rc
  JOIN profiles pr ON pr.id = rc.user_id
  WHERE rc.status = 'approved'
    AND rc.game   = p_game
    AND (p_branch IS NULL OR rc.branch::text = p_branch)
  GROUP BY pr.id, pr.username, pr.avatar_url, pr.branch, pr.verified, pr.role, pr.is_owner
  ORDER BY points DESC
  LIMIT 50;
END;
$$;
