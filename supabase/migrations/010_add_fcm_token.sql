-- Migration: Add FCM Push Notification Token columns to client_profiles table
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS fcm_token TEXT;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
