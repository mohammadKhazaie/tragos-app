/* ═══════════════════════════════════════════
   TRAGOS — Settings Manager
   مدیریت متن‌های قابل ویرایش اپ
═══════════════════════════════════════════ */

const S = {}; // کش تنظیمات

async function loadSettings() {
  try {
    const { data } = await sb.from('settings').select('key, value');
    if (data) data.forEach(row => S[row.key] = row.value);
    applySettings();
  } catch(e) {
    console.log('Settings load error:', e);
  }
}

function get(key, fallback = '') {
  return S[key] || fallback;
}

function applySettings() {
  // صفحه لاگین
  setEl('login-title-text',   get('login_title', 'TRAGOS'));
  setEl('login-sub-text',     get('login_subtitle', 'طلوع پادشاهی — ورود به سرزمین'));
  setEl('login-btn',          get('login_btn_text', 'ورود به تراگوس ⚔️'));
  setEl('login-hint-text',    get('login_hint', 'کد اختصاصی خود را از مدرس دریافت کنید'));
  setAttr('login-code', 'placeholder', get('login_input_placeholder', 'مثال: TRG-A1B2C3'));

  // topbar
  setEl('topbar-app-name',    get('app_name', 'تراگوس'));
  setEl('ui-score-label',     get('score_label', 'امتیاز'));

  // منو
  setEl('nav-label-courses',    get('nav_courses', 'دوره‌ها'));
  setEl('nav-label-challenges', get('nav_challenges', 'چالش‌ها'));
  setEl('nav-label-codex',      get('nav_codex', 'کدکس'));
  setEl('nav-label-gallery',    get('nav_gallery', 'گالری'));
  setEl('nav-label-tools',      get('nav_tools', 'ابزارها'));
  setEl('nav-label-about',      get('nav_about', 'درباره'));

  // عناوین صفحات
  setEl('page-title-courses',    get('courses_title', 'دوره‌ها'));
  setEl('page-sub-courses',      get('courses_subtitle', 'محتوای آموزشی تراگوس'));
  setEl('page-title-gallery',    get('gallery_title', 'گالری آثار'));
  setEl('page-sub-gallery',      get('gallery_subtitle', 'آثار پادشاهان تراگوس'));
  setEl('page-title-codex',      get('codex_title', 'کدکس تراگوس'));
  setEl('page-sub-codex',        get('codex_subtitle', 'Codex Tragos — راهنمای پادشاهان'));
  setEl('page-title-challenges', get('challenges_title', 'تمرینات و چالش‌ها'));
  setEl('page-sub-challenges',   get('challenges_subtitle', 'The Trials of Tragos'));
  setEl('page-title-tools',      get('tools_title', 'ابزارهای کار'));
  setEl('page-sub-tools',        get('tools_subtitle', 'Arsenal of Tragos'));
  setEl('about-main-title',      get('about_title', 'TRAGOS'));
  setEl('about-main-sub',        get('about_subtitle', 'طلوع پادشاهی — WHERE KINGS ARE BORN'));

  // دکمه آپلود
  setEl('upload-btn-main',    get('upload_btn_text', '⬆️ آپلود اثر جدید'));
}

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setAttr(id, attr, val) {
  const el = document.getElementById(id);
  if (el) el.setAttribute(attr, val);
}
