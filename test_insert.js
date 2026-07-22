import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('course_modules').insert({ course_id: '123e4567-e89b-12d3-a456-426614174000', title: 'Test', order_index: 0, scheduled_date: new Date().toISOString() });
  console.log(error || 'Success');
}
run();
