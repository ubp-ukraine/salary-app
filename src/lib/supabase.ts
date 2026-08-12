import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Vite вшиває VITE_* на ЗБІРЦІ, тож порожні значення тут означають, що збірка
  // йшла без них — і жодне налаштування в рантаймі цього вже не виправить.
  throw new Error(
    'Немає налаштувань Supabase (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). ' +
    'Локально — .env за зразком .env.example; на Cloudflare — Settings → Build → ' +
    'Build variables, і після цього перезапустити збірку.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
  global: { headers: { 'X-Client-Info': 'salary-app' } },
});
