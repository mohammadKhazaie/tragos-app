-- ══════════════════════════════════════
-- اضافه کردن تنظیمات جدید به settings
-- ══════════════════════════════════════

INSERT INTO settings (key, value) VALUES
-- متن‌های صفحه لاگین
('login_title', 'TRAGOS'),
('login_subtitle', 'طلوع پادشاهی — ورود به سرزمین'),
('login_btn_text', 'ورود به تراگوس ⚔️'),
('login_hint', 'کد اختصاصی خود را از مدرس دریافت کنید'),
('login_input_placeholder', 'مثال: TRG-A1B2C3'),

-- متن‌های منو
('nav_courses', 'دوره‌ها'),
('nav_challenges', 'چالش‌ها'),
('nav_codex', 'کدکس'),
('nav_gallery', 'گالری'),
('nav_tools', 'ابزارها'),
('nav_about', 'درباره'),

-- متن‌های صفحات
('courses_title', 'دوره‌ها'),
('courses_subtitle', 'محتوای آموزشی تراگوس — TRAGOS Courses'),
('gallery_title', 'گالری آثار'),
('gallery_subtitle', 'آثار پادشاهان تراگوس'),
('codex_title', 'کدکس تراگوس'),
('codex_subtitle', 'Codex Tragos — راهنمای پادشاهان'),
('challenges_title', 'تمرینات و چالش‌ها'),
('challenges_subtitle', 'The Trials of Tragos'),
('tools_title', 'ابزارهای کار'),
('tools_subtitle', 'Arsenal of Tragos'),
('about_title', 'TRAGOS'),
('about_subtitle', 'طلوع پادشاهی — WHERE KINGS ARE BORN'),

-- متن‌های عمومی
('app_name', 'تراگوس'),
('app_tagline', 'طلوع پادشاهی'),
('score_label', 'امتیاز'),
('upload_btn_text', '⬆️ آپلود اثر جدید'),
('empty_courses', 'به زودی محتوای دوره اضافه می‌شود'),
('empty_gallery', 'هنوز اثری آپلود نشده'),
('empty_codex', 'کدکس تراگوس در حال آماده‌سازی است'),
('empty_challenges', 'چالش‌ها به زودی اضافه می‌شوند'),
('empty_tools', 'ابزارها به زودی اضافه می‌شوند')

ON CONFLICT (key) DO NOTHING;

-- اضافه کردن ستون link به invite_codes
ALTER TABLE invite_codes ADD COLUMN IF NOT EXISTS link TEXT;
