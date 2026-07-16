const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  // Can't use service role key... let's use anon key and try to read client_profiles for that ID
  const { data } = await supabase.from('client_profiles').select('*').eq('id', '1da4c1e4-1856-4b44-9030-107c78eb265d');
  console.log(data);
}
test();
