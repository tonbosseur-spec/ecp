const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data: signData, error } = await supabase.auth.signInWithPassword({
    email: 'test_proposals@example.com',
    password: 'password123',
  });
  console.log(signData?.user?.id);
}
test();
