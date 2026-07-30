-- Add promo_code to client_profiles and registrations
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS promo_code text;
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS promo_code text;
