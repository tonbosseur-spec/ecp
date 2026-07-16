const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data } = await supabase.from('client_profiles').select('id, first_name').eq('id', '1da4c1e4-1856-4b44-9030-107c78eb265d');
  console.log(data);
}
test();
