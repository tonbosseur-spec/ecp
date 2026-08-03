import { supabase } from './src/lib/supabaseClient';

async function test() {
  const { data: sessions } = await supabase.from('live_sessions').select('*');
  console.log('Sessions:', sessions);
  if (sessions && sessions.length > 0) {
    const id = sessions[0].id;
    console.log('Trying to delete:', id);
    const { data, error } = await supabase.from('live_sessions').delete().eq('id', id).select();
    console.log('Delete result data:', data);
    console.log('Delete result error:', error);
  }
}
test();
