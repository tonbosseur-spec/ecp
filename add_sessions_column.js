import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; // Actually we might need the service role key for DDL or we can just try to see if JSONB is already added or not required if we just update the json object? No, we need DDL.
console.log("Supabase URL:", supabaseUrl);
