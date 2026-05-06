-- Fix: grant EXECUTE on get_game_leaderboard to anon + authenticated
-- Without this, filtering by branch throws "permission denied for function"

GRANT EXECUTE ON FUNCTION public.get_game_leaderboard(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_game_leaderboard(text, text) TO authenticated;
