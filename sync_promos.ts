import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  console.log("No supabase url");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function sync() {
  console.log("Starting sync...");
  const { data: promos } = await supabase.from('promo_code').select('*');
  const { data: profiles } = await supabase.from('client_profiles').select('id, first_name, last_name, email, promo_code').not('promo_code', 'is', null);
  
  const allCodes = new Map();
  if (promos) promos.forEach(p => allCodes.set(p.code, p));
  if (profiles) profiles.forEach(p => {
    if (!allCodes.has(p.promo_code)) {
      allCodes.set(p.promo_code, {
        code: p.promo_code,
        client_name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email
      });
    }
  });
  
  if (allCodes.size === 0) {
    console.log("No promo codes found.");
    return;
  }
  
  console.log(`Found ${allCodes.size} promo codes to sync.`);
  
  const { data: courses } = await supabase.from('courses').select('id, promo_codes');
  if (!courses) return;
  
  for (const course of courses) {
    let promosArray = Array.isArray(course.promo_codes) ? course.promo_codes : [];
    let updated = false;
    for (const [code, info] of allCodes.entries()) {
      if (!promosArray.find((p:any) => p.code === code)) {
        promosArray.push({
          code,
          discount_type: 'percentage',
          discount_value: 10,
          min_score: 0,
          max_score: 100,
          class_name: 'Parrainage',
          description: `Code commercial: ${info.client_name}`
        });
        updated = true;
      }
    }
    
    if (updated) {
      console.log(`Updating course ${course.id}`);
      await supabase.from('courses').update({ promo_codes: promosArray }).eq('id', course.id);
    }
  }
  
  console.log("Sync complete.");
}

sync();
