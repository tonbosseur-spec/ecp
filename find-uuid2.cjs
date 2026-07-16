const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const uuid = '1da4c1e4-1856-4b44-9030-107c78eb265d';
  const tables = ['client_profiles', 'admin_profiles', 'trainers', 'course_modules', 'course_features', 'course_testimonials'];
  for (const table of tables) {
    console.log(`Searching ${table}...`);
    const { data } = await supabase.from(table).select('id').eq('id', uuid).maybeSingle();
    if (data) console.log(`Found in ${table}`);
  }
}
test();
