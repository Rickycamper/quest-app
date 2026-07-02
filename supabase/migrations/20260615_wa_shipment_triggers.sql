-- ─────────────────────────────────────────────
-- QUEST — WhatsApp: disparadores de notificación de envíos
-- ─────────────────────────────────────────────
-- Cuando se crea un envío o llega a la sucursal, la base llama (vía pg_net)
-- al endpoint /api/wa-notify, que manda la plantilla de WhatsApp al cliente.
--
-- ⚠️ ANTES DE CORRER: reemplazá  PON_TU_SECRETO_ACA  por un secreto tuyo
--    (el MISMO que pongas en Vercel como env var WA_WEBHOOK_SECRET).
--
-- Los triggers nunca bloquean el insert: si el webhook falla, el envío se
-- crea igual (el error se ignora).
-- ─────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Envío creado (INSERT en packages) ──
CREATE OR REPLACE FUNCTION public.wa_notify_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://questhobbystore.com/api/wa-notify',
    body    := jsonb_build_object('event', 'created', 'package_id', NEW.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-wa-secret', 'PON_TU_SECRETO_ACA')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;  -- nunca bloquear el insert por un fallo del webhook
END $$;

DROP TRIGGER IF EXISTS trg_wa_created ON public.packages;
CREATE TRIGGER trg_wa_created
  AFTER INSERT ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.wa_notify_created();

-- ── Llegó a sucursal (INSERT en package_events con status = 'arrived') ──
CREATE OR REPLACE FUNCTION public.wa_notify_arrived()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'arrived' THEN
    PERFORM net.http_post(
      url     := 'https://questhobbystore.com/api/wa-notify',
      body    := jsonb_build_object('event', 'arrived', 'package_id', NEW.package_id),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-wa-secret', 'PON_TU_SECRETO_ACA')
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wa_arrived ON public.package_events;
CREATE TRIGGER trg_wa_arrived
  AFTER INSERT ON public.package_events
  FOR EACH ROW EXECUTE FUNCTION public.wa_notify_arrived();
