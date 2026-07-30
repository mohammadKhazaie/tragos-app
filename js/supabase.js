/* ═══════════════════════════════════════════
   TRAGOS — Supabase Config
   ⚠️ این فایل رو بعد از ساخت پروژه Supabase پر کن
═══════════════════════════════════════════ */

const SUPABASE_URL = 'https://muwigfufyqqoeqbqeomj.supabase.co/auth/v1/.well-known/jwks.json';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11d2lnZnVmeXFxb2VxYnFlb21qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzODA4OTUsImV4cCI6MjEwMDk1Njg5NX0.1vlIKjh5hVZe38MXbk-FaIKyvmMJyNvQnddfR-oGfS0';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ── Keep Alive (جلوگیری از pause شدن پروژه) ── */
setInterval(async () => {
  try { await sb.from('users').select('id').limit(1); } catch(e) {}
}, 4 * 24 * 60 * 60 * 1000); // هر ۴ روز
