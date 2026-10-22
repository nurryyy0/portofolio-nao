// ─── Public features helpers: komentar, kontak email, visitor ──
// Semua operasi publik (insert komentar, insert pesan, catat kunjungan)
// dilindungi RLS di sisi database; kode ini hanya memanggil API.
// Kalau Supabase nonaktif, fungsi-fungsi ini "gagal diam-diam" agar
// halaman public tetap tampil normal.

import { getSupabase, getCachedSession, isSupabaseEnabled } from "./storage";

export { isSupabaseEnabled };

// ── Komentar (guestbook) ─────────────────────────────────────
// Status komentar mengikuti konvensi database yang ADA di Supabase:
//   'published' = tampil untuk umum (auto, karena UI moderasi belum ada)
//   'pending' / 'hidden' = untuk moderasi admin di tahap berikutnya
// RLS tetap memvalidasi isi & melarang publik mengubah status.
/** Ambil komentar published + balasannya (thread) dari Supabase. */
export async function loadComments({ limit = 50, offset = 0 } = {}) {
  if (!isSupabaseEnabled) return [];
  const sb = await getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from("comments")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.warn("Gagal memuat komentar:", error.message);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("Gagal memuat komentar:", err);
    return [];
  }
}

/** Kirim komentar baru (tidak perlu login). */
export async function submitComment(name, content) {
  if (!isSupabaseEnabled) {
    return { error: { message: "Komentar tidak tersedia (Supabase nonaktif)." } };
  }
  const sb = await getSupabase();
  if (!sb) {
    return { error: { message: "Komentar tidak tersedia (Supabase nonaktif)." } };
  }
  const trimmedName = String(name || "").trim().slice(0, 80);
  const trimmedContent = String(content || "").trim().slice(0, 2000);
  if (!trimmedName || !trimmedContent) {
    return { error: { message: "Nama dan komentar wajib diisi." } };
  }
  try {
    const { data, error } = await sb
      .from("comments")
      .insert({ name: trimmedName, content: trimmedContent, status: "published", is_admin: false, parent_id: null })
      .select()
      .single();
    if (error) return { error };
    return { data, error: null };
  } catch (err) {
    return { error: err };
  }
}

// ── Kontak email ─────────────────────────────────────────────
/** Kirim pesan kontak: disimpan ke Supabase + memicu edge function email. */
export async function submitContactMessage(email, message) {
  if (!isSupabaseEnabled) {
    return { error: { message: "Formulir email tidak tersedia (Supabase nonaktif)." } };
  }
  const sb = await getSupabase();
  if (!sb) {
    return { error: { message: "Formulir email tidak tersedia (Supabase nonaktif)." } };
  }
  const trimmedEmail = String(email || "").trim().slice(0, 254);
  const trimmedMessage = String(message || "").trim().slice(0, 5000);
  if (!trimmedEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
    return { error: { message: "Email tidak valid." } };
  }
  if (!trimmedMessage) {
    return { error: { message: "Pesan wajib diisi." } };
  }

  // ID unik pesan (untuk idempotensi email + verifikasi anti-spam di edge function).
  const messageId = crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);

  // 1) Simpan pesan ke tabel contact_messages — anon hanya di-grant INSERT,
  //    TIDAK BOLEH SELECT (RLS sengaja menyembunyikan pesan dari publik).
  //    Jadi jangan chain `.select()` di sini: INSERT saja cukup.
  try {
    const { error } = await sb
      .from("contact_messages")
      .insert({
        email: trimmedEmail,
        message: trimmedMessage,
        status: "new",
        message_id: messageId,
      });

    if (error) throw error;

    // 2) Panggil edge function send-contact-email (aman, secret di server).
    //    Kalau belum dideploy, jangan gagalkan UX — pesan tetap tersimpan.
    let emailSent = false;
    let emailError = null;
    try {
      const { error: fnError } = await sb.functions.invoke("send-contact-email", {
        body: {
          email: trimmedEmail,
          message: trimmedMessage,
          messageId, // untuk Idempotency-Key (cegah email ganda)
        },
      });
      emailSent = !fnError;
      if (fnError) emailError = fnError;
    } catch (err) {
      emailError = err;
      console.warn("Edge function send-contact-email belum aktif:", err);
    }

    return { data: { id: messageId }, emailSent, emailError, error: null };
  } catch (err) {
    // Kegagalan menyimpan = kegagalan total; tidak lanjut ke email.
    return { error: err };
  }
}

// ── Visitor tracking ─────────────────────────────────────────
const VISITOR_SESSION_KEY = "portfolio_visitor_session_v1";

function getVisitorDeviceInfo() {
  const userAgent = navigator.userAgent;
  let deviceType;
  let deviceName;

  const androidModel = userAgent.match(/;\s*([^;()]+?)\s+Build\//i)?.[1]?.trim();
  if (
    /iPad|Tablet|PlayBook|Silk/i.test(userAgent) ||
    (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent)) ||
    (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1)
  ) {
    deviceType = "Tablet";
    deviceName = /iPad/i.test(userAgent) ? "iPad" : androidModel || "Tablet";
  } else if (/Mobi|iPhone|iPod|Android/i.test(userAgent)) {
    deviceType = "Mobile";
    deviceName = /iPhone/i.test(userAgent)
      ? "iPhone"
      : /iPod/i.test(userAgent)
        ? "iPod"
        : androidModel || "Android phone";
  } else {
    deviceType = "Desktop";
    deviceName = /Windows/i.test(userAgent)
      ? "Windows PC"
      : /Macintosh|Mac OS/i.test(userAgent)
        ? "Mac"
        : /CrOS/i.test(userAgent)
          ? "Chromebook"
          : "Linux PC";
  }

  return { deviceType, deviceName: deviceName.slice(0, 100) };
}

/** Catat satu kunjungan (sekali per sesi browser/tab). */
export async function trackVisit() {
  if (!isSupabaseEnabled) return;
  // Pakai sessionStorage: hanya bertahan selama tab terbuka, sehingga
  // berpindah halaman dalam satu sesi tidak menambah counter, tapi
  // buka tab baru / refresh penuh (bagi browser yang menghapus) dicatat.
  try {
    // getCachedSession: panggilan sesi di-dedupe dengan useAdmin (Navbar),
    // supaya tidak ada request sesi ganda saat halaman pertama dibuka.
    const { session, error: sessionError } = await getCachedSession();
    if (sessionError) {
      console.warn("Gagal memeriksa sesi sebelum mencatat kunjungan:", sessionError.message);
      return;
    }
    if (session) return;

    if (sessionStorage.getItem(VISITOR_SESSION_KEY)) return;
    const sessionId = crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    sessionStorage.setItem(VISITOR_SESSION_KEY, sessionId);
    const deviceInfo = getVisitorDeviceInfo();

    const sb = await getSupabase();
    if (!sb) {
      // Client gagal dimuat → jangan simpan flag, biar bisa dicoba lagi.
      sessionStorage.removeItem(VISITOR_SESSION_KEY);
      return;
    }
    const { error } = await sb.from("visitors").insert({
      session_id: sessionId,
      device_type: deviceInfo.deviceType,
      device_name: deviceInfo.deviceName,
    });
    if (error) {
      // Jangan simpan flag kalau gagal, supaya coba lagi next load.
      sessionStorage.removeItem(VISITOR_SESSION_KEY);
      console.warn("Gagal mencatat kunjungan:", error.message);
    }
  } catch (err) {
    console.warn("Gagal mencatat kunjungan:", err);
  }
}