// ─── Konten situs yang bisa diedit admin (Home & About) ─────────
// Mengambil/menyimpan nilai ke tabel `site_content` (key-value).
// Publik hanya BACA; tulis lewat RPC admin_save_content (SECURITY DEFINER).

import { getSupabase, isSupabaseEnabled } from "./storage";

/** Nilai default — dipakai kalau DB kosong / Supabase nonaktif. */
export const DEFAULT_CONTENT = {
  home_hero_l1a: "Hallo!",
  home_hero_l1b: "It's Me",
  home_hero_l2a: "Nurry Nurul",
  home_hero_l2b: "Naomi",
  home_subtitle:
    "Saya Naomi, siswa SMK N 1 Purbalingga. Selamat datang di portofolio saya, tempat saya membagikan berbagai proyek, pengalaman, dan perjalanan yang telah saya lalui. Jelajahi lebih lanjut untuk mengenal saya dan karya-karya yang telah saya buat. 🚀",
  about_subtitle: "Learning, building, and growing every day.",
  about_bio:
    "Haii, Saya Nurry Nurul Naomi, siswa Rekayasa Perangkat Lunak (RPL) di SMK N 1 Purbalingga, yang senang mempelajari teknologi, mengembangkan proyek, dan terus mencari pengalaman baru untuk meningkatkan kemampuan serta wawasan saya. Melalui berbagai kegiatan akademik maupun organisasi, saya berusaha untuk terus berkembang dan memberikan hasil terbaik dalam setiap kesempatan.",
};

/** Daftar field yang bisa diedit admin (untuk form). */
export const CONTENT_FIELDS = [
  { key: "home_hero_l1a", group: "Home", label: "Kalimat pembuka (baris 1a)" },
  { key: "home_hero_l1b", group: "Home", label: "Teks gradasi (baris 1b)" },
  { key: "home_hero_l2a", group: "Home", label: "Nama depan (baris 2a)" },
  { key: "home_hero_l2b", group: "Home", label: "Nama belakang (baris 2b)" },
  { key: "home_subtitle", group: "Home", label: "Paragraf pengantar (sub-judul)", multiline: true },
  { key: "about_subtitle", group: "About", label: "Sub-judul halaman About" },
  { key: "about_bio", group: "About", label: "Biodata / deskripsi diri", multiline: true },
];

/** Ambil semua konten situs (publik). Kalau kosong / nonaktif → `{}`. */
export async function loadSiteContent() {
  if (!isSupabaseEnabled) return {};
  const sb = await getSupabase();
  if (!sb) return {};
  try {
    const { data, error } = await sb.from("site_content").select("key, value");
    if (error || !Array.isArray(data)) return {};
    const out = {};
    data.forEach((r) => {
      if (r.key) out[r.key] = r.value ?? "";
    });
    return out;
  } catch {
    return {};
  }
}

/** Simpan konten situs (admin, RPC SECURITY DEFINER). */
export async function adminSaveSiteContent(entries) {
  if (!isSupabaseEnabled) {
    return { error: { message: "Supabase nonaktif." } };
  }
  const sb = await getSupabase();
  if (!sb) return { error: { message: "Supabase nonaktif." } };
  const rows = (entries || [])
    .filter((e) => e && e.key)
    .map((e) => ({ key: String(e.key), value: String(e.value ?? "") }));
  if (!rows.length) {
    return { error: { message: "Tidak ada data untuk disimpan." } };
  }
  try {
    const { data, error } = await sb.rpc("admin_save_content", {
      payload: rows,
    });
    if (error) return { error };
    if (data && data.ok === false) {
      return { error: { message: data.error || "Gagal menyimpan (bukan admin?)." } };
    }
    return { data, error: null };
  } catch (err) {
    return { error: err };
  }
}