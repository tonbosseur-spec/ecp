-- Migration 012: Politiques RLS pour l'insertion et l'upsert des profils clients

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'client_profiles' AND policyname = 'Clients can insert their own profile'
    ) THEN
        CREATE POLICY "Clients can insert their own profile" ON public.client_profiles
            FOR INSERT
            TO authenticated
            WITH CHECK (id = auth.uid());
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'client_profiles' AND policyname = 'Admins can manage all profiles'
    ) THEN
        CREATE POLICY "Admins can manage all profiles" ON public.client_profiles
            FOR ALL
            TO authenticated
            USING (is_admin())
            WITH CHECK (is_admin());
    END IF;
END $$;
