const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data } = await supabase.from('course_modules').select('id');
  if (data) console.log("modules:", data.map(d=>d.id).filter(id => id === '1da4c1e4-1856-4b44-9030-107c78eb265d'));
  
  const { data: f } = await supabase.from('course_features').select('id');
  if (f) console.log("features:", f.map(d=>d.id).filter(id => id === '1da4c1e4-1856-4b44-9030-107c78eb265d'));
  
  const { data: t } = await supabase.from('course_testimonials').select('id');
  if (t) console.log("testimonials:", t.map(d=>d.id).filter(id => id === '1da4c1e4-1856-4b44-9030-107c78eb265d'));
}
test();
