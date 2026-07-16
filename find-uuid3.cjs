const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function test() {
  const uuid = '1da4c1e4-1856-4b44-9030-107c78eb265d';
  const tables = ['conversations', 'messages'];
  for (const table of tables) {
    console.log(`Searching ${table}...`);
    // id might not be 'id' for conversations, it might be client_id
    if (table === 'conversations') {
      const { data } = await supabase.from(table).select('client_id').eq('client_id', uuid).maybeSingle();
      if (data) console.log(`Found in ${table}`);
    } else {
      const { data } = await supabase.from(table).select('id').eq('id', uuid).maybeSingle();
      if (data) console.log(`Found in ${table}`);
    }
  }
}
test();
