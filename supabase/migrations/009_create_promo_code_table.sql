-- Create promo_code table
CREATE TABLE IF NOT EXISTS promo_code (
  client_id text PRIMARY KEY,
  client_name text NOT NULL DEFAULT '',
  client_email text NOT NULL DEFAULT '',
  client_phone text NOT NULL DEFAULT '',
  code text NOT NULL UNIQUE,
  discount_percent integer NOT NULL DEFAULT 10,
  commission_percent integer NOT NULL DEFAULT 10,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE promo_code ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Anyone can view promo codes" ON promo_code;
DROP POLICY IF EXISTS "Admins can manage promo codes" ON promo_code;

-- 1. Anyone can SELECT promo codes (needed for registration lookup)
CREATE POLICY "Anyone can view promo codes" ON promo_code
  FOR SELECT
  USING (true);

-- 2. Only admins can INSERT/UPDATE/DELETE
CREATE POLICY "Admins can manage promo codes" ON promo_code
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
