const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data: adminUser } = await supabase.from('admin_profiles').select('id').eq('email', 'association.astral@gmail.com').maybeSingle();
  if (!adminUser) return console.log("Admin not found");
  
  const { data: client } = await supabase.from('client_profiles').select('*').eq('id', adminUser.id).maybeSingle();
  console.log("Admin has client profile:", !!client);
}
test();
