import { createClient } from '@supabase/supabase-js';
const VITE_SUPABASE_URL = "https://titncxnaixghtoerkfiu.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_iT_JRKhAltXDPpt056RFlg_a3v_kSrO";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from('live_participants').select('*').limit(1);
  console.log('participants', data, error);
}
test();
