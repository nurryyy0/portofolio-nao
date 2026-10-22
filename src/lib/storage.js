// Supabase client helper.
// Dipakai otomatis kalau env `VITE_SUPABASE_URL` + key (publishable/anon) tersedia.
// Kalau tidak ada (misal dev lokal tanpa .env), data tampil dari fallback
// localStorage / konstanta default.
//
// ADMIN WRITE (tambah/edit/hapus Projek & Experience):
//   • Jalan utama: RPC `admin_save_projects` / `admin_save_experiences`
//     (SECURITY DEFINER, dibuat dari `supabase/fix_admin.sql`) — bebas dari
//     masalah grant/RLS/konflik upsert.
//   • Fallback: REST upsert lama kalau RPC belum ada di database.

// CATATAN PERFORMANCE: `@supabase/supabase-js` (~214 KB) sengaja TIDAK di-import
// statis di sini. Library dimuat lazy lewat `getSupabase()` saat pertama
// dipakai, supaya render awal halaman (FCP/LCP) tidak menunggu library ini.
// Alur fitur Supabase tetap sama — hanya waktu pemuatannya yang bergeser.

const URL = import.meta.env.VITE_SUPABASE_URL;
// Format key baru (sb_publishable_...) lebih diutamakan; fallback ke anon key legacy (eyJ...)
const KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

// Email admin — harus sama dengan yang dipakai di policy RLS Supabase
// dan di akun yang dibuat di Authentication -> Users.
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "";

export const isSupabaseEnabled = Boolean(URL && KEY);

// Singleton lazy client: import modul supabase-js hanya sekali, saat pertama
// dibutuhkan. Kalau gagal dimuat, kembalikan null dan biarkan pemanggil
// jatuh ke fallback (localStorage / tampilan publik) seperti Supabase nonaktif.
let clientPromise = null;
export function getSupabase() {
  if (!isSupabaseEnabled) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js")
      .then(({ createClient }) => createClient(URL, KEY))
      .catch((err) => {
        console.warn("Gagal memuat supabase-js:", err);
        clientPromise = null;
        return null;
      });
  }
  return clientPromise;
}

// Memoize `auth.getSession()` singkat (5 detik) supaya Navbar (useAdmin) dan
// trackVisit tidak menjalankan panggilan sesi yang sama berulang dalam waktu
// dekat. Perubahan login/logout tetap terdeteksi lewat onAuthStateChange.
let sessionMemo = null;
let sessionMemoAt = 0;
export async function getCachedSession() {
  if (!isSupabaseEnabled) return { session: null, error: null };
  const now = Date.now();
  if (sessionMemo && now - sessionMemoAt < 5000) return sessionMemo;
  const sb = await getSupabase();
  if (!sb) return { session: null, error: null };
  const { data, error } = await sb.auth.getSession();
  if (!error) {
    sessionMemo = { session: data.session || null, error: null };
    sessionMemoAt = now;
  }
  return { session: data.session || null, error };
}

// True kalau user yang sedang login adalah admin (email cocok).
// VITE_ADMIN_EMAIL boleh berisi beberapa email, dipisah koma.
export function isSameAdmin(email) {
  if (!ADMIN_EMAIL || !email) return false;
  const emails = String(ADMIN_EMAIL)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return emails.includes(String(email).toLowerCase());
}

/**
 * Cek apakah user yang sedang login adalah admin.
 * Prioritas menggunakan fungsi RPC `app_is_admin()` (dibuat lewat
 * `supabase/fix_admin.sql`) yang menentukan admin dari tabel `admins`
 * (berdasarkan auth user id) — kebal terhadap salah-email.
 * Kalau fungsi itu belum ada di project (deployment lama / SQL belum
 * dijalankan), fallback ke pencocokan email VITE_ADMIN_EMAIL.
 *
 * Hasil di-cache per email (60 detik) supaya navigasi antar halaman tidak
 * mengulang RPC `app_is_admin` berulang kali.
 */
const ADMIN_CACHE_MS = 60000;
let adminCache = { email: null, value: false, at: 0 };
export async function isAdminUser(email) {
  if (!email) return false;
  if (!isSupabaseEnabled) return false;
  const now = Date.now();
  if (adminCache.email === email && now - adminCache.at < ADMIN_CACHE_MS) {
    return adminCache.value;
  }
  const sb = await getSupabase();
  if (!sb) return false;
  let value = isSameAdmin(email);
  try {
    const { data, error } = await sb.rpc("app_is_admin");
    if (!error && typeof data === "boolean") value = data;
  } catch {
    // fungsi belum ada → pakai fallback email di atas
  }
  adminCache = { email, value, at: now };
  return value;
}

// ── Storage gambar (bucket "portfolio") ─────────────────────────
const STORAGE_BUCKET = "portfolio";

/**
 * Upload gambar (File/Blob) ke Supabase Storage.
 * @returns {Promise<{path?: string, error?: any}>} path = lokasi objek (mis. "projects/x.jpg")
 */
export async function uploadImage(file, folder = "portfolio") {
  if (!isSupabaseEnabled || !file) {
    return { error: { message: "Supabase nonaktif." } };
  }
  const sb = await getSupabase();
  if (!sb) return { error: { message: "Supabase nonaktif." } };
  try {
    const rawExt = String(file.name?.split(".").pop() || "jpg").toLowerCase();
    const ext = ["jpg", "jpeg", "png", "webp"].includes(rawExt) ? rawExt : "jpg";
    const path = `${folder}/${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, {
      contentType: file.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
      cacheControl: "3600",
      upsert: false,
    });
    if (error) return { error };
    return { path };
  } catch (err) {
    return { error: err };
  }
}

/**
 * Menerjemahkan nilai kolom gambar (thumb/image) menjadi URL yang bisa dipakai <img src>.
 * - http(s):/data:/blob:  → dipakai apa adanya
 * - berisi "/"             → objek di bucket "portfolio" → URL publik storage
 * - selain itu             → aset statis di folder public/ (mis. "smartland.png" → "/smartland.png")
 */
export function resolveImageUrl(src) {
  if (!src) return null;
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  if (isSupabaseEnabled && String(src).includes("/")) {
    try {
      // Format resmi public URL Supabase Storage — identik dengan hasil
      // `supabase.storage.from(bucket).getPublicUrl(path)`:
      //   <supabaseUrl>/storage/v1/object/public/<bucket>/<path>
      // Ditulis manual agar fungsi ini tetap sinkron (dipakai langsung di
      // render) tanpa harus menunggu lazy-load client supabase-js.
      return `${URL}/storage/v1/object/public/${STORAGE_BUCKET}/${String(src)}`;
    } catch {
      // lanjut ke fallback
    }
  }
  return String(src).startsWith("/") ? src : `/${src}`;
}

// Periksa error PostgREST "fungsi tidak ada" (PGRST202 / 404).
function isFunctionMissing(err) {
  if (!err) return false;
  const code = String(err.code || "");
  const msg = String(err.message || "");
  return (
    code === "PGRST202" ||
    /could not find the function/i.test(msg) ||
    /function .* does not exist/i.test(msg)
  );
}

// Cek sesi saat ini: apakah dari admin?
async function currentIsAdmin() {
  if (!isSupabaseEnabled) return false;
  try {
    const { session } = await getCachedSession();
    return await isAdminUser(session?.user?.email || null);
  } catch {
    return false;
  }
}

// Mode Supabase: hanya admin yang boleh menulis (RPC juga memblokir dari sisi DB).
async function canWrite() {
  if (!isSupabaseEnabled) return false;
  return currentIsAdmin();
}

/**
 * Long-polling-safe storage layer with graceful fallback:
 * - Supabase enabled  -> CRUD lewat tabel `projects` / `experiences`
 * - Supabase disabled -> CRUD lewat localStorage (seperti sekarang)
 *
 * Selalu `await` hasilnya. Kalau Supabase error, otomatis fallback ke localStorage
 * sehingga data tidak hilang dan halaman tidak crash.
 */
export const storage = {
  // ── Projects ──────────────────────────────────────────────
  async loadProjects(fallback) {
    const sb = await getSupabase();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        // Supabase adalah sumber data resmi → pakai hasilnya apa adanya
        // (termasuk array kosong). Jangan fallback ke konstanta saat tabel
        // kosong, nanti project/experience yang sudah dihapus admin bisa
        // "hidup lagi". Fallback hanya dipakai kalau query error.
        if (Array.isArray(data)) {
          return data.map((r) => ({
            id: String(r.id),
            title: r.title,
            shortDesc: r.short_desc || "",
            desc: r.description || "",
            category: r.category || "",
            year: r.year || "",
            tags: Array.isArray(r.tags) ? r.tags : [],
            thumb: r.thumb || null,
            links: { github: r.github_link || "#", live: r.live_link || "" },
            featured: r.featured === true,
          }));
        }
        return fallback;
      } catch (err) {
        console.warn("Supabase loadProjects gagal, fallback localStorage:", err);
      }
    }
    return loadLocal("projects", fallback);
  },

  async saveProjects(list) {
    if (!(await canWrite())) return true; // public: tidak boleh menulis
    const sb = await getSupabase();
    if (sb) {
      try {
        const rows = list.map((p) => ({
          id: String(p.id),
          title: p.title,
          short_desc: p.shortDesc || "",
          description: p.desc || "",
          category: p.category || "",
          year: p.year || "",
          tags: Array.isArray(p.tags) ? p.tags : [],
          thumb: p.thumb || null,
          github_link: (p.links && p.links.github) || "#",
          live_link: (p.links && p.links.live) || "",
          featured: p.featured === true,
        }));
        // 1) Jalan utama: RPC admin_save_projects (SECURITY DEFINER)
        //    — bebas dari masalah grant/RLS/konflik upsert di sisi tabel.
        const { data, error: rpcErr } = await sb.rpc(
          "admin_save_projects",
          { payload: rows }
        );
        if (!rpcErr) {
          if (data && data.ok === true) return true;
          console.warn("admin_save_projects ditolak:", data);
          return false;
        }
        if (!isFunctionMissing(rpcErr)) {
          console.warn("admin_save_projects gagal:", rpcErr);
          return false;
        }
        // 2) Fallback: REST upsert (deployment lama / SQL fix belum dijalankan)
        return await saveProjectsRest(sb, rows);
      } catch (err) {
        console.warn("Supabase saveProjects gagal, fallback localStorage:", err);
        return false;
      }
    }
    saveLocal("projects", list);
    return true;
  },

  // ── Experiences ───────────────────────────────────────────
  async loadExperiences(fallback) {
    const sb = await getSupabase();
    if (sb) {
      try {
        const { data, error } = await sb
          .from("experiences")
          .select("*")
          .order("start_date", { ascending: false });
        if (error) throw error;
        // Supabase adalah sumber data resmi → pakai hasilnya apa adanya
        // (termasuk array kosong). Fallback hanya dipakai kalau query error.
        if (Array.isArray(data)) {
          return data.map((r) => ({
            id: String(r.id),
            category: r.category || "",
            title: r.title || "",
            institution: r.institution || "",
            startDate: r.start_date || "",
            description: r.description || "",
            link: r.link || "",
            image: r.image || null,
            tags: Array.isArray(r.tags) ? r.tags : [],
            highlights: Array.isArray(r.highlights) ? r.highlights : [],
          }));
        }
        return fallback;
      } catch (err) {
        console.warn("Supabase loadExperiences gagal, fallback localStorage:", err);
      }
    }
    return loadLocal("experiences", fallback);
  },

  async saveExperiences(list) {
    if (!(await canWrite())) return true; // public: tidak boleh menulis
    const sb = await getSupabase();
    if (sb) {
      try {
        const rows = list.map((e) => ({
          id: String(e.id),
          category: e.category || "",
          title: e.title || "",
          institution: e.institution || "",
          start_date: e.startDate || "",
          description: e.description || "",
          link: e.link || "",
          image: e.image || null,
          tags: Array.isArray(e.tags) ? e.tags : [],
          highlights: Array.isArray(e.highlights) ? e.highlights : [],
        }));
        // 1) Jalan utama: RPC admin_save_experiences (SECURITY DEFINER)
        const { data, error: rpcErr } = await sb.rpc(
          "admin_save_experiences",
          { payload: rows }
        );
        if (!rpcErr) {
          if (data && data.ok === true) return true;
          console.warn("admin_save_experiences ditolak:", data);
          return false;
        }
        if (!isFunctionMissing(rpcErr)) {
          console.warn("admin_save_experiences gagal:", rpcErr);
          return false;
        }
        // 2) Fallback: REST upsert (deployment lama / SQL fix belum dijalankan)
        return await saveExperiencesRest(sb, rows);
      } catch (err) {
        console.warn("Supabase saveExperiences gagal, fallback localStorage:", err);
        return false;
      }
    }
    saveLocal("experiences", list);
    return true;
  },
};

// ── Local fallback helpers ────────────────────────────────────
const PROJ_LS = "portfolio_projects_v1";
const EXP_LS = "portfolio_experiences2";

// Fallback REST lama untuk saveProjects — dipakai kalau RPC
// admin_save_projects belum ada di database (deployment lama).
async function saveProjectsRest(sb, rows) {
  // Hapus row yang TIDAK ada lagi di daftar → CRUD delete ikut tersimpan.
  const { data: existing, error: selErr } = await sb
    .from("projects")
    .select("id");
  if (selErr) throw selErr;
  const keepIds = new Set(rows.map((r) => String(r.id)));
  const staleIds = (Array.isArray(existing) ? existing : [])
    .map((r) => String(r.id))
    .filter((id) => !keepIds.has(id));
  if (staleIds.length > 0) {
    const { error: delErr } = await sb
      .from("projects")
      .delete()
      .in("id", staleIds);
    if (delErr) throw delErr;
  }
  const { error } = await sb.from("projects").upsert(rows);
  if (error) throw error;
  return true;
}

// Fallback REST lama untuk saveExperiences.
async function saveExperiencesRest(sb, rows) {
  const { data: existing, error: selErr } = await sb
    .from("experiences")
    .select("id");
  if (selErr) throw selErr;
  const keepIds = new Set(rows.map((r) => String(r.id)));
  const staleIds = (Array.isArray(existing) ? existing : [])
    .map((r) => String(r.id))
    .filter((id) => !keepIds.has(id));
  if (staleIds.length > 0) {
    const { error: delErr } = await sb
      .from("experiences")
      .delete()
      .in("id", staleIds);
    if (delErr) throw delErr;
  }
  const { error } = await sb.from("experiences").upsert(rows);
  if (error) throw error;
  return true;
}

function loadLocal(kind, fallback) {
  try {
    const raw = localStorage.getItem(kind === "projects" ? PROJ_LS : EXP_LS);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

function saveLocal(kind, data) {
  try {
    localStorage.setItem(kind === "projects" ? PROJ_LS : EXP_LS, JSON.stringify(data));
  } catch (err) {
    console.warn("Gagal menyimpan ke localStorage:", err);
  }
}