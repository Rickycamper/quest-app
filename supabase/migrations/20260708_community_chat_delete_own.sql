-- ─────────────────────────────────────────────
-- QUEST — Chat de comunidad: borrar mensajes propios (incluye invitados)
-- ─────────────────────────────────────────────
-- El autor logueado ya puede borrar por RLS, pero el invitado se identifica
-- por un guest_id que vive en su localStorage (RLS no lo puede validar). Esta
-- función SECURITY DEFINER valida la propiedad (logueado O invitado) o staff,
-- y borra. Aplicar en Supabase → SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_community_message(p_id uuid, p_guest_id text DEFAULT NULL)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.community_messages;
BEGIN
  SELECT * INTO v_row FROM public.community_messages WHERE id = p_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF public.is_staff()
     OR (v_row.user_id IS NOT NULL AND v_row.user_id = auth.uid())
     OR (v_row.user_id IS NULL AND p_guest_id IS NOT NULL AND v_row.guest_id = p_guest_id)
  THEN
    DELETE FROM public.community_messages WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.delete_community_message(uuid, text) TO anon, authenticated;
