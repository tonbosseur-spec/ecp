-- Migration pour les paiements en tranches
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID REFERENCES registrations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  due_date TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_type TEXT CHECK (payment_type IN ('full', 'installment')),
  tranche_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add payment_mode to registrations
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'full' CHECK (payment_mode IN ('full', 'installments'));

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own payments" ON payments;
CREATE POLICY "Users can view their own payments"
ON payments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all payments" ON payments;
CREATE POLICY "Admins can manage all payments"
ON payments FOR ALL
TO authenticated
USING (
  (SELECT auth.jwt() ->> 'email') = 'pmbom@ecp.cm'
);

-- Ajout des nouveaux thèmes
INSERT INTO templates (name, primary_color, bg_pattern, layout_style) VALUES
('Bleu Professionnel', '#2563EB', 'bg-blue-50', 'centered-classic'),
('Rouge Passion', '#DC2626', 'bg-red-50', 'bold-asymmetric'),
('Élégance Anthracite', '#374151', 'bg-gray-50', 'split-screen');
