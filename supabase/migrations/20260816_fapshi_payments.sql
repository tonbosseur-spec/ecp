-- ==============================================================================
-- MIGRATION SUPABASE : INTÉGRATION PAIEMENT FAPSHI & GESTION ADMIN
-- ==============================================================================

-- 1. Création de la table admin_users si inexistante
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT 'Administrateur',
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'pmbom@ecp.cm'
);

-- Insertion de l'administrateur principal par défaut
INSERT INTO public.admin_users (full_name, email, created_by)
VALUES ('Pierre Mbom', 'pmbom@ecp.cm', 'system')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to admin_users" ON public.admin_users;
CREATE POLICY "Allow read access to admin_users" ON public.admin_users
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow superadmin insert/delete on admin_users" ON public.admin_users;
CREATE POLICY "Allow superadmin insert/delete on admin_users" ON public.admin_users
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Création de la table payments si inexistante
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES public.registrations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ajout individuel et sécurisé de toutes les colonnes Fapshi requises
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'fapshi';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS fapshi_trans_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'full';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS tranche_number INTEGER DEFAULT 1;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS raw_payload JSONB;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Ajout de payment_mode sur registrations si absent
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'full';

-- 5. Mise à jour des contraintes de vérification
DO $$ 
BEGIN
  ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
  ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_type_check;
  
  ALTER TABLE public.payments ADD CONSTRAINT payments_status_check 
    CHECK (status IN ('pending', 'paid', 'failed', 'expired'));
  ALTER TABLE public.payments ADD CONSTRAINT payments_payment_type_check 
    CHECK (payment_type IN ('full', 'installment', 'installments'));
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- 6. Index de performance
CREATE INDEX IF NOT EXISTS idx_payments_fapshi_trans_id ON public.payments(fapshi_trans_id);
CREATE INDEX IF NOT EXISTS idx_payments_external_id ON public.payments(external_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_registration_id ON public.payments(registration_id);
CREATE INDEX IF NOT EXISTS idx_payments_course_id ON public.payments(course_id);

-- 7. Sécurité Row Level Security (RLS)
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Lecture : L'étudiant peut consulter l'historique de ses propres paiements
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
CREATE POLICY "Users can view their own payments"
ON public.payments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Insertion : L'étudiant connecté peut enregistrer une tentative de paiement initiale
DROP POLICY IF EXISTS "Users can insert pending payments" ON public.payments;
CREATE POLICY "Users can insert pending payments"
ON public.payments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Gestion complète pour les administrateurs et service role
DROP POLICY IF EXISTS "Admins can manage all payments" ON public.payments;
CREATE POLICY "Admins can manage all payments"
ON public.payments FOR ALL
TO authenticated
USING (
  (auth.jwt() ->> 'email') IN ('pmbom@ecp.cm', 'association.astral@gmail.com')
  OR EXISTS (
    SELECT 1 FROM public.admin_users WHERE admin_users.email = (auth.jwt() ->> 'email')
  )
);

