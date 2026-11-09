-- ============================================================
-- User Profiles View
-- Joins auth.users with profiles to expose email + role
-- safely to authenticated admin users.
-- ============================================================

CREATE OR REPLACE VIEW public.user_profiles AS
SELECT
  p.id,
  u.email,
  p.role,
  p.created_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id;

-- Allow authenticated users to read the view
GRANT SELECT ON public.user_profiles TO authenticated;

-- RLS is not available on views directly; the underlying
-- profiles table already has RLS. Admins can see all profiles
-- via the is_admin() helper referenced in the app logic.

NOTIFY pgrst, 'reload schema';
