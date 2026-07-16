const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data: coursesData, error } = await supabase
          .from('courses')
          .select('*, trainers(name, photo_url)');
  console.log(coursesData.map(c => c.id));
}
test();
