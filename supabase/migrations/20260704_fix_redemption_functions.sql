-- ─────────────────────────────────────────────
-- QUEST — Fix: funciones de canje de Q Coins faltantes en prod
-- ─────────────────────────────────────────────
-- Auditoría (jul 2026): la tabla q_redemptions existe, pero las 3 funciones
-- que la operan NO estaban en prod (la migración 20260402_q_points.sql quedó
-- aplicada a medias). Resultado: los Q Coins NO se podían canjear ni
-- aprobar/rechazar — el botón "Canjear" fallaba con PGRST202.
--
-- Este archivo re-crea las 3 funciones (redeem_points para el usuario;
-- approve/reject con guard is_staff() para el staff) y sus grants.
-- Idempotente. Aplicar en Supabase → SQL Editor.
-- ─────────────────────────────────────────────

-- Usuario: solicita canje (descuenta puntos ya; admin aprueba el pago)
CREATE OR REPLACE FUNCTION public.redeem_points(p_points integer)
RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_current integer;
  v_id      uuid;
BEGIN
  v_user_id := auth.uid();
  SELECT q_points INTO v_current FROM profiles WHERE id = v_user_id;

  IF p_points < 1000 THEN
    RAISE EXCEPTION 'Mínimo de canje es 1000 puntos';
  END IF;
  IF v_current < p_points THEN
    RAISE EXCEPTION 'Puntos insuficientes';
  END IF;

  UPDATE profiles SET q_points = q_points - p_points WHERE id = v_user_id;
  INSERT INTO q_points_log (user_id, amount, reason)
  VALUES (v_user_id, -p_points, 'Canje solicitado');

  INSERT INTO q_redemptions (user_id, points)
  VALUES (v_user_id, p_points)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Staff: aprobar canje (con guard de seguridad)
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

-- Staff: rechazar canje y reembolsar (con guard de seguridad)
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

-- Grants (PUBLIC está revocado en este proyecto)
GRANT EXECUTE ON FUNCTION public.redeem_points(integer)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_redemption(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_redemption(uuid, text)   TO authenticated;
