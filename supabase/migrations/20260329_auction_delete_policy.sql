-- Allow staff/admin/owner to delete auctions
-- Without this policy, RLS silently blocks DELETE and the row returns on refresh

CREATE POLICY "staff can delete auctions"
ON public.auctions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (role IN ('admin', 'staff') OR is_owner = true)
  )
);
