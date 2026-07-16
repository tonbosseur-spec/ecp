const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data: admins } = await supabase.from('admin_profiles').select('id');
  console.log("admins:", admins);
  
  const { data: clients } = await supabase.from('client_profiles').select('id');
  console.log("clients:", clients);
}
test();
