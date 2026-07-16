const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const uuid = '1da4c1e4-1856-4b44-9030-107c78eb265d';
  const { data: tables } = await supabase.rpc('run_sql', { sql: "SELECT tablename FROM pg_tables WHERE schemaname = 'public';" });
  if (tables) {
    for (const { tablename } of tables) {
      try {
        const { data } = await supabase.from(tablename).select('*').limit(1);
        // check if data exists and contains the uuid anywhere
        if (data && JSON.stringify(data).includes(uuid)) {
           console.log(`Found in ${tablename}`);
        }
      } catch(e) {}
    }
  } else {
     console.log("no tables via rpc");
  }
}
test();
