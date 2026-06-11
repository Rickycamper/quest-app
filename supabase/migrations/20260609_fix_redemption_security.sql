-- ─────────────────────────────────────────────
-- QUEST — Seguridad de canjes (q_redemptions)
-- ─────────────────────────────────────────────
-- ⚠️ APLICAR SOLO CUANDO LA TABLA public.q_redemptions EXISTA.
-- En producción (jun 2026) esta tabla NO existía (la migración 20260402_q_points
-- no estaba aplicada), así que esta corrección quedó pendiente.
--
-- Bug: approve_redemption / reject_redemption eran SECURITY DEFINER, granteadas
-- a 'authenticated' y SIN chequeo de rol → cualquier usuario logueado podía
-- aprobar/rechazar canjes y disparar reembolsos llamando la función directo.
-- Fix: mismo cuerpo + guard public.is_staff() al inicio.
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.approve_redemption(p_id uuid)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  UPDATE q_redemptions
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_id AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_redemption(p_id uuid, p_note text DEFAULT NULL)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_r q_redemptions;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_r FROM q_redemptions WHERE id = p_id AND status = 'pending';
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE q_redemptions
  SET status = 'rejected', admin_note = p_note,
      reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_id;

  UPDATE profiles SET q_points = q_points + v_r.points WHERE id = v_r.user_id;
  INSERT INTO q_points_log (user_id, amount, reason)
  VALUES (v_r.user_id, v_r.points, 'Reembolso — canje rechazado');
END;
$$;
