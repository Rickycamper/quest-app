-- Limpieza de mensajes de prueba + asegurar realtime del chat de comunidad.
-- Correr una vez en Supabase → SQL Editor. Idempotente.

-- 1) Borra los mensajes de prueba que dejó QA en la sala MTG
DELETE FROM public.community_messages
WHERE author_name IN ('__probe__', 'TesterQA');

-- 2) Borra el archivo de prueba del bucket 'chat'
DELETE FROM storage.objects
WHERE bucket_id = 'chat' AND name LIKE 'MTG/test/%';

-- 3) Asegura que la tabla esté en la publicación de realtime (para que los
--    mensajes aparezcan en vivo sin refrescar). Si ya estaba, no hace nada.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
