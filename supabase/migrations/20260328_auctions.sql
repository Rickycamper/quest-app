-- ─────────────────────────────────────────────
-- QUEST — Auctions system
-- ─────────────────────────────────────────────

-- Main auction table
CREATE TABLE IF NOT EXISTS public.auctions (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title            text        NOT NULL,
  game             text,
  image_url        text        NOT NULL,
  min_bid          numeric(10,2) NOT NULL DEFAULT 1.00,
  start_time       timestamptz NOT NULL,
  duration_seconds int         NOT NULL DEFAULT 300,
  status           text        NOT NULL DEFAULT 'pending',
  winner_id        uuid        REFERENCES auth.users(id),
  winning_amount   numeric(10,2),
  notified_watchers boolean    NOT NULL DEFAULT false,
  created_by       uuid        REFERENCES auth.users(id),
  created_at       timestamptz DEFAULT now()
);

-- Bids
CREATE TABLE IF NOT EXISTS public.auction_bids (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id  uuid        NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      numeric(10,2) NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- Watch / notify-me
CREATE TABLE IF NOT EXISTS public.auction_watches (
  auction_id  uuid  NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id     uuid  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (auction_id, user_id)
);

-- Live chat
CREATE TABLE IF NOT EXISTS public.auction_chat (
  id          uuid  DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id  uuid  NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  user_id     uuid  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message     text  NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS auction_bids_auction_id_idx   ON public.auction_bids(auction_id);
CREATE INDEX IF NOT EXISTS auction_bids_amount_desc_idx  ON public.auction_bids(auction_id, amount DESC);
CREATE INDEX IF NOT EXISTS auction_chat_auction_id_idx   ON public.auction_chat(auction_id, created_at);
CREATE INDEX IF NOT EXISTS auctions_start_time_idx       ON public.auctions(start_time DESC);

-- ── RLS ──────────────────────────────────────
ALTER TABLE public.auctions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_chat   ENABLE ROW LEVEL SECURITY;

-- Auctions: everyone can read
CREATE POLICY "auctions_read_all" ON public.auctions
  FOR SELECT USING (true);

-- Auctions: only admin/staff can insert
CREATE POLICY "auctions_insert_staff" ON public.auctions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin','staff'))
  );

-- Auctions: only admin can update
CREATE POLICY "auctions_update_admin" ON public.auctions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Bids: everyone can read
CREATE POLICY "auction_bids_read_all" ON public.auction_bids
  FOR SELECT USING (true);

-- Bids: authenticated users can insert (validated by RPC)
CREATE POLICY "auction_bids_insert_auth" ON public.auction_bids
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Watches: user manages own
CREATE POLICY "auction_watches_all" ON public.auction_watches
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "auction_watches_read_all" ON public.auction_watches
  FOR SELECT USING (true);

-- Chat: everyone can read
CREATE POLICY "auction_chat_read_all" ON public.auction_chat
  FOR SELECT USING (true);

-- Chat: authenticated users can insert
CREATE POLICY "auction_chat_insert_auth" ON public.auction_chat
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── RPCs ─────────────────────────────────────

-- place_bid: atomic bid placement with validation
CREATE OR REPLACE FUNCTION public.place_bid(
  p_auction_id uuid,
  p_user_id    uuid,
  p_amount     numeric
) RETURNS numeric
  LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- end_auction: idempotent — called by client when timer expires
CREATE OR REPLACE FUNCTION public.end_auction(p_auction_id uuid)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_auction        public.auctions;
  v_top_bid        public.auction_bids;
  v_end_time       timestamptz;
  v_winner_username text;
  v_admin_id       uuid;
  v_admin_username text;
  v_conv_id        uuid;
  v_existing_conv  uuid;
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

    -- Fetch winner username
    SELECT username INTO v_winner_username
    FROM public.profiles WHERE id = v_top_bid.user_id;

    -- Fetch first admin (for DM + meta)
    SELECT id, username INTO v_admin_id, v_admin_username
    FROM public.profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1;

    -- ── Auto-DM from admin to winner ─────────────────────────────────────────
    -- Get or create conversation (canonical ordering: smaller UUID first)
    SELECT id INTO v_existing_conv
    FROM public.conversations
    WHERE (user_a = LEAST(v_admin_id, v_top_bid.user_id)
       AND user_b = GREATEST(v_admin_id, v_top_bid.user_id))
    LIMIT 1;

    IF v_existing_conv IS NULL THEN
      v_conv_id := gen_random_uuid();
      INSERT INTO public.conversations (id, user_a, user_b)
      VALUES (
        v_conv_id,
        LEAST(v_admin_id, v_top_bid.user_id),
        GREATEST(v_admin_id, v_top_bid.user_id)
      );
    ELSE
      v_conv_id := v_existing_conv;
    END IF;

    INSERT INTO public.messages (conversation_id, sender_id, body)
    VALUES (
      v_conv_id,
      v_admin_id,
      '🏆 ¡Felicidades! Ganaste "' || v_auction.title || '" por $' || v_top_bid.amount::text || E'.\n\nCoordinaremos contigo el pago y la logística de entrega. ¡Gracias por participar en Quest!'
    );

    -- Notify winner — includes adminId so clicking the notification opens the DM
    INSERT INTO public.notifications (user_id, type, title, body, meta)
    VALUES (
      v_top_bid.user_id,
      'auction_won',
      '🏆 ¡Ganaste la subasta!',
      'Ganaste "' || v_auction.title || '" por $' || v_top_bid.amount::text || ' — te escribimos para coordinar el pago 💬',
      jsonb_build_object(
        'auctionId',      p_auction_id,
        'amount',         v_top_bid.amount,
        'title',          v_auction.title,
        'imageUrl',       v_auction.image_url,
        'adminId',        v_admin_id,
        'adminUsername',  v_admin_username
      )
    );

    -- Notify all admins — includes winnerId + winnerUsername so clicking opens the DM
    INSERT INTO public.notifications (user_id, type, title, body, meta)
    SELECT
      p.id,
      'auction_ended',
      '🔨 Subasta finalizada',
      '"' || v_auction.title || '" vendida a @' || v_winner_username || ' por $' || v_top_bid.amount::text || ' — toca para escribirle 💬',
      jsonb_build_object(
        'auctionId',       p_auction_id,
        'amount',          v_top_bid.amount,
        'winnerId',        v_top_bid.user_id,
        'winnerUsername',  v_winner_username,
        'title',           v_auction.title,
        'imageUrl',        v_auction.image_url
      )
    FROM public.profiles p
    WHERE p.role = 'admin';

  ELSE
    -- No valid bids — item not sold (lock stays locked)
    UPDATE public.auctions SET status = 'cancelled' WHERE id = p_auction_id;
  END IF;
END;
$$;

-- notify_auction_watchers: called when auction goes live (idempotent via notified_watchers flag)
CREATE OR REPLACE FUNCTION public.notify_auction_watchers(p_auction_id uuid)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER AS $$
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
