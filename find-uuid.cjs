const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const uuid = '1da4c1e4-1856-4b44-9030-107c78eb265d';
  console.log("Searching courses...");
  let res = await supabase.from('courses').select('id, title').eq('id', uuid);
  console.log(res.data);
  
  console.log("Searching proposals...");
  res = await supabase.from('course_proposals').select('id').eq('id', uuid);
  console.log(res.data);

  console.log("Searching registrations...");
  res = await supabase.from('registrations').select('id').eq('id', uuid);
  console.log(res.data);
}
test();
