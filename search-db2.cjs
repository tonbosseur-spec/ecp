const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const uuid = '1da4c1e4-1856-4b44-9030-107c78eb265d';
  const tables = ['courses', 'course_modules', 'course_features', 'course_testimonials', 'trainers', 'registrations', 'course_proposals', 'admin_profiles', 'client_profiles', 'conversations', 'messages', 'payments'];
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(100);
      if (data && JSON.stringify(data).includes(uuid)) {
        console.log(`Found in ${table}`);
      }
    } catch(e) {}
  }
}
test();
