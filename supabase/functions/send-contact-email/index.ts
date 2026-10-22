// ============================================================
// Edge Function: send-contact-email
// ============================================================
// Dipanggil dari halaman Contact SETELAH pesan user tersimpan ke
// tabel `contact_messages` (oleh frontend via RLS anon insert).
// Fungsi ini hanya bertugas MENGIRIM EMAIL ke pemilik portfolio
// dari sisi server — tanpa memakai Service Role Key di frontend.
//
// ANTI-SPAM:
//   • Setiap pesan dari form punya `message_id` unik yang disimpan ke
//     tabel `contact_messages`. Di sini fungsi MENYELIDIKI id itu benar
//     ada di database (pakai secret key) sebelum mengirim email, jadi
//     spammer tidak bisa memanggil endpoint ini langsung tanpa lewat form.
//   • Rate limit sederhana: maksimal 10 pesan per pengirim per 15 menit.
//   • Butuh secrets tambahan: SUPABASE_URL + SUPABASE_SERVICE_KEY.
//     Kalau dua secret itu belum di-set, fungsi tetap jalan (fail-open)
//     dengan peringatan di log (agar email tidak rusak).
//
// DEPLOY:
//   npx supabase login
//   npx supabase link --project-ref dkbrxwudehntzlyhtsdb
//   npx supabase functions deploy send-contact-email --no-verify-jwt
//
//   Opsi CLI: npm run deploy:email  (sudah di-set di package.json)
//
// SECRETS (wajib di-set SEKALI, di Dashboard -> Edge Functions ->
//          Secrets, atau lewat `supabase secrets set`):
//   RESEND_API_KEY      -> API key dari resend.com (diawali "re_...")
//   CONTACT_FROM_EMAIL  -> alamat PENGIRIM (opsional; kosong = onboarding@resend.dev)
//   CONTACT_OWNER_EMAIL -> alamat pemilik portfolio (tujuan pesan)
//   SUPABASE_URL        -> https://<ref>.supabase.co
//   SUPABASE_SERVICE_KEY-> secret key (sb_secret_...) untuk verifikasi message_id
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const OWNER_EMAIL = Deno.env.get("CONTACT_OWNER_EMAIL");
const FROM_EMAIL =
  Deno.env.get("CONTACT_FROM_EMAIL") || "onboarding@resend.dev";

/**
 * Ambil service key untuk verifikasi pesan.
 * Supabase otomatis menyuntikkan env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * (legacy), dan SUPABASE_SECRET_KEYS (JSON dict berisi secret keys baru).
 */
function getServiceKey(): string | null {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) return null;
  try {
    const map = JSON.parse(raw) as Record<string, string>;
    const named = Object.keys(map).find((k) => /default|secret/i.test(k));
    if (named && map[named]) return map[named];
    const vals = Object.values(map).filter(Boolean);
    return vals.length ? vals[0] : null;
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req) => {
  // CORS preflight (dipanggil dari browser).
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // ── Validasi secret server ──────────────────────────────
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY belum diatur di Edge Function Secrets.");
    return json(
      { error: "Server email belum dikonfigurasi (RESEND_API_KEY)" },
      500
    );
  }
  if (!OWNER_EMAIL) {
    console.error("CONTACT_OWNER_EMAIL belum diatur di Edge Function Secrets.");
    return json(
      { error: "Server email belum dikonfigurasi (CONTACT_OWNER_EMAIL)" },
      500
    );
  }
  if (FROM_EMAIL === "onboarding@resend.dev") {
    console.warn(
      "CONTACT_FROM_EMAIL tidak diatur — pakai onboarding@resend.dev " +
        "(hanya bisa kirim ke email akun Resend milikmu).",
    );
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Body harus JSON" }, 400);
  }

  const email = String(payload?.email || "").trim();
  const message = String(payload?.message || "").trim();
  // Opsional: id baris di contact_messages, dipakai sebagai Idempotency-Key
  // supaya double-submit tidak menghasilkan email ganda.
  const messageId = String(payload?.messageId || "").trim();

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ error: "Email tidak valid" }, 400);
  }
  if (message.length < 1 || message.length > 5000) {
    return json({ error: "Pesan harus 1–5000 karakter" }, 400);
  }

  // ── Verifikasi anti-spam (pakai secret key server) ─────────
  // Pastikan message_id benar ada di tabel contact_messages, lalu batasi
  // jumlah pesan per pengirim (10 / 15 menit).
  const SERVICE_KEY = getServiceKey();
  if (Deno.env.get("SUPABASE_URL") && SERVICE_KEY) {
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: row, error: qErr } = await supabaseAdmin
      .from("contact_messages")
      .select("message_id, created_at")
      .eq("message_id", messageId)
      .maybeSingle();

    if (qErr) {
      console.error("Verifikasi pesan gagal:", qErr.message);
      return json({ error: "Gagal memverifikasi pesan." }, 500);
    }
    if (!row) {
      return json(
        { error: "Pesan tidak ditemukan — pastikan dikirim lewat form kontak." },
        400
      );
    }

    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count, error: cntErr } = await supabaseAdmin
      .from("contact_messages")
      .select("*", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", since);

    if (!cntErr && typeof count === "number" && count > 10) {
      return json(
        { error: "Terlalu banyak pesan dalam waktu singkat. Coba lagi nanti." },
        429
      );
    }
  } else {
    console.warn(
      "SUPABASE_URL / service key belum tersedia — melewati verifikasi pesan.",
    );
  }

  // ── Kirim email via Resend (reply-to = email pengirim) ────
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
        ...(messageId ? { "Idempotency-Key": `contact-${messageId}` } : {}),
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [OWNER_EMAIL],
        reply_to: [email],
        subject: `📩 Pesan baru dari ${email} — Portfolio Contact`,
        text: `Pesan dari halaman Contact portfolio:\n\n${message}\n\n— ${email}`,
      }),
      // Timeout supaya fungsi tidak menggantung lama.
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", res.status, errText);
      return json({ error: `Gagal kirim email (${res.status})` }, 502);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("send-contact-email error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});