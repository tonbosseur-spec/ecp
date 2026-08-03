import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const VITE_SUPABASE_URL = "https://titncxnaixghtoerkfiu.supabase.co";
const VITE_SUPABASE_ANON_KEY = "sb_publishable_iT_JRKhAltXDPpt056RFlg_a3v_kSrO";
const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function test() {
  const sessionId = "live-1785691371680";
  console.log('Testing delete for:', sessionId);
  const { error } = await supabase.from('live_sessions').delete().eq('id', sessionId);
  console.log('Error deleting parent:', error);
}
test();
