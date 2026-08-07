-- Migration: Create admin_users table for storing created administrator accounts

CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT DEFAULT 'pmbom@ecp.cm'
);

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Allow public read so auth checks can verify if an email is an admin
CREATE POLICY "Allow read access to admin_users" ON public.admin_users
    FOR SELECT TO public USING (true);

-- Allow authenticated users to manage admin_users
CREATE POLICY "Allow superadmin insert/delete on admin_users" ON public.admin_users
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
