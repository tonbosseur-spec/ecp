import { createClient } from '@supabase/supabase-js';

const VITE_SUPABASE_URL = "https://titncxnaixghtoerkfiu.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_iT_JRKhAltXDPpt056RFlg_a3v_kSrO";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.rpc('run_sql', { sql: "SELECT * FROM pg_policies WHERE tablename = 'live_sessions';" });
  console.log('Policies:', data, error);
}
test();
