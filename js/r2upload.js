/* ═══════════════════════════════════════════
   TRAGOS — Cloudflare R2 Upload
   ⚠️ بعد از راه‌اندازی R2، این مقادیر رو پر کن
═══════════════════════════════════════════ */

// این مقادیر رو از Cloudflare R2 میگیری
const R2_CONFIG = {
  accountId:   'YOUR_ACCOUNT_ID',      // از Cloudflare dashboard
  bucketName:  'tragos-gallery',        // نام bucket که می‌سازی
  publicUrl:   'YOUR_R2_PUBLIC_URL',    // مثل: https://pub-xxxx.r2.dev
  workerUrl:   'YOUR_WORKER_URL',       // آدرس Worker که می‌سازی
};

/* ── آپلود به R2 از طریق Worker ── */
async function uploadToR2(file, userId) {
  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `gallery/${userId}/${Date.now()}.${ext}`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('key', fileName);

  const response = await fetch(R2_CONFIG.workerUrl + '/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error('خطا در آپلود: ' + err);
  }

  const result = await response.json();
  return R2_CONFIG.publicUrl + '/' + fileName;
}

/* ── چک کردن وضعیت R2 ── */
function isR2Ready() {
  return R2_CONFIG.workerUrl !== 'YOUR_WORKER_URL';
}
