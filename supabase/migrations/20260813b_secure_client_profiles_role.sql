-- Migration: Security for client_profiles role and protection against privilege escalation

-- 1. Ensure role column exists with default 'client'
ALTER TABLE public.client_profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client';

-- 2. Ensure is_admin() has search_path set securely
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'email' = 'pmbom@ecp.cm')
    OR EXISTS (
      SELECT 1 FROM public.client_profiles
      WHERE id = auth.uid() AND role = 'admin'
    ),
    false
  );
$$;

-- 3. Trigger function to protect role column from unauthorized changes
CREATE OR REPLACE FUNCTION public.protect_client_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- On INSERT:
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_admin() THEN
      -- Forcibly assign 'client' role to non-admin insertions
      NEW.role := 'client';
    ELSE
      -- Admin inserting: default to 'client' if role is NULL
      IF NEW.role IS NULL THEN
        NEW.role := 'client';
      END IF;
    END IF;
  END IF;

  -- On UPDATE:
  IF TG_OP = 'UPDATE' THEN
    -- If non-admin attempts to change the role
    IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Modification du rôle non autorisée: Seuls les administrateurs peuvent modifier les rôles.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. Attach trigger to client_profiles table
DROP TRIGGER IF EXISTS tr_protect_client_profile_role ON public.client_profiles;

CREATE TRIGGER tr_protect_client_profile_role
BEFORE INSERT OR UPDATE ON public.client_profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_client_profile_role();

-- 5. Enable and configure RLS on client_profiles
ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

-- Clean up existing/legacy policies on client_profiles
DROP POLICY IF EXISTS "Clients can view their own profile" ON public.client_profiles;
DROP POLICY IF EXISTS "Clients can update their own profile" ON public.client_profiles;
DROP POLICY IF EXISTS "Clients can insert their own profile" ON public.client_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.client_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.client_profiles;
DROP POLICY IF EXISTS "client_profiles_select_policy" ON public.client_profiles;
DROP POLICY IF EXISTS "client_profiles_insert_policy" ON public.client_profiles;
DROP POLICY IF EXISTS "client_profiles_update_policy" ON public.client_profiles;
DROP POLICY IF EXISTS "client_profiles_delete_policy" ON public.client_profiles;

-- Policy 1: SELECT
-- Users can read their own profile, Admins can read all profiles
CREATE POLICY "client_profiles_select_policy" ON public.client_profiles
FOR SELECT TO authenticated
USING (
  id = auth.uid() OR is_admin()
);

-- Policy 2: INSERT
-- Users can insert their own profile, Admins can insert any profile
CREATE POLICY "client_profiles_insert_policy" ON public.client_profiles
FOR INSERT TO authenticated
WITH CHECK (
  id = auth.uid() OR is_admin()
);

-- Policy 3: UPDATE
-- Users can update their own profile, Admins can update any profile
CREATE POLICY "client_profiles_update_policy" ON public.client_profiles
FOR UPDATE TO authenticated
USING (
  id = auth.uid() OR is_admin()
)
WITH CHECK (
  id = auth.uid() OR is_admin()
);

-- Policy 4: DELETE
-- Only Admins can delete profiles
CREATE POLICY "client_profiles_delete_policy" ON public.client_profiles
FOR DELETE TO authenticated
USING (
  is_admin()
);
