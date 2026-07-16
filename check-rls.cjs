const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  // Let's create an anonymous user and try to insert
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: 'test_proposals@example.com',
    password: 'password123',
  });
  
  if (authError && authError.message !== 'User already registered') {
    console.error('Auth error', authError);
  }
  
  const { data: signData, error: signError } = await supabase.auth.signInWithPassword({
    email: 'test_proposals@example.com',
    password: 'password123',
  });
  
  if (signError) {
    console.error('SignIn error', signError);
    return;
  }
  
  const uid = signData.user.id;
  
  const { data, error } = await supabase.from('course_proposals').insert({
    client_id: uid,
    custom_title: 'Test',
    status: 'pending'
  });
  
  console.log("Insert result:", error || data);
}
test();
