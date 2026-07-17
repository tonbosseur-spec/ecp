import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

// You can't run DDL via JS client without an RPC that executes SQL, which we probably don't have.
// Let's check if the CLI is available.
