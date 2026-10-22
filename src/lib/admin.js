// ─── Admin panel helpers: dashboard, inbox pesan, moderasi komentar ──
// Semua fungsi di file ini HANYA dipanggil saat admin login (useAdmin).
// Keamanan sebenarnya tetap di sisi database: RLS memakai app_is_admin()
// dan RPC admin_dashboard_stats() adalah SECURITY DEFINER. Jika bukan admin,
// query hanya mengembalikan error / data forbidden — tidak membahayakan.

import { getSupabase, isSupabaseEnabled } from "./storage";

const OFF = { data: null, error: { message: "Supabase nonaktif." } };

/** Ambil client Supabase (lazy) atau null kalau nonaktif/gagal dimuat. */
async function sb() {
  if (!isSupabaseEnabled) return null;
  return getSupabase();
}

/** Statistik ringkasan dashboard (via RPC SECURITY DEFINER). */
export async function adminFetchStats() {
  const client = await sb();
  if (!client) return OFF;
  try {
    const { data, error } = await client.rpc("admin_dashboard_stats");
    if (error) return { data: null, error };
    if (data && data.ok === false) {
      return { data: null, error: { message: data.error || "Bukan admin." } };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

/** Grafik kunjungan 7 hari terakhir (array {day: 'YYYY-MM-DD', count}). */
export async function adminFetchVisitorDays() {
  const client = await sb();
  if (!client) return { data: [], error: null };
  try {
    const { data, error } = await client.rpc("admin_visitor_days");
    if (error) return { data: [], error };
    if (data && data.ok === false) return { data: [], error: { message: data.error || "Bukan admin." } };
    return { data: Array.isArray(data) ? data : [], error: null };
  } catch (err) {
    return { data: [], error: err };
  }
}

/** Daftar kunjungan terbaru. */
export async function adminFetchRecentVisits(limit = 20) {
  const client = await sb();
  if (!client) return { data: [], error: null };
  return client
    .from("visitors")
    .select("id, session_id, device_type, device_name, visited_at")
    .order("visited_at", { ascending: false })
    .limit(limit);
}

// ── Inbox pesan kontak ──────────────────────────────────────────
export async function adminFetchMessages() {
  const client = await sb();
  if (!client) return { data: [], error: null };
  return client
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
}

export async function adminUpdateMessage(id, status) {
  const client = await sb();
  if (!client) return OFF;
  return client.from("contact_messages").update({ status }).eq("id", id);
}

export async function adminDeleteMessage(id) {
  const client = await sb();
  if (!client) return OFF;
  return client.from("contact_messages").delete().eq("id", id);
}

// ── Moderasi komentar ───────────────────────────────────────────
export async function adminFetchComments() {
  const client = await sb();
  if (!client) return { data: [], error: null };
  return client
    .from("comments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
}

export async function adminSetCommentStatus(id, status) {
  const client = await sb();
  if (!client) return OFF;
  return client.from("comments").update({ status }).eq("id", id);
}

export async function adminDeleteComment(id) {
  const client = await sb();
  if (!client) return OFF;
  return client.from("comments").delete().eq("id", id);
}

/** Balas komentar sebagai admin (parent_id → thread di halaman public). */
export async function adminReplyComment(parentId, content) {
  const client = await sb();
  if (!client) {
    return { data: null, error: { message: "Supabase nonaktif." } };
  }
  const text = String(content || "").trim().slice(0, 2000);
  if (!text) return { data: null, error: { message: "Tulis isi balasan dulu." } };
  return client
    .from("comments")
    .insert({
      parent_id: parentId,
      name: "Admin Naomi",
      content: text,
      status: "published",
      is_admin: true,
    })
    .select()
    .single();
}
