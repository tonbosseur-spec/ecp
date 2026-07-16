const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.rpc('run_sql', { sql: 'SELECT * FROM pg_policies WHERE tablename = \'course_proposals\';' });
  console.log(error || data);
}
test();
