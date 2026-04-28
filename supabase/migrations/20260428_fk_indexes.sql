-- ─────────────────────────────────────────────
-- QUEST — Add missing indexes on foreign key columns
--
-- PostgreSQL does not auto-create indexes on FK columns (only the
-- referenced side gets one). Without these, any DELETE/UPDATE on
-- profiles/users cascades into a full sequential scan on every
-- child table, and JOINs on these columns skip index lookups.
-- ─────────────────────────────────────────────

-- auction_bids
CREATE INDEX IF NOT EXISTS idx_auction_bids_user_id
  ON public.auction_bids (user_id);

-- auction_chat
CREATE INDEX IF NOT EXISTS idx_auction_chat_user_id
  ON public.auction_chat (user_id);

-- auction_watches
CREATE INDEX IF NOT EXISTS idx_auction_watches_user_id
  ON public.auction_watches (user_id);

-- auctions
CREATE INDEX IF NOT EXISTS idx_auctions_created_by
  ON public.auctions (created_by);

CREATE INDEX IF NOT EXISTS idx_auctions_winner_id
  ON public.auctions (winner_id);

-- h2h_resets
CREATE INDEX IF NOT EXISTS idx_h2h_resets_initiator_id
  ON public.h2h_resets (initiator_id);

CREATE INDEX IF NOT EXISTS idx_h2h_resets_opponent_id
  ON public.h2h_resets (opponent_id);

-- matches
CREATE INDEX IF NOT EXISTS idx_matches_logged_by
  ON public.matches (logged_by);

CREATE INDEX IF NOT EXISTS idx_matches_player_b
  ON public.matches (player_b);

CREATE INDEX IF NOT EXISTS idx_matches_winner_id
  ON public.matches (winner_id);

-- membership_usage
CREATE INDEX IF NOT EXISTS idx_membership_usage_user_id
  ON public.membership_usage (user_id);

CREATE INDEX IF NOT EXISTS idx_membership_usage_recorded_by
  ON public.membership_usage (recorded_by);

-- messages
CREATE INDEX IF NOT EXISTS idx_messages_sender_id
  ON public.messages (sender_id);

-- package_events
CREATE INDEX IF NOT EXISTS idx_package_events_updated_by
  ON public.package_events (updated_by);

-- package_items
CREATE INDEX IF NOT EXISTS idx_package_items_package_id
  ON public.package_items (package_id);

-- packages
CREATE INDEX IF NOT EXISTS idx_packages_created_by
  ON public.packages (created_by);

-- post_comments
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id
  ON public.post_comments (user_id);

-- q_points_log
CREATE INDEX IF NOT EXISTS idx_q_points_log_user_id
  ON public.q_points_log (user_id);

-- ranking_claims
CREATE INDEX IF NOT EXISTS idx_ranking_claims_reviewed_by
  ON public.ranking_claims (reviewed_by);

CREATE INDEX IF NOT EXISTS idx_ranking_claims_season_id
  ON public.ranking_claims (season_id);

CREATE INDEX IF NOT EXISTS idx_ranking_claims_tournament_id
  ON public.ranking_claims (tournament_id);

-- ranking_entries
CREATE INDEX IF NOT EXISTS idx_ranking_entries_user_id
  ON public.ranking_entries (user_id);

-- season_snapshots
CREATE INDEX IF NOT EXISTS idx_season_snapshots_user_id
  ON public.season_snapshots (user_id);

-- shop_reservations
CREATE INDEX IF NOT EXISTS idx_shop_reservations_user_id
  ON public.shop_reservations (user_id);

CREATE INDEX IF NOT EXISTS idx_shop_reservations_product_id
  ON public.shop_reservations (product_id);

CREATE INDEX IF NOT EXISTS idx_shop_reservations_created_by
  ON public.shop_reservations (created_by);

-- stories
CREATE INDEX IF NOT EXISTS idx_stories_user_id
  ON public.stories (user_id);

-- tournaments
CREATE INDEX IF NOT EXISTS idx_tournaments_created_by
  ON public.tournaments (created_by);

CREATE INDEX IF NOT EXISTS idx_tournaments_season_id
  ON public.tournaments (season_id);
