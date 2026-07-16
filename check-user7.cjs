const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data: admins } = await supabase.from('admin_profiles').select('*');
  console.log("admins:", admins);
}
test();
