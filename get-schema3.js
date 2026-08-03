import { createClient } from '@supabase/supabase-js';
const VITE_SUPABASE_URL = "https://titncxnaixghtoerkfiu.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_iT_JRKhAltXDPpt056RFlg_a3v_kSrO";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data: p, error: pe } = await supabase.from('live_presence').select('*').limit(1);
  console.log('presence', p, pe);
  const { data: m, error: me } = await supabase.from('live_messages').select('*').limit(1);
  console.log('messages', m, me);
}
test();
