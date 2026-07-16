const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const { data: courses } = await supabase.from('courses').select('id').limit(1);
  const courseId = courses[0].id;
  console.log("Course ID:", courseId);
  
  const { data: signData } = await supabase.auth.signInWithPassword({
    email: 'test_proposals@example.com',
    password: 'password123',
  });
  const uid = signData.user.id;
  
  const { data, error } = await supabase.from('course_proposals').insert({
    client_id: uid,
    course_id: courseId,
    status: 'pending'
  });
  
  console.log("Insert result:", error);
}
test();
