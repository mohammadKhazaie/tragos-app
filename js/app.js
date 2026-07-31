/* ═══════════════════════════════════════════
   TRAGOS — App Core v2
═══════════════════════════════════════════ */

const STATE = { user: null, deviceId: null, currentPage: 'courses' };

document.addEventListener('DOMContentLoaded', async () => {
  initDeviceId();
  await loadSettings();
  await checkAuth();
  initNavigation();
  startLoadingBar();
});

/* ── Device ID ── */
function initDeviceId() {
  let did = localStorage.getItem('tg_device_id');
  if (!did) {
    did = 'dev_' + Date.now() + '_' + Math.random().toString(36).substr(2,9);
    localStorage.setItem('tg_device_id', did);
  }
  STATE.deviceId = did;
}

/* ══════════════════════════════════════════
   AUTH — با پشتیبانی لینک اختصاصی
══════════════════════════════════════════ */
async function checkAuth() {
  // چک لینک اختصاصی در URL
  const urlParams = new URLSearchParams(window.location.search);
  const linkCode = urlParams.get('invite');
  if (linkCode) {
    history.replaceState({}, '', window.location.pathname);
    await processInviteCode(linkCode);
    return;
  }

  // چک لاگین ذخیره شده
  const userId = localStorage.getItem('tg_user_id');
  if (!userId) { showLoginPage(); return; }

  const { data } = await sb.from('users').select('*').eq('id', userId).eq('device_id', STATE.deviceId).limit(1);
  if (!data || data.length === 0) {
    localStorage.removeItem('tg_user_id');
    showLoginPage();
    return;
  }
  STATE.user = data[0];
  showApp();
}

/* ── پردازش کد دعوت (از فرم یا لینک) ── */
async function processInviteCode(code) {
  const { data, error } = await sb.from('invite_codes').select('*').eq('code', code).limit(1);

  if (error || !data || data.length === 0) {
    showLoginPage();
    showLoginError('کد وارد شده معتبر نیست');
    return;
  }

  const invite = data[0];

  if (invite.used && invite.device_id !== STATE.deviceId) {
    showLoginPage();
    showLoginError('این کد قبلاً روی دستگاه دیگری ثبت شده است');
    return;
  }

  if (!invite.used) {
    showLoginPage();
    showRegisterModal(invite.id, code);
    return;
  }

  // لاگین کاربر قبلی
  const { data: users } = await sb.from('users').select('*').eq('invite_id', invite.id).limit(1);
  if (users && users.length > 0) {
    STATE.user = users[0];
    localStorage.setItem('tg_user_id', users[0].id);
    await sb.from('users').update({ device_id: STATE.deviceId, last_login: new Date().toISOString() }).eq('id', users[0].id);
    showApp();
  } else {
    showLoginPage();
  }
}

/* ── Login ── */
async function handleLogin() {
  const code = document.getElementById('login-code').value.trim();
  document.getElementById('login-error').style.display = 'none';
  if (!code) { showLoginError('لطفاً کد اختصاصی خود را وارد کنید'); return; }

  const btn = document.getElementById('login-btn');
  btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;display:inline-block"></span>';
  btn.disabled = true;

  await processInviteCode(code);

  btn.innerHTML = get('login_btn_text', 'ورود به تراگوس ⚔️');
  btn.disabled = false;
}

/* ── Register ── */
function showRegisterModal(inviteId, code) {
  document.getElementById('reg-invite-id').value = inviteId;
  document.getElementById('reg-code').value = code;
  document.getElementById('register-modal').classList.add('open');
}

async function handleRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const phone    = document.getElementById('reg-phone').value.trim();
  const inviteId = document.getElementById('reg-invite-id').value;

  if (!username) { showToast('نام کاربری الزامی است', 'error'); return; }
  if (!phone || phone.length < 10) { showToast('شماره تلفن معتبر نیست', 'error'); return; }

  const btn = document.getElementById('reg-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;display:inline-block"></span>';

  try {
    const { data: existing } = await sb.from('users').select('id').eq('username', username).limit(1);
    if (existing && existing.length > 0) { showToast('این نام کاربری قبلاً استفاده شده', 'error'); return; }

    const { data: newUser, error } = await sb.from('users').insert({
      username, phone,
      invite_id: inviteId,
      device_id: STATE.deviceId,
      score: 0,
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
    }).select().limit(1);

    if (error) throw error;

    await sb.from('invite_codes').update({
      used: true, device_id: STATE.deviceId, used_at: new Date().toISOString()
    }).eq('id', inviteId);

    STATE.user = newUser[0];
    localStorage.setItem('tg_user_id', newUser[0].id);
    document.getElementById('register-modal').classList.remove('open');
    showApp();
    showToast('خوش آمدی پادشاه! 👑', 'success');
  } catch(e) {
    showToast('خطا در ثبت‌نام: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'ورود به تراگوس 👑';
  }
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg; el.style.display = 'block';
}

/* ══════════════════════════════════════════
   SHOW / HIDE
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
  navigateTo('courses');
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
    item.addEventListener('click', () => { if (item.dataset.page) navigateTo(item.dataset.page); });
  });
}

function navigateTo(page) {
  STATE.currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  const navEl  = document.querySelector('.nav-item[data-page="' + page + '"]');
  if (pageEl) pageEl.classList.add('active');
  if (navEl)  navEl.classList.add('active');
  loadPage(page);
  window.scrollTo(0,0);
}

function loadPage(page) {
  const map = {
    courses: loadCourses, gallery: loadGallery,
    codex: loadCodex, challenges: loadChallenges,
    tools: loadTools,
  };
  if (map[page]) map[page]();
}

/* ══════════════════════════════════════════
   LOADING
══════════════════════════════════════════ */
function startLoadingBar() {
  setTimeout(() => {
    const ls = document.getElementById('loading-screen');
    if (ls) { ls.classList.add('fade-out'); setTimeout(() => ls.style.display='none', 600); }
  }, 1800);
}

/* ══════════════════════════════════════════
   COURSES
══════════════════════════════════════════ */
async function loadCourses() {
  const container = document.getElementById('chapters-container');
  container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  const { data: chapters } = await sb.from('chapters').select('*, episodes(*)').order('order_num');

  if (!chapters || chapters.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📖</div><div class="empty-text">${get('empty_courses','به زودی محتوا اضافه می‌شود')}</div></div>`;
    return;
  }

  container.innerHTML = chapters.map(ch => `
    <div class="chapter-block">
      <div class="chapter-header" onclick="toggleChapter(this,'${ch.id}')">
        <span class="chapter-num">فصل ${ch.order_num}</span>
        <span class="chapter-title">${ch.title}</span>
        ${ch.title_en ? `<span class="chapter-en">${ch.title_en}</span>` : ''}
        <span class="chapter-arrow">▼</span>
      </div>
      <div class="episodes-list" id="eps-${ch.id}">
        ${(ch.episodes||[]).sort((a,b)=>a.order_num-b.order_num).map(ep=>`
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
  document.getElementById('eps-' + chapterId).classList.toggle('open');
}

function playEpisode(id, videoUrl, title) {
  if (!videoUrl) { showToast('ویدیو این قسمت به زودی اضافه می‌شود', 'info'); return; }
  const wrap = document.getElementById('video-player-wrap');
  const iframe = document.getElementById('video-iframe');
  let embedUrl = videoUrl;
  if (videoUrl.includes('aparat.com/v/')) {
    const code = videoUrl.split('aparat.com/v/')[1].split(/[/?]/)[0];
    embedUrl = `https://www.aparat.com/video/video/embed/videohash/${code}/vt/frame`;
  }
  iframe.src = embedUrl;
  document.getElementById('video-ep-title').textContent = title;
  wrap.classList.add('active');
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ══════════════════════════════════════════
   GALLERY
══════════════════════════════════════════ */
async function loadGallery(filter = 'all') {
  const container = document.getElementById('gallery-container');
  container.innerHTML = '<div style="grid-column:span 2" class="empty-state"><div class="spinner"></div></div>';

  let query = sb.from('gallery_items').select('*, users(username)')
    .order('is_instructor', { ascending: false })
    .order('created_at', { ascending: false });
  if (filter !== 'all') query = query.eq('chapter_num', filter);

  const { data: items } = await query;
  if (!items || items.length === 0) {
    container.innerHTML = `<div style="grid-column:span 2" class="empty-state"><div class="empty-icon">🖼️</div><div class="empty-text">${get('empty_gallery','هنوز اثری آپلود نشده')}</div></div>`;
    return;
  }

  const likes = JSON.parse(localStorage.getItem('tg_likes') || '[]');
  container.innerHTML = items.map(item => `
    <div class="gallery-item ${item.is_instructor ? 'instructor-work' : ''}">
      <div class="gallery-img-wrap">
        <img src="${item.file_url}" alt="${item.title||''}" loading="lazy">
        ${item.is_instructor ? '<span class="instructor-badge">👑 مدرس</span>' : ''}
      </div>
      <div class="gallery-item-info">
        <div class="gallery-item-user">@${item.users?.username||'ناشناس'}</div>
        <div class="gallery-item-chapter">فصل ${item.chapter_num} — ${item.chapter_title||''}</div>
        <div class="gallery-item-footer">
          <button class="like-btn ${likes.includes(item.id)?'liked':''}" onclick="toggleLike('${item.id}',this)">
            <span class="like-icon"></span>
            <span class="like-count">${item.likes_count||0}</span>
          </button>
          <span style="font-size:0.72rem;color:var(--muted)">${timeAgo(item.created_at)}</span>
        </div>
      </div>
    </div>
  `).join('');
}

async function toggleLike(itemId, btn) {
  const likes = JSON.parse(localStorage.getItem('tg_likes') || '[]');
  const idx = likes.indexOf(itemId);
  const countEl = btn.querySelector('.like-count');
  const current = parseInt(countEl.textContent) || 0;
  if (idx === -1) {
    likes.push(itemId);
    btn.classList.add('liked');
    countEl.textContent = current + 1;
    await sb.from('gallery_items').update({ likes_count: current + 1 }).eq('id', itemId);
  } else {
    likes.splice(idx, 1);
    btn.classList.remove('liked');
    countEl.textContent = Math.max(0, current - 1);
    await sb.from('gallery_items').update({ likes_count: Math.max(0, current - 1) }).eq('id', itemId);
  }
  localStorage.setItem('tg_likes', JSON.stringify(likes));
}

function openUploadModal() { document.getElementById('upload-modal').classList.add('open'); }

async function handleUpload() {
  const file = document.getElementById('upload-file').files[0];
  const chapterNum = document.getElementById('upload-chapter').value;
  const title = document.getElementById('upload-title').value.trim();

  if (!file) { showToast('لطفاً یک فایل انتخاب کنید', 'error'); return; }
  if (!chapterNum) { showToast('لطفاً فصل را مشخص کنید', 'error'); return; }
  if (file.size > 15 * 1024 * 1024) { showToast('حجم فایل نباید بیشتر از ۱۵ مگابایت باشد', 'error'); return; }
  const allowed = ['image/jpeg','image/jpg','image/png','video/mp4'];
  if (!allowed.includes(file.type)) { showToast('فرمت فایل مجاز نیست', 'error'); return; }

  const btn = document.getElementById('upload-btn');
  btn.disabled = true; btn.innerHTML = 'در حال آپلود...';

  try {
    const ext = file.name.split('.').pop();
    const path = `gallery/${STATE.user.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from('gallery').upload(path, file);
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
    showToast('اثر شما آپلود شد ⚔️', 'success');
    loadGallery();
  } catch(e) {
    showToast('خطا در آپلود: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'آپلود اثر 🔥';
  }
}

function setGalleryFilter(btn, filter) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadGallery(filter);
}

/* ══════════════════════════════════════════
   CODEX
══════════════════════════════════════════ */
async function loadCodex() {
  const container = document.getElementById('codex-container');
  container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  const { data } = await sb.from('codex_chapters').select('*').order('order_num');
  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📖</div><div class="empty-text">${get('empty_codex','کدکس در حال آماده‌سازی است')}</div></div>`;
    return;
  }
  container.innerHTML = data.map(ch => `
    <div class="codex-chapter">
      <div class="codex-chapter-header" onclick="toggleCodexCh(this,'${ch.id}')">
        <div class="codex-ch-num">${ch.order_num}</div>
        <div class="codex-ch-title">${ch.title}</div>
        <span class="codex-locked">${ch.is_locked ? '🔒' : '📖'}</span>
      </div>
      <div class="codex-chapter-body" id="codex-body-${ch.id}">
        ${ch.is_locked ? '<div class="empty-state"><div class="empty-icon">🔒</div><div class="empty-text">این فصل هنوز باز نشده</div></div>' : `
          ${ch.lore ? `<div class="codex-section"><div class="codex-section-title">⚔️ داستان فصل</div><div class="codex-text">${ch.lore}</div></div>` : ''}
          ${ch.knowledge ? `<div class="codex-section"><div class="codex-section-title">📜 آموزش</div><div class="codex-text">${ch.knowledge}</div></div>` : ''}
          ${ch.image_url ? `<img src="${ch.image_url}" class="codex-img" alt="">` : ''}
        `}
      </div>
    </div>
  `).join('');
}

function toggleCodexCh(headerEl, id) {
  document.getElementById('codex-body-' + id).classList.toggle('open');
}

/* ══════════════════════════════════════════
   CHALLENGES
══════════════════════════════════════════ */
async function loadChallenges() {
  const container = document.getElementById('challenges-container');
  container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  const { data } = await sb.from('challenges').select('*').order('chapter_num');
  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚔️</div><div class="empty-text">${get('empty_challenges','چالش‌ها به زودی اضافه می‌شوند')}</div></div>`;
    return;
  }
  container.innerHTML = data.map(ch => `
    <div class="challenge-card">
      <div class="challenge-badge">⚔️ فصل ${ch.chapter_num} — ${ch.chapter_title||''}</div>
      <div class="challenge-title">${ch.title}</div>
      <div class="challenge-desc">${ch.description||''}</div>
      ${ch.image_url ? `<img src="${ch.image_url}" class="challenge-img" alt="">` : ''}
    </div>
  `).join('');
}

/* ══════════════════════════════════════════
   TOOLS
══════════════════════════════════════════ */
async function loadTools() {
  const container = document.getElementById('tools-container');
  container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  const { data } = await sb.from('tools').select('*').order('category');
  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🛠️</div><div class="empty-text">${get('empty_tools','ابزارها به زودی اضافه می‌شوند')}</div></div>`;
    return;
  }
  container.innerHTML = `<div class="tools-grid">${data.map(t=>`
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
   ABOUT
══════════════════════════════════════════ */
async function loadAbout() {
  const { data } = await sb.from('settings').select('value').eq('key','about').limit(1);
  if (data && data.length > 0) document.getElementById('about-content').innerHTML = data[0].value || '';

  const { data: vid } = await sb.from('settings').select('value').eq('key','tutorial_video').limit(1);
  if (vid && vid.length > 0 && vid[0].value) {
    let embedUrl = vid[0].value;
    if (embedUrl.includes('aparat.com/v/')) {
      const code = embedUrl.split('aparat.com/v/')[1].split(/[/?]/)[0];
      embedUrl = `https://www.aparat.com/video/video/embed/videohash/${code}/vt/frame`;
    }
    document.getElementById('tutorial-iframe').src = embedUrl;
    document.getElementById('tutorial-video-wrap').style.display = 'block';
  }
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function showToast(msg, type='info', duration=3000) {
  const wrap = document.getElementById('toast-wrap');
  const icons = { success:'✅', error:'❌', info:'⚡' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]||'⚡'}</span><span>${msg}</span>`;
  wrap.appendChild(toast);
  setTimeout(() => { toast.style.opacity='0'; toast.style.transition='opacity 0.3s'; setTimeout(()=>toast.remove(),300); }, duration);
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'همین الان';
  if (m < 60) return `${m} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ساعت پیش`;
  return `${Math.floor(h/24)} روز پیش`;
}
