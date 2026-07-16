const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data: signData } = await supabase.auth.signInWithPassword({
    email: 'test_proposals@example.com',
    password: 'password123',
  });
  const uid = signData.user.id;
  
  const { data, error } = await supabase.from('client_profiles').upsert({ id: uid }, { onConflict: 'id' });
  console.log("Upsert result:", error || data);
}
test();
