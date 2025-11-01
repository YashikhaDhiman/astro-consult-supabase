const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function readEnv(file) {
  const p = path.resolve(file);
  if (!fs.existsSync(p)) return {};
  const text = fs.readFileSync(p, 'utf8');
  const lines = text.split(/\r?\n/);
  const out = {};
  for (const l of lines) {
    const m = l.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (m) {
      out[m[1]] = m[2];
    }
  }
  return out;
}

(async function () {
  try {
    const env = readEnv('.env.local');
    const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.error('Missing SUPABASE URL or KEY in .env.local or environment');
      process.exit(2);
    }
    const supabase = createClient(url, key);
    const { data, error, count } = await supabase
      .from('chats')
      .select('id,user_id,status,priority', { count: 'exact', head: true })
      .eq('status', 'active');

    console.log('count:', count);
    if (error) console.error('error:', error);
    // fetch some rows as fallback
    const { data: rows, error: rowsErr } = await supabase
      .from('chats')
      .select('id,user_id,status,priority')
      .eq('status', 'active')
      .limit(10);

    if (rowsErr) console.error('rowsErr:', rowsErr);
    console.log('rows sample:', rows || data || []);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
