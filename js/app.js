/* ═══════════════════════════════════════════
   TRAGOS — Cloudflare R2 Config
   ⚠️ بعد از راه‌اندازی R2 پر کن
═══════════════════════════════════════════ */
const R2_CONFIG = {
  accountId: 'YOUR_CF_ACCOUNT_ID',
  bucketName: 'tragos-gallery',
  publicUrl: 'YOUR_R2_PUBLIC_URL', // مثال: https://pub-xxxx.r2.dev
  workerUrl: 'YOUR_WORKER_URL',    // مثال: https://tragos-upload.workers.dev
};

// آپلود به R2 از طریق Worker
async function uploadToR2(file) {
  const ext = file.name.split('.').pop();
  const filename = `gallery/${STATE.user.id}/${Date.now()}.${ext}`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('filename', filename);

  const res = await fetch(R2_CONFIG.workerUrl, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) throw new Error('خطا در آپلود به R2');
  const data = await res.json();
  return data.url || `${R2_CONFIG.publicUrl}/${filename}`;
}

/* ═══════════════════════════════════════════
   TRAGOS — App Core v2
═══════════════════════════════════════════ */

const STATE = { user: null, deviceId: null, currentPage: 'courses', currentGalleryFilter: 'all' };

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
  if (!phone || phone.length !== 11 || !/^[0-9]{11}$/.test(phone)) {
    const phoneEl = document.getElementById("reg-phone");
    phoneEl.style.borderColor = "#ff4444";
    phoneEl.style.boxShadow = "0 0 0 2px rgba(255,68,68,0.2)";
    showToast("شماره تلفن باید دقیقاً ۱۱ رقم عددی باشد", "error");
    return;
  }

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
async function loadGalleryFilters(activeFilter = 'all') {
  const filterWrap = document.getElementById('gallery-filter');
  const { data: chapters } = await sb.from('chapters').select('order_num, title').order('order_num');
  let html = `<button class="filter-btn ${activeFilter==='all'?'active':''}" onclick="setGalleryFilter(this,'all')">همه</button>`;
  if (chapters) {
    chapters.forEach(ch => {
      html += `<button class="filter-btn ${activeFilter==ch.order_num?'active':''}" onclick="setGalleryFilter(this,'${ch.order_num}')">فصل ${ch.order_num}</button>`;
    });
  }
  filterWrap.innerHTML = html;
}

async function loadGallery(filter = 'all') {
  await loadGalleryFilters(filter);

  // ── بخش استاد ──
  await loadInstructorGallery();

  // ── بخش دانشجوها ──
  const container = document.getElementById('gallery-container');
  container.innerHTML = '<div style="grid-column:span 2" class="empty-state"><div class="spinner"></div></div>';

  let query = sb.from('gallery_items')
    .select('*, users(username)')
    .eq('is_instructor', false)
    .order('created_at', { ascending: false });
  if (filter !== 'all') query = query.eq('chapter_num', parseInt(filter));

  const { data: items } = await query;
  if (!items || items.length === 0) {
    container.innerHTML = `<div style="grid-column:span 2" class="empty-state"><div class="empty-icon">🖼️</div><div class="empty-text">${get('empty_gallery','هنوز اثری آپلود نشده')}</div></div>`;
    return;
  }

  const likes = JSON.parse(localStorage.getItem('tg_likes') || '[]');
  container.innerHTML = items.map(item => buildGalleryCard(item, likes, false)).join('');
}

async function loadInstructorGallery() {
  const wrap = document.getElementById('instructor-gallery-wrap');
  const container = document.getElementById('instructor-gallery-container');
  container.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';

  const { data: items } = await sb.from('gallery_items')
    .select('*, users(username)')
    .eq('is_instructor', true)
    .order('created_at', { ascending: false });

  if (!items || items.length === 0) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'block';
  const likes = JSON.parse(localStorage.getItem('tg_likes') || '[]');
  container.innerHTML = items.map(item => buildGalleryCard(item, likes, true)).join('');
}

/* ── ساخت کارت گالری ── */
function buildGalleryCard(item, likes, isInstructor) {
  const isOwner = STATE.user && item.user_id === STATE.user.id;
  const itemJson = JSON.stringify(item).replace(/"/g,'&quot;');
  return `
    <div class="gallery-item ${isInstructor?'instructor-pinned':''}" onclick="openGalleryModal('${item.id}')">
      <div class="gallery-img-wrap">
        <img src="${item.file_url}" alt="${item.title||''}" loading="lazy">
        ${isInstructor ? '<span class="instructor-badge">👑 استاد</span>' : ''}
      </div>
      <div class="gallery-item-info">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:4px">
          <div class="gallery-item-user" style="${isInstructor?'color:var(--gold)':''}">
            ${isInstructor ? 'اثر استاد' : '@'+( item.users?.username||'ناشناس')}
          </div>
          ${isOwner ? `<button onclick="event.stopPropagation();deleteMyGalleryItem('${item.id}')"
            style="background:none;border:none;color:var(--muted);font-size:0.85rem;cursor:pointer;line-height:1;padding:2px 4px">🗑️</button>` : ''}
        </div>
        <div class="gallery-item-chapter">فصل ${item.chapter_num} — ${item.chapter_title||''}</div>
        ${item.title ? `<div style="font-size:0.75rem;color:var(--parch);margin-top:1px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${item.title}</div>` : ''}
        <div class="gallery-item-footer">
          <button class="like-btn ${likes.includes(item.id)?'liked':''}"
            onclick="event.stopPropagation();toggleLike('${item.id}',this)">
            <span class="like-icon"></span>
            <span class="like-count">${item.likes_count||0}</span>
          </button>
        </div>
      </div>
    </div>`;
}

async function deleteMyGalleryItem(id) {
  if (!confirm('اثر شما حذف شود؟')) return;
  await sb.from('gallery_items').delete().eq('id', id).eq('user_id', STATE.user.id);
  showToast('اثر حذف شد', 'success');
  loadGallery();
}

function openGalleryModal(itemId) {
  document.getElementById('gallery-modal').classList.add('open');
  document.getElementById('gmodal-img').src = '';
  document.getElementById('gmodal-img').style.opacity = '0';
  document.getElementById('gmodal-loading').style.display = 'block';

  sb.from('gallery_items').select('*, users(username)').eq('id', itemId).limit(1).then(({data, error}) => {
    if (error || !data || data.length === 0) {
      showToast('خطا در بارگذاری تصویر', 'error');
      document.getElementById('gallery-modal').classList.remove('open');
      return;
    }
    const item = data[0];
    const likes = JSON.parse(localStorage.getItem('tg_likes') || '[]');
    const liked = likes.includes(item.id);
    const isOwner = STATE.user && item.user_id === STATE.user.id;

    const img = document.getElementById('gmodal-img');
    img.onload = () => { img.style.opacity = '1'; document.getElementById('gmodal-loading').style.display = 'none'; };
    img.src = item.file_url;

    document.getElementById('gmodal-title').textContent = item.title || '';
    document.getElementById('gmodal-user').textContent = item.is_instructor ? '👑 اثر استاد' : '@' + (item.users?.username || 'ناشناس');
    document.getElementById('gmodal-chapter').textContent = 'فصل ' + item.chapter_num + ' — ' + (item.chapter_title||'');
    document.getElementById('gmodal-likes').textContent = item.likes_count || 0;

    const likeBtn = document.getElementById('gmodal-like-btn');
    likeBtn.className = 'like-btn' + (liked ? ' liked' : '');
    likeBtn.onclick = () => {
      toggleLike(item.id, likeBtn);
      // sync count to card
      setTimeout(() => loadGallery(STATE.currentGalleryFilter || 'all'), 500);
    };

    // دکمه حذف در modal (فقط برای صاحب اثر)
    const delBtn = document.getElementById('gmodal-delete-btn');
    if (isOwner && !item.is_instructor) {
      delBtn.style.display = 'inline-flex';
      delBtn.onclick = () => {
        if (confirm('اثر شما حذف شود؟')) {
          sb.from('gallery_items').delete().eq('id', item.id).eq('user_id', STATE.user.id).then(() => {
            document.getElementById('gallery-modal').classList.remove('open');
            showToast('اثر حذف شد', 'success');
            loadGallery();
          });
        }
      };
    } else {
      delBtn.style.display = 'none';
    }
  });
}

async function toggleLike(itemId, btn) {
  const likes = JSON.parse(localStorage.getItem('tg_likes') || '[]');
  const idx = likes.indexOf(itemId);
  const countEl = btn.querySelector('.like-count');

  // گرفتن تعداد واقعی از دیتابیس
  const { data: current } = await sb.from('gallery_items').select('likes_count').eq('id', itemId).limit(1);
  const realCount = current?.[0]?.likes_count || 0;

  if (idx === -1) {
    likes.push(itemId);
    btn.classList.add('liked');
    const newCount = realCount + 1;
    countEl.textContent = newCount;
    await sb.from('gallery_items').update({ likes_count: newCount }).eq('id', itemId);
    // sync modal like count
    const mLikes = document.getElementById('gmodal-likes');
    if (mLikes) mLikes.textContent = newCount;
  } else {
    likes.splice(idx, 1);
    btn.classList.remove('liked');
    const newCount = Math.max(0, realCount - 1);
    countEl.textContent = newCount;
    await sb.from('gallery_items').update({ likes_count: newCount }).eq('id', itemId);
    const mLikes = document.getElementById('gmodal-likes');
    if (mLikes) mLikes.textContent = newCount;
  }
  localStorage.setItem('tg_likes', JSON.stringify(likes));
}

function closeGalleryModal(e) {
  if (!e || e.target === document.getElementById('gallery-modal')) {
    document.getElementById('gallery-modal').classList.remove('open');
    document.getElementById('gmodal-img').src = '';
  }
}

async function openUploadModal() {
  // بارگذاری فصل‌ها از دیتابیس
  const { data: chapters } = await sb.from('chapters').select('order_num, title').order('order_num');
  const select = document.getElementById('upload-chapter');
  select.innerHTML = '<option value="">انتخاب فصل...</option>';
  if (chapters) {
    chapters.forEach(ch => {
      select.innerHTML += `<option value="${ch.order_num}">فصل ${ch.order_num} — ${ch.title}</option>`;
    });
  }
  document.getElementById('upload-modal').classList.add('open');
}

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
    let fileUrl = '';

    // اگه R2 تنظیم شده، از R2 استفاده کن وگرنه Supabase
    if (R2_CONFIG.workerUrl !== 'YOUR_WORKER_URL') {
      fileUrl = await uploadToR2(file);
    } else {
      const ext = file.name.split('.').pop();
      const path = `gallery/${STATE.user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from('gallery').upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = sb.storage.from('gallery').getPublicUrl(path);
      fileUrl = urlData.publicUrl;
    }

    await sb.from('gallery_items').insert({
      user_id: STATE.user.id,
      file_url: fileUrl,
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
    showToast('خطا در آپلود: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.innerHTML = 'آپلود اثر 🔥';
  }
}

function setGalleryFilter(btn, filter) {
  STATE.currentGalleryFilter = filter;
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
  // گرفتن تیک‌های این کاربر
  const { data: completions } = await sb.from('challenge_completions')
    .select('challenge_id').eq('user_id', STATE.user.id);
  const doneIds = new Set((completions||[]).map(c => c.challenge_id));

  container.innerHTML = data.map(ch => {
    const isDone = doneIds.has(ch.id);
    return `
    <div class="challenge-card ${isDone?'challenge-done':''}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div class="challenge-badge">⚔️ فصل ${ch.chapter_num} — ${ch.chapter_title||''}</div>
        <button onclick="toggleChallengeComplete('${ch.id}', this)"
          class="challenge-tick-btn ${isDone?'done':''}"
          title="${isDone?'انجام شده — کلیک برای لغو':'انجام دادم'}">
          ${isDone ? '✅' : '⬜'}
        </button>
      </div>
      <div class="challenge-title">${ch.title}</div>
      <div class="challenge-desc">${ch.description||''}</div>
      ${ch.image_url ? `<img src="${ch.image_url}" class="challenge-img" alt="">` : ''}
    </div>`;
  }).join('');
}

async function toggleChallengeComplete(challengeId, btn) {
  const isDone = btn.classList.contains('done');
  if (isDone) {
    await sb.from('challenge_completions')
      .delete().eq('user_id', STATE.user.id).eq('challenge_id', challengeId);
    btn.textContent = '⬜';
    btn.classList.remove('done');
    btn.closest('.challenge-card').classList.remove('challenge-done');
    showToast('تیک برداشته شد', 'info');
  } else {
    await sb.from('challenge_completions')
      .insert({ user_id: STATE.user.id, challenge_id: challengeId });
    btn.textContent = '✅';
    btn.classList.add('done');
    btn.closest('.challenge-card').classList.add('challenge-done');
    showToast('چالش تکمیل شد! 🎉', 'success');
  }
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
      ${t.prompt_text ? `
        <div class="prompt-box">
          <div class="prompt-label">📋 پرامپت قابل کپی</div>
          <div class="prompt-text">${t.prompt_text}</div>
          <button class="prompt-copy-btn" onclick="copyPrompt(this, \`${t.prompt_text.replace(/\`/g,'\`')}\`)">
            📋 کپی پرامپت
          </button>
        </div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        ${t.file_url && t.downloadable ? `<a href="${t.file_url}" download class="tool-download">⬇️ دانلود</a>` : ''}
        ${t.link_url ? `<a href="${t.link_url}" target="_blank" class="tool-download">🔗 مشاهده</a>` : ''}
      </div>
    </div>
  `).join('')}</div>`;
}

function copyPrompt(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✅ کپی شد!';
    btn.style.background = 'var(--gold)';
    btn.style.color = 'var(--void)';
    setTimeout(() => {
      btn.textContent = '📋 کپی پرامپت';
      btn.style.background = '';
      btn.style.color = '';
    }, 2000);
  });
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

function toShamsi(dateStr) {
  if (!dateStr) return '';
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(dateStr));
  } catch(e) { return ''; }
}
