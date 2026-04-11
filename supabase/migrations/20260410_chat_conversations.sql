-- ─────────────────────────────────────────────
-- QUEST — Chat: conversations + messages
-- Direct messages between any two users
-- ─────────────────────────────────────────────

-- Conversations: one row per unique user pair
CREATE TABLE IF NOT EXISTS public.conversations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_a, user_b),
  CONSTRAINT no_self_chat CHECK (user_a <> user_b)
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body            text        NOT NULL CHECK (char_length(body) <= 1000),
  read            boolean     DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS conversations_user_a_idx ON public.conversations (user_a);
CREATE INDEX IF NOT EXISTS conversations_user_b_idx ON public.conversations (user_b);
CREATE INDEX IF NOT EXISTS messages_conv_time_idx   ON public.messages (conversation_id, created_at);

-- Keep conversations.updated_at fresh on new message
CREATE OR REPLACE FUNCTION public.touch_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_conversation_trg ON public.messages;
CREATE TRIGGER touch_conversation_trg
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_conversation();

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;

-- Participants can read their own conversations
DROP POLICY IF EXISTS "participants_select_conversations" ON public.conversations;
CREATE POLICY "participants_select_conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Any authenticated user can create a conversation they're part of
DROP POLICY IF EXISTS "participants_insert_conversations" ON public.conversations;
CREATE POLICY "participants_insert_conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

-- Participants can read messages in their conversations
DROP POLICY IF EXISTS "participants_read_messages" ON public.messages;
CREATE POLICY "participants_read_messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

-- Sender can insert messages in their conversations
DROP POLICY IF EXISTS "sender_insert_messages" ON public.messages;
CREATE POLICY "sender_insert_messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

-- Participant can mark messages as read
DROP POLICY IF EXISTS "participant_update_read" ON public.messages;
CREATE POLICY "participant_update_read" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
