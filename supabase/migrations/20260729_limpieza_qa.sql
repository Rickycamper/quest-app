-- Limpieza de las cuentas de prueba que se crearon al diagnosticar el
-- registro. Correr una vez en Supabase → SQL Editor. Borrar el usuario de
-- auth cascadea a su perfil.
DELETE FROM auth.users
 WHERE email LIKE 'qa.signup.%@gmail.com'
    OR email LIKE 'qa.claude.p%.20260720@gmail.com'
    OR email = 'qa.claude.prueba.20260720@gmail.com';
