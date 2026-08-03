const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function test() {
  const { data: sessions } = await supabase.from('live_sessions').select('*');
  console.log('Sessions:', sessions);
  if (sessions && sessions.length > 0) {
    const id = sessions[0].id;
    console.log('Trying to delete:', id);
    const { data, error } = await supabase.from('live_sessions').delete().eq('id', id).select();
    console.log('Delete result:', data, error);
  }
}
test();
