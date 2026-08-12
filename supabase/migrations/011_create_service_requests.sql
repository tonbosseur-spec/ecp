-- Migration 011: Table service_requests pour les demandes de prestations et services personnalisés

CREATE TABLE IF NOT EXISTS public.service_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    domain TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    service_type TEXT NOT NULL,
    description TEXT NOT NULL,
    budget NUMERIC,
    status TEXT NOT NULL DEFAULT 'Nouvelle',
    admin_notes TEXT,
    contacted_at TIMESTAMP WITH TIME ZONE,
    assigned_to TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activation de RLS
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

-- Politiques RLS :
-- 1. Un visiteur (anonyme ou connecté) peut insérer une nouvelle demande
CREATE POLICY "Anyone can insert a service request" ON public.service_requests
    FOR INSERT
    WITH CHECK (true);

-- 2. Seuls les administrateurs peuvent consulter les demandes
CREATE POLICY "Admins can view all service requests" ON public.service_requests
    FOR SELECT
    TO authenticated
    USING (is_admin());

-- 3. Seuls les administrateurs peuvent modifier les demandes
CREATE POLICY "Admins can update service requests" ON public.service_requests
    FOR UPDATE
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- 4. Seuls les administrateurs peuvent supprimer les demandes
CREATE POLICY "Admins can delete service requests" ON public.service_requests
    FOR DELETE
    TO authenticated
    USING (is_admin());
