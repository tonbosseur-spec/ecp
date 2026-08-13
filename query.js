const { Client } = require('pg');
require('dotenv').config();

// Usually VITE_SUPABASE_URL is https://<ref>.supabase.co
// We can reconstruct the postgres connection string: postgres://postgres.[ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
// But we don't have the DB password.
