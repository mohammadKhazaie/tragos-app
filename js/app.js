/* ═══════════════════════════════════════════
   TRAGOS — App Core
═══════════════════════════════════════════ */

/* ── State ── */
const STATE = {
  user: null,
  deviceId: null,
  currentPage: 'courses',
  currentEpisode: null,
};

/* ── DOM Ready ── */
document.addEventListener('DOMContentLoaded', async () => {
  initDeviceId();
  await checkAuth();
  initNavigation();
  startLoadingBar();
});

/* ══════════════════════════════════════════
   DEVICE ID — شناسه منحصربه‌فرد دستگاه
══════════════════════════════════════════ */
function initDeviceId() {
  let did = localStorage.getItem('tg_device_id');
  if (!did) {
    did = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('tg_device_id', did);
  }
  STATE.deviceId = did;
}

/* ══════════════════════════════════════════
   AUTH
══════════════════════════════════════════ */
async function checkAuth() {
  const userId = localStorage.getItem('tg_user_id');
  if (!userId) {
    showLoginPage();
    return;
  }
  // بررسی که این device مجاز است
  const { data, error } = await sb
    .from('users')
    .select('*')
    .eq('id', userId)
    .eq('device_id', STATE.deviceId)
    .single();

  if (error || !data) {
    localStorage.removeItem('tg_user_id');
    showLoginPage();
    return;
  }
  STATE.user = data;
  showApp();
}

/* ── Login با کد اختصاصی ── */
async function handleLogin() {
  const code = document.getElementById('login-code').value.trim();
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!code) {
    showLoginError('لطفاً کد اختصاصی خود را وارد کنید');
    return;
  }

  const btn = document.getElementById('login-btn');
  btn.innerHTML = '<span class="spinner"></span>';
  btn.disabled = true;

  try {
    const { data: invite, error: invErr } = await sb
      .from('invite_codes')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    console.log('invite result:', invite, 'error:', invErr);

    if (invErr) {
      showLoginError('خطا در اتصال: ' + invErr.message);
      return;
    }

    if (!invite) {
      showLoginError('کد وارد شده معتبر نیست');
      return;
    }

    if (invite.used && invite.device_id !== STATE.deviceId) {
      showLoginError('این کد قبلاً روی دستگاه دیگری ثبت شده است');
      return;
    }

    if (!invite.used) {
      showRegisterModal(invite.id, code);
      return;
    }

    const { data: user } = await sb
      .from('users')
      .select('*')
      .eq('invite_id', invite.id)
      .maybeSingle();

    if (user) {
      STATE.user = user;
      localStorage.setItem('tg_user_id', user.id);
      await sb.from('users').update({
        device_id: STATE.deviceId,
        last_login: new Date().toISOString()
      }).eq('id', user.id);
      showApp();
    }
  } catch(e) {
    console.error('Login error:', e);
    showLoginError('خطا در اتصال. لطفاً دوباره تلاش کنید');
  } finally {
    btn.innerHTML = 'ورود به تراگوس ⚔️';
    btn.disabled = false;
  }
}
/* ── Register Modal ── */
function showRegisterModal(inviteId, code) {
  document.getElementById('reg-invite-id').value = inviteId;
  document.getElementById('reg-code').value = code;
  document.getElementById('register-modal').classList.add('open');
}

async function handleRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const phone    = document.getElementById('reg-phone').value.trim();
  const inviteId = document.getElementById('reg-invite-id').value;
  const code     = document.getElementById('reg-code').value;

  if (!username || !phone) { showToast('نام کاربری و شماره تلفن الزامی است', 'error'); return; }
  if (phone.length < 10) { showToast('شماره تلفن معتبر نیست', 'error'); return; }

  const btn = document.getElementById('reg-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

  try {
    // بررسی تکراری نبودن نام کاربری
    const { data: existing } = await sb.from('users').select('id').eq('username', username).single();
    if (existing) { showToast('این نام کاربری قبلاً استفاده شده', 'error'); return; }

    // ساخت کاربر جدید
    const { data: newUser, error } = await sb.from('users').insert({
      username,
      phone,
      invite_id: inviteId,
      device_id: STATE.deviceId,
      score: 0,
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
    }).select().single();

    if (error) throw error;

    // علامت‌گذاری کد به عنوان استفاده شده
    await sb.from('invite_codes').update({
      used: true,
      device_id: STATE.deviceId,
      used_at: new Date().toISOString(),
    }).eq('id', inviteId);

    STATE.user = newUser;
    localStorage.setItem('tg_user_id', newUser.id);
    document.getElementById('register-modal').classList.remove('open');
    showApp();
    showToast('خوش آمدی پادشاه! 👑', 'success');
  } catch(e) {
    showToast('خطا در ثبت‌نام. دوباره تلاش کنید', 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'ورود به تراگوس 👑';
  }
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
}

/* ══════════════════════════════════════════
   SHOW/HIDE PAGES
══════════════════════════════════════════ */
function showLoginPage() {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function showApp() {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  updateUserUI();
  loadCurrentPage('courses');
}

function updateUserUI() {
  if (!STATE.user) return;
  document.getElementById('ui-username').textContent = STATE.user.username;
  document.getElementById('ui-score').textContent = STATE.user.score || 0;
}

/* ══════════════════════════════════════════
   NAVIGATION
══════════════════════════════════════════ */
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      if (page) navigateTo(page);
    });
  });
}

function navigateTo(page) {
  STATE.currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  const navEl  = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (pageEl) pageEl.classList.add('active');
  if (navEl)  navEl.classList.add('active');

  loadCurrentPage(page);
  window.scrollTo(0, 0);
}

function loadCurrentPage(page) {
  switch(page) {
    case 'courses':    loadCourses(); break;
    case 'gallery':    loadGallery(); break;
    case 'codex':      loadCodex(); break;
    case 'challenges': loadChallenges(); break;
    case 'tools':      loadTools(); break;
  }
}

/* ══════════════════════════════════════════
   LOADING SCREEN
══════════════════════════════════════════ */
function startLoadingBar() {
  setTimeout(() => {
    const ls = document.getElementById('loading-screen');
    if (ls) { ls.classList.add('fade-out'); setTimeout(() => ls.style.display='none', 600); }
  }, 1800);
}

/* ══════════════════════════════════════════
   TOAST NOTIFICATIONS
══════════════════════════════════════════ */
function showToast(msg, type = 'info', duration = 3000) {
  const wrap = document.getElementById('toast-wrap');
  const icons = { success: '✅', error: '❌', info: '⚡' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]||'⚡'}</span><span>${msg}</span>`;
  wrap.appendChild(toast);
  setTimeout(() => { toast.style.opacity='0'; toast.style.transition='opacity 0.3s'; setTimeout(()=>toast.remove(),300); }, duration);
}

/* ══════════════════════════════════════════
   COURSES PAGE
══════════════════════════════════════════ */
async function loadCourses() {
  const container = document.getElementById('chapters-container');
  container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  const { data: chapters } = await sb
    .from('chapters')
    .select('*, episodes(*)')
    .order('order_num');

  if (!chapters || chapters.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📖</div><div class="empty-text">به زودی محتوای دوره اضافه می‌شود</div></div>';
    return;
  }

  container.innerHTML = chapters.map(ch => `
    <div class="chapter-block">
      <div class="chapter-header" onclick="toggleChapter(this, '${ch.id}')">
        <span class="chapter-num">فصل ${ch.order_num}</span>
        <span class="chapter-title">${ch.title}</span>
        <span class="chapter-en">${ch.title_en || ''}</span>
        <span class="chapter-arrow">▼</span>
      </div>
      <div class="episodes-list" id="eps-${ch.id}">
        ${(ch.episodes || []).sort((a,b)=>a.order_num-b.order_num).map(ep => `
          <div class="episode-item" onclick="playEpisode('${ep.id}','${ep.video_url||''}','${ep.title}')">
            <div class="episode-num">${ep.order_num}</div>
            <div class="episode-info">
              <div class="episode-title">${ep.title}</div>
              ${ep.title_en ? `<div class="episode-en">${ep.title_en}</div>` : ''}
            </div>
            <span class="episode-play-icon">▶</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function toggleChapter(headerEl, chapterId) {
  headerEl.classList.toggle('open');
  const list = document.getElementById(`eps-${chapterId}`);
  list.classList.toggle('open');
}

function playEpisode(id, videoUrl, title) {
  if (!videoUrl) { showToast('ویدیو این قسمت به زودی اضافه می‌شود', 'info'); return; }
  const wrap = document.getElementById('video-player-wrap');
  const iframe = document.getElementById('video-iframe');
  const titleEl = document.getElementById('video-ep-title');

  // تبدیل لینک آپارات به embed
  let embedUrl = videoUrl;
  if (videoUrl.includes('aparat.com/v/')) {
    const code = videoUrl.split('aparat.com/v/')[1].split(/[/?]/)[0];
    embedUrl = `https://www.aparat.com/video/video/embed/videohash/${code}/vt/frame`;
  }

  iframe.src = embedUrl;
  titleEl.textContent = title;
  wrap.classList.add('active');
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.querySelectorAll('.episode-item').forEach(e => e.classList.remove('playing'));
  STATE.currentEpisode = id;
}

/* ══════════════════════════════════════════
   GALLERY PAGE
══════════════════════════════════════════ */
async function loadGallery(filter = 'all') {
  const container = document.getElementById('gallery-container');
  container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  let query = sb.from('gallery_items')
    .select('*, users(username, score)')
    .order('is_instructor', { ascending: false })
    .order('created_at', { ascending: false });

  if (filter !== 'all') query = query.eq('chapter_num', filter);

  const { data: items } = await query;

  if (!items || items.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🖼️</div><div class="empty-text">هنوز اثری آپلود نشده</div></div>';
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="gallery-item ${item.is_instructor ? 'instructor-work' : ''}" onclick="openGalleryItem('${item.id}')">
      <div class="gallery-img-wrap">
        <img src="${item.file_url}" alt="${item.title||''}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'200\\' height=\\'200\\'><rect fill=\\'%231A1A35\\'/><text x=\\'50%\\' y=\\'50%\\' fill=\\'%23666\\' text-anchor=\\'middle\\'>تصویر</text></svg>'">
        ${item.is_instructor ? '<span class="instructor-badge">👑 مدرس</span>' : ''}
      </div>
      <div class="gallery-item-info">
        <div class="gallery-item-user">@${item.users?.username || 'ناشناس'}</div>
        <div class="gallery-item-chapter">فصل ${item.chapter_num} — ${item.chapter_title || ''}</div>
        <div class="gallery-item-footer">
          <button class="like-btn ${isLiked(item.id) ? 'liked' : ''}" onclick="event.stopPropagation(); toggleLike('${item.id}', this)">
            <span class="like-icon"></span>
            <span class="like-count">${item.likes_count || 0}</span>
          </button>
          <span style="font-size:0.72rem;color:var(--muted)">${timeAgo(item.created_at)}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function isLiked(itemId) {
  const likes = JSON.parse(localStorage.getItem('tg_likes') || '[]');
  return likes.includes(itemId);
}

async function toggleLike(itemId, btn) {
  const likes = JSON.parse(localStorage.getItem('tg_likes') || '[]');
  const idx = likes.indexOf(itemId);
  const countEl = btn.querySelector('.like-count');

  if (idx === -1) {
    // Like
    likes.push(itemId);
    btn.classList.add('liked');
    const current = parseInt(countEl.textContent) || 0;
    countEl.textContent = current + 1;
    await sb.from('gallery_items').update({ likes_count: current + 1 }).eq('id', itemId);
    await sb.from('likes').insert({ user_id: STATE.user.id, item_id: itemId });
  } else {
    // Unlike
    likes.splice(idx, 1);
    btn.classList.remove('liked');
    const current = parseInt(countEl.textContent) || 1;
    countEl.textContent = Math.max(0, current - 1);
    await sb.from('gallery_items').update({ likes_count: Math.max(0, current - 1) }).eq('id', itemId);
    await sb.from('likes').delete().eq('user_id', STATE.user.id).eq('item_id', itemId);
  }
  localStorage.setItem('tg_likes', JSON.stringify(likes));
}

function openGalleryItem(id) {
  // نمایش تصویر بزرگ (در فاز بعد)
}

/* ── آپلود اثر ── */
function openUploadModal() {
  document.getElementById('upload-modal').classList.add('open');
}

async function handleUpload() {
  const file       = document.getElementById('upload-file').files[0];
  const chapterNum = document.getElementById('upload-chapter').value;
  const title      = document.getElementById('upload-title').value.trim();

  if (!file) { showToast('لطفاً یک فایل انتخاب کنید', 'error'); return; }
  if (!chapterNum) { showToast('لطفاً فصل را مشخص کنید', 'error'); return; }
  if (file.size > 15 * 1024 * 1024) { showToast('حجم فایل نباید بیشتر از ۱۵ مگابایت باشد', 'error'); return; }

  const allowed = ['image/jpeg','image/jpg','image/png','video/mp4'];
  if (!allowed.includes(file.type)) { showToast('فرمت فایل مجاز نیست (JPG, PNG, MP4)', 'error'); return; }

  const btn = document.getElementById('upload-btn');
  btn.disabled = true; btn.innerHTML = 'در حال آپلود... <span class="spinner" style="display:inline-block;width:16px;height:16px"></span>';

  try {
    const ext = file.name.split('.').pop();
    const path = `gallery/${STATE.user.id}/${Date.now()}.${ext}`;
    const { data: uploaded, error: upErr } = await sb.storage.from('gallery').upload(path, file);
    if (upErr) throw upErr;

    const { data: urlData } = sb.storage.from('gallery').getPublicUrl(path);

    await sb.from('gallery_items').insert({
      user_id: STATE.user.id,
      file_url: urlData.publicUrl,
      file_type: file.type.startsWith('video') ? 'video' : 'image',
      chapter_num: parseInt(chapterNum),
      chapter_title: document.getElementById('upload-chapter').selectedOptions[0]?.text || '',
      title: title || null,
      is_instructor: false,
      likes_count: 0,
      created_at: new Date().toISOString(),
    });

    document.getElementById('upload-modal').classList.remove('open');
    showToast('اثر شما با موفقیت آپلود شد ⚔️', 'success');
    loadGallery();
  } catch(e) {
    showToast('خطا در آپلود. دوباره تلاش کنید', 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'آپلود اثر 🔥';
  }
}

/* ══════════════════════════════════════════
   CODEX PAGE
══════════════════════════════════════════ */
async function loadCodex() {
  const container = document.getElementById('codex-container');
  container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  const { data: chapters } = await sb
    .from('codex_chapters')
    .select('*')
    .order('order_num');

  if (!chapters || chapters.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📖</div><div class="empty-text">کدکس تراگوس در حال آماده‌سازی است</div></div>';
    return;
  }

  container.innerHTML = chapters.map(ch => `
    <div class="codex-chapter">
      <div class="codex-chapter-header" onclick="toggleCodex(this, '${ch.id}', ${ch.is_locked})">
        <div class="codex-ch-num">${ch.order_num}</div>
        <div class="codex-ch-title">${ch.title}</div>
        <span class="codex-locked">${ch.is_locked ? '🔒' : '📖'}</span>
      </div>
      <div class="codex-chapter-body" id="codex-body-${ch.id}">
        ${ch.is_locked ? '<div class="empty-state"><div class="empty-icon">🔒</div><div class="empty-text">این فصل هنوز باز نشده</div></div>' : `
          ${ch.lore ? `<div class="codex-section"><div class="codex-section-title">⚔️ داستان فصل — The Lore</div><div class="codex-text">${ch.lore}</div></div>` : ''}
          ${ch.knowledge ? `<div class="codex-section"><div class="codex-section-title">📜 آموزش — Knowledge</div><div class="codex-text">${ch.knowledge}</div></div>` : ''}
          ${ch.image_url ? `<img src="${ch.image_url}" class="codex-img" alt="تصویر فصل">` : ''}
        `}
      </div>
    </div>
  `).join('');
}

function toggleCodex(headerEl, chId, isLocked) {
  const body = document.getElementById(`codex-body-${chId}`);
  body.classList.toggle('open');
}

/* ══════════════════════════════════════════
   CHALLENGES PAGE
══════════════════════════════════════════ */
async function loadChallenges() {
  const container = document.getElementById('challenges-container');
  container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  const { data: challenges } = await sb
    .from('challenges')
    .select('*')
    .order('chapter_num');

  if (!challenges || challenges.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⚔️</div><div class="empty-text">چالش‌ها به زودی اضافه می‌شوند</div></div>';
    return;
  }

  container.innerHTML = challenges.map(ch => `
    <div class="challenge-card">
      <div class="challenge-badge">⚔️ فصل ${ch.chapter_num} — ${ch.chapter_title||''}</div>
      <div class="challenge-title">${ch.title}</div>
      <div class="challenge-desc">${ch.description}</div>
      ${ch.image_url ? `<img src="${ch.image_url}" class="challenge-img" alt="تصویر چالش">` : ''}
    </div>
  `).join('');
}

/* ══════════════════════════════════════════
   TOOLS PAGE
══════════════════════════════════════════ */
async function loadTools() {
  const container = document.getElementById('tools-container');
  container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  const { data: tools } = await sb
    .from('tools')
    .select('*')
    .order('category', 'title');

  if (!tools || tools.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🛠️</div><div class="empty-text">ابزارها به زودی اضافه می‌شوند</div></div>';
    return;
  }

  container.innerHTML = `<div class="tools-grid">${tools.map(t => `
    <div class="tool-card">
      <div class="tool-cat">${t.category||'عمومی'}</div>
      <div class="tool-title">${t.title}</div>
      <div class="tool-desc">${t.description||''}</div>
      ${t.file_url && t.downloadable ? `<a href="${t.file_url}" download class="tool-download">⬇️ دانلود</a>` : ''}
      ${t.link_url ? `<a href="${t.link_url}" target="_blank" class="tool-download">🔗 مشاهده</a>` : ''}
    </div>
  `).join('')}</div>`;
}

/* ══════════════════════════════════════════
   ABOUT / APP TUTORIAL
══════════════════════════════════════════ */
async function loadAbout() {
  const { data } = await sb.from('settings').select('*').eq('key', 'about').single();
  if (data) document.getElementById('about-content').innerHTML = data.value || '';

  const { data: vid } = await sb.from('settings').select('*').eq('key', 'tutorial_video').single();
  if (vid && vid.value) {
    let embedUrl = vid.value;
    if (vid.value.includes('aparat.com/v/')) {
      const code = vid.value.split('aparat.com/v/')[1].split(/[/?]/)[0];
      embedUrl = `https://www.aparat.com/video/video/embed/videohash/${code}/vt/frame`;
    }
    document.getElementById('tutorial-iframe').src = embedUrl;
    document.getElementById('tutorial-video-wrap').style.display = 'block';
  }
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'همین الان';
  if (m < 60) return `${m} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ساعت پیش`;
  const d = Math.floor(h / 24);
  return `${d} روز پیش`;
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

/* ── Gallery Filter ── */
function setGalleryFilter(btn, filter) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadGallery(filter);
}
