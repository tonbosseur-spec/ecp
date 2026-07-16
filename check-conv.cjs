const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data: signData } = await supabase.auth.signInWithPassword({
    email: 'association.astral@gmail.com',
    password: 'password123',
  });
  const { data: conv, error } = await supabase.from('conversations').select('*');
  console.log(conv, error);
}
test();
