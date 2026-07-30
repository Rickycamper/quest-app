-- ─────────────────────────────────────────────
-- QUEST — WhatsApp del destinatario en envíos entre tiendas
-- ─────────────────────────────────────────────
-- Para avisarle a quien recibe cuando el paquete queda en la tienda origen
-- y cuando llega a destino, hace falta un teléfono. Hoy el destinatario es
-- un perfil (recipient_id) y su teléfono es PII: 20260510_pii_lockdown.sql
-- cerró la lectura para anónimos y dejó pendiente cerrarla para usuarios
-- logueados. Mostrarle a un usuario el teléfono de otro haría imposible ese
-- cierre, así que:
--
--   · el REMITENTE puede CARGAR un teléfono (no leer el del destinatario),
--   · solo el EQUIPO puede LEERLO, vía una función que además cae al
--     teléfono del perfil del destinatario cuando el remitente no cargó nada.
--
-- No se toca create_package_as_user(): su cuerpo no está en el repo (prod
-- está desincronizado de supabase/migrations) y recrearla a ciegas se
-- llevaría puesta la generación del tracking_code y los eventos. En su lugar
-- se agrega una función chica y dedicada.
--
-- Aplicar en SQL Editor. Idempotente.
-- ─────────────────────────────────────────────

ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS recipient_phone text;

-- ── Cargar el teléfono ────────────────────────
-- Lo puede hacer el remitente (es quien conoce al destinatario) o el equipo.
-- Se bloquea una vez retirado: a esa altura ya no hay a quién avisarle y
-- editarlo solo serviría para ensuciar el registro.
CREATE OR REPLACE FUNCTION public.set_package_recipient_phone(
  p_package_id uuid,
  p_phone      text
)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sender uuid;
  v_status text;
BEGIN
  SELECT sender_id, status INTO v_sender, v_status
    FROM public.packages WHERE public.packages.id = p_package_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paquete no encontrado'; END IF;

  IF NOT (v_sender = auth.uid() OR public.is_staff()) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF v_status = 'delivered' THEN
    RAISE EXCEPTION 'El paquete ya fue retirado';
  END IF;

  UPDATE public.packages
     SET recipient_phone = nullif(btrim(coalesce(p_phone, '')), '')
   WHERE public.packages.id = p_package_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.set_package_recipient_phone(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_package_recipient_phone(uuid, text) TO authenticated;

-- ── Leerlo (solo equipo) ──────────────────────
-- Devuelve el que cargó el remitente y, si no hay, el del perfil del
-- destinatario. Es SECURITY DEFINER a propósito: así el teléfono del perfil
-- nunca se expone por REST y el cierre pendiente del PII lockdown sigue
-- siendo posible.
CREATE OR REPLACE FUNCTION public.get_package_recipient_phone(p_package_id uuid)
RETURNS text
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_recipient uuid;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'No autorizado'; END IF;

  SELECT recipient_phone, recipient_id INTO v_phone, v_recipient
    FROM public.packages WHERE public.packages.id = p_package_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paquete no encontrado'; END IF;

  IF v_phone IS NOT NULL AND btrim(v_phone) <> '' THEN
    RETURN v_phone;
  END IF;

  IF v_recipient IS NOT NULL THEN
    SELECT phone INTO v_phone FROM public.profiles
      WHERE public.profiles.id = v_recipient;
    RETURN nullif(btrim(coalesce(v_phone, '')), '');
  END IF;

  RETURN NULL;
END $$;

REVOKE EXECUTE ON FUNCTION public.get_package_recipient_phone(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_package_recipient_phone(uuid) TO authenticated;

-- ─────────────────────────────────────────────
-- Comprobación: las dos funciones deben existir y NO ser ejecutables por anon.
-- ─────────────────────────────────────────────
SELECT p.proname,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS puede_anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS puede_authenticated
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('set_package_recipient_phone', 'get_package_recipient_phone');
