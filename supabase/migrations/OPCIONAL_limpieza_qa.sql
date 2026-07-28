-- ═══════════════════════════════════════════════════════════
-- OPCIONAL — borra los datos de prueba que quedaron del diagnóstico.
-- No hace falta para que la app funcione: es solo higiene.
-- Correr APARTE de AAA_CORRER_ESTE.sql, línea por línea si querés.
-- ═══════════════════════════════════════════════════════════

-- Mensajes de prueba del chat de comunidad
DELETE FROM public.community_messages WHERE author_name IN ('__probe__', 'TesterQA');

-- Post de prueba del diagnóstico
DELETE FROM public.posts WHERE caption = '[QA] prueba diagnostico';

-- Cuentas de prueba. OJO: si esto da el error de storage
-- ("Direct deletion from storage tables is not allowed"), salteá esta
-- línea — son 4 cuentas inertes que no molestan. También se pueden
-- borrar desde el panel: Authentication → Users.
DELETE FROM auth.users
 WHERE email LIKE 'qa.claude.p%.20260720@gmail.com'
    OR email = 'qa.claude.prueba.20260720@gmail.com';

-- El .txt de prueba en Storage → chat → MTG/test/ se borra desde el panel
-- (Supabase no permite borrar archivos por SQL).
