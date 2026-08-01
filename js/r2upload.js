/* ═══════════════════════════════════════════
   TRAGOS — Cloudinary Upload
   رایگان، بدون کارت بانکی، ۲۵GB
   ⚠️ بعد از ثبت‌نام در Cloudinary این مقادیر رو پر کن
═══════════════════════════════════════════ */

const CLOUDINARY_CONFIG = {
  cloudName:    'ja526cef',    // از dashboard Cloudinary
  uploadPreset: 'tragos_upload',      // بعد از ساخت preset این رو پر کن
};

/* ── آپلود به Cloudinary ── */
async function uploadToR2(file, userId) {
  if (!isR2Ready()) throw new Error('Cloudinary تنظیم نشده');

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  formData.append('folder', `tragos/gallery/${userId}`);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'خطا در آپلود');
  }

  const data = await res.json();
  return data.secure_url;
}

/* ── چک کردن وضعیت ── */
function isR2Ready() {
  return CLOUDINARY_CONFIG.cloudName !== 'YOUR_CLOUD_NAME' &&
         CLOUDINARY_CONFIG.uploadPreset !== 'YOUR_UPLOAD_PRESET';
}
