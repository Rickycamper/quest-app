-- Set absavelcig@gmail.com as admin scoped to Chitre branch
UPDATE profiles
SET role = 'admin', branch = 'Chitre'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'absavelcig@gmail.com'
);
