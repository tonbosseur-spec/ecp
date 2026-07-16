const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data: signData } = await supabase.auth.signInWithPassword({
    email: 'association.astral@gmail.com',
    password: 'password123',
  });
  if (!signData.user) { console.log("Login failed"); return; }
  const uid = signData.user.id;
  
  const { data: admin } = await supabase.from('admin_profiles').select('*').eq('id', uid);
  const { data: client } = await supabase.from('client_profiles').select('*').eq('id', uid);
  
  console.log("Admin:", admin);
  console.log("Client:", client);
}
test();
