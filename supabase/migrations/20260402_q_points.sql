-- ─────────────────────────────────────────────
-- QUEST — Q Points System
-- 1000 pts = $1 store credit
-- ─────────────────────────────────────────────

-- Add q_points balance to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS q_points integer NOT NULL DEFAULT 0;

-- Full history of every points event (earn/spend)
CREATE TABLE IF NOT EXISTS q_points_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount     integer NOT NULL,          -- positive = earned, negative = spent
  reason     text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE q_points_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own log" ON q_points_log
  FOR SELECT USING (auth.uid() = user_id);

-- Redemption requests (user asks to convert pts → store credit)
CREATE TABLE IF NOT EXISTS q_redemptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points      integer NOT NULL CHECK (points >= 1000),
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note  text,
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE q_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own redemptions" ON q_redemptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users insert own redemptions" ON q_redemptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins manage redemptions" ON q_redemptions
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','staff','owner'))
  );

-- ── award_points ────────────────────────────────────────────────────────────
-- Called fire-and-forget from every action that earns points.
-- SECURITY DEFINER so it works from any RLS context.
CREATE OR REPLACE FUNCTION public.award_points(
  p_user_id uuid,
  p_amount   integer,
  p_reason   text
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_amount = 0 THEN RETURN; END IF;
  UPDATE profiles SET q_points = q_points + p_amount WHERE id = p_user_id;
  INSERT INTO q_points_log (user_id, amount, reason)
  VALUES (p_user_id, p_amount, p_reason);
END;
$$;

-- ── redeem_points ───────────────────────────────────────────────────────────
-- User requests redemption. Points deducted immediately; admin approves payout.
CREATE OR REPLACE FUNCTION public.redeem_points(p_points integer)
RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_current  integer;
  v_id       uuid;
BEGIN
  v_user_id := auth.uid();
  SELECT q_points INTO v_current FROM profiles WHERE id = v_user_id;

  IF p_points < 1000 THEN
    RAISE EXCEPTION 'Mínimo de canje es 1000 puntos';
  END IF;
  IF v_current < p_points THEN
    RAISE EXCEPTION 'Puntos insuficientes';
  END IF;

  -- Deduct immediately to prevent double-spend
  UPDATE profiles SET q_points = q_points - p_points WHERE id = v_user_id;
  INSERT INTO q_points_log (user_id, amount, reason)
  VALUES (v_user_id, -p_points, 'Canje solicitado');

  -- Create pending redemption
  INSERT INTO q_redemptions (user_id, points)
  VALUES (v_user_id, p_points)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── approve_redemption ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_redemption(p_id uuid)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE q_redemptions
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_id AND status = 'pending';
END;
$$;

-- ── reject_redemption ────────────────────────────────────────────────────────
-- Refunds points on rejection
CREATE OR REPLACE FUNCTION public.reject_redemption(p_id uuid, p_note text DEFAULT NULL)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_r q_redemptions;
BEGIN
  SELECT * INTO v_r FROM q_redemptions WHERE id = p_id AND status = 'pending';
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE q_redemptions
  SET status = 'rejected', admin_note = p_note,
      reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_id;

  -- Refund
  UPDATE profiles SET q_points = q_points + v_r.points WHERE id = v_r.user_id;
  INSERT INTO q_points_log (user_id, amount, reason)
  VALUES (v_r.user_id, v_r.points, 'Reembolso — canje rechazado');
END;
$$;

-- ── Award points inside end_auction ─────────────────────────────────────────
-- Patch end_auction to give 10 pts to the winner
CREATE OR REPLACE FUNCTION public.end_auction(p_auction_id uuid)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_auction  public.auctions;
  v_top_bid  public.auction_bids;
  v_end_time timestamptz;
  v_admin_id   uuid;
  v_admin_user text;
  v_winner_user text;
  v_conv_id uuid;
BEGIN
  SELECT * INTO v_auction FROM public.auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND OR v_auction.status IN ('ended','cancelled') THEN RETURN; END IF;

  v_end_time := v_auction.start_time + (v_auction.duration_seconds || ' seconds')::interval;
  IF NOW() < v_end_time THEN RETURN; END IF;

  SELECT * INTO v_top_bid FROM public.auction_bids
  WHERE auction_id = p_auction_id ORDER BY amount DESC LIMIT 1;

  IF v_top_bid.id IS NOT NULL AND v_top_bid.amount >= v_auction.min_bid THEN
    UPDATE public.auctions SET
      status = 'ended', winner_id = v_top_bid.user_id, winning_amount = v_top_bid.amount
    WHERE id = p_auction_id;

    -- 10 Q Points to winner
    PERFORM public.award_points(v_top_bid.user_id, 10, 'Ganaste una subasta');

    -- Notify winner
    INSERT INTO public.notifications (user_id, type, title, body, meta)
    VALUES (
      v_top_bid.user_id, 'auction_won', '🏆 ¡Ganaste la subasta!',
      'Ganaste "' || v_auction.title || '" por $' || v_top_bid.amount::text,
      jsonb_build_object('auctionId', p_auction_id, 'amount', v_top_bid.amount,
        'title', v_auction.title, 'imageUrl', v_auction.image_url)
    );

    -- Fetch winner username and first admin
    SELECT username INTO v_winner_user FROM public.profiles WHERE id = v_top_bid.user_id;
    SELECT id, username INTO v_admin_id, v_admin_user
    FROM public.profiles WHERE role IN ('admin','owner') LIMIT 1;

    -- Notify all admins
    INSERT INTO public.notifications (user_id, type, title, body, meta)
    SELECT p.id, 'auction_ended', '🔨 Subasta finalizada',
      '"' || v_auction.title || '" vendida por $' || v_top_bid.amount::text,
      jsonb_build_object('auctionId', p_auction_id, 'amount', v_top_bid.amount,
        'winnerId', v_top_bid.user_id, 'winnerUsername', v_winner_user,
        'title', v_auction.title, 'imageUrl', v_auction.image_url)
    FROM public.profiles p WHERE p.role IN ('admin','owner');

    -- Auto-DM from admin to winner
    IF v_admin_id IS NOT NULL THEN
      INSERT INTO public.conversations (user_a, user_b)
      VALUES (LEAST(v_admin_id, v_top_bid.user_id), GREATEST(v_admin_id, v_top_bid.user_id))
      ON CONFLICT (user_a, user_b) DO UPDATE SET updated_at = now()
      RETURNING id INTO v_conv_id;

      IF v_conv_id IS NULL THEN
        SELECT id INTO v_conv_id FROM public.conversations
        WHERE user_a = LEAST(v_admin_id, v_top_bid.user_id)
          AND user_b = GREATEST(v_admin_id, v_top_bid.user_id);
      END IF;

      INSERT INTO public.messages (conversation_id, sender_id, content)
      VALUES (v_conv_id, v_admin_id,
        '¡Felicidades! Ganaste ' || v_auction.title || ' por $' || v_top_bid.amount::text ||
        '. Coordinaremos el pago y la entrega contigo. ¡Gracias por participar! 🏆');

      UPDATE public.conversations SET updated_at = now() WHERE id = v_conv_id;
    END IF;

  ELSE
    UPDATE public.auctions SET status = 'cancelled' WHERE id = p_auction_id;
  END IF;
END;
$$;
