import { useState, useEffect, useCallback, cloneElement, useId, isValidElement } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  loadComments,
  submitComment,
  submitContactMessage,
} from "../lib/contact";
import { getSupabase, isSupabaseEnabled } from "../lib/storage";

const COMMENTS_PAGE = 50;

// ─── Tautan sosial (sama dengan kartu kontak di halaman About) ──
const SOCIAL_LINKS = [
  {
    key: "email",
    icon: "📧",
    label: "Email",
    value: "nurry.naomy28@gmail.com",
    href: "mailto:nurry.naomy28@gmail.com",
  },
  {
    key: "instagram",
    icon: "📸",
    label: "Instagram",
    value: "@nnaoou_",
    href: "https://www.instagram.com/nnaoou_/",
  },
  {
    key: "whatsapp",
    icon: "📱",
    label: "WhatsApp",
    value: "chat aku disini",
    href: "https://wa.me/6285867733008",
  },
  {
    key: "github",
    icon: "🐙",
    label: "GitHub",
    value: "@nurryyy0",
    href: "https://github.com/nurryyy0",
  },
];

// ─── Helpers ───────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

// Susun komentar jadi thread: root + balasannya (parent_id).
function buildThreads(comments) {
  const byId = new Map(comments.map((c) => [c.id, c]));
  const roots = [];
  const replyMap = new Map();
  comments.forEach((c) => {
    if (c.parent_id && byId.has(c.parent_id)) {
      if (!replyMap.has(c.parent_id)) replyMap.set(c.parent_id, []);
      replyMap.get(c.parent_id).push(c);
    } else if (c.parent_id && !byId.has(c.parent_id)) {
      // Balasan yang parent-nya di luar 50 terbaru: tetap tampilkan sebagai root
      // supaya tidak "hilang" dari halaman.
      roots.push(c);
    } else {
      roots.push(c);
    }
  });
  // Root TERBARU tampil di atas (baca: descending by created_at).
  roots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  // Balasan urut naik (baca: yang lama dulu = urut percakapan).
  replyMap.forEach((list) => list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
  return roots.map((r) => ({ ...r, replies: replyMap.get(r.id) || [] }));
}

// ─── Components ────────────────────────────────────────────────
function Field({ label, error, children }) {
  const id = useId();
  return (
    <div style={C.field}>
      <label style={C.label} htmlFor={id}>{label}</label>
      {isValidElement(children) ? cloneElement(children, { id }) : children}
      {error && (
        <span style={C.fieldError} role="alert">{error}</span>
      )}
    </div>
  );
}

function CommentThread({ item }) {
  return (
    <div style={C.commentWrap}>
      <div style={C.comment}>
        <div style={C.commentHead}>
          <span style={C.commentName}>{item.name}</span>
          {item.is_admin && <span style={C.adminBadge}>Admin</span>}
          <span style={C.commentDate}>{formatDate(item.created_at)}</span>
        </div>
        <p style={C.commentText}>"{item.content}"</p>
      </div>
      {item.replies.length > 0 && (
        <div style={C.replyList}>
          {item.replies.map((rep) => (
            <div key={rep.id} style={C.reply}>
              <span style={C.replyArrow}>↳</span>
              <div style={{ flex: 1 }}>
                <div style={C.commentHead}>
                  <span style={C.commentName}>
                    {rep.is_admin ? "Admin" : rep.name}
                  </span>
                  {rep.is_admin && <span style={C.adminBadge}>Admin</span>}
                  <span style={C.commentDate}>{formatDate(rep.created_at)}</span>
                </div>
                <p style={C.commentText}>"{rep.content}"</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────
function Contact() {
  // ── Comment form state ──
  const [comments, setComments] = useState([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentsOffset, setCommentsOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cmtName, setCmtName] = useState("");
  const [cmtContent, setCmtContent] = useState("");
  const [cmtErrors, setCmtErrors] = useState({});
  const [cmtBusy, setCmtBusy] = useState(false);
  const [cmtSuccess, setCmtSuccess] = useState(false);
  // Honeypot anti-spam (bot mengisi kolom tersembunyi → permintaan dibuang).
  const [cmtHp, setCmtHp] = useState("");
  const [mailHp, setMailHp] = useState("");

  // ── Email form state ──
  const [mailEmail, setMailEmail] = useState("");
  const [mailMessage, setMailMessage] = useState("");
  const [mailErrors, setMailErrors] = useState({});
  const [mailBusy, setMailBusy] = useState(false);
  const [mailDone, setMailDone] = useState(null); // "ok" | "saved" | null

  // ── Muat komentar halaman pertama ──
  const refreshComments = useCallback(async () => {
    const list = await loadComments({ limit: COMMENTS_PAGE, offset: 0 });
    setComments(list);
    setCommentsLoaded(true);
    setCommentsOffset(0);
    setHasMore(list.length >= COMMENTS_PAGE);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadComments({ limit: COMMENTS_PAGE, offset: 0 }).then((list) => {
      if (cancelled) return;
      setComments(list);
      setCommentsLoaded(true);
      setHasMore(list.length >= COMMENTS_PAGE);
    });
    return () => { cancelled = true; };
  }, []);

  // ── Realtime: komentar baru (published) muncul otomatis ──
  // Client Supabase dimuat lazy setelah render supaya tidak menunda FCP/LCP.
  useEffect(() => {
    if (!isSupabaseEnabled) return;
    let cancelled = false;
    let channel = null;
    let client = null;
    getSupabase().then((sb) => {
      if (cancelled || !sb) return;
      client = sb;
      channel = sb
        .channel("comments-live")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "comments" },
          () => refreshComments()
        )
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (client && channel) client.removeChannel(channel);
    };
  }, [refreshComments]);

  // ── Pagination: muat lebih banyak komentar ──
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = commentsOffset + COMMENTS_PAGE;
    const list = await loadComments({ limit: COMMENTS_PAGE, offset: next });
    if (list.length) {
      setComments((prev) => {
        const seen = new Map(prev.map((c) => [c.id, c]));
        list.forEach((c) => seen.set(c.id, c));
        return Array.from(seen.values());
      });
      setCommentsOffset(next);
      setHasMore(list.length >= COMMENTS_PAGE);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, commentsOffset]);

  // ── Submit komentar ──
  const handleComment = async (e) => {
    e.preventDefault();
    setCmtErrors({});
    setCmtSuccess(false);

    // Bot honeypot: abaikan diam-diam.
    if (String(cmtHp).trim()) {
      setCmtName("");
      setCmtContent("");
      setCmtSuccess(true);
      return;
    }

    const errs = {};
    if (!String(cmtName).trim()) errs.name = "Wajib diisi";
    if (!String(cmtContent).trim()) errs.content = "Wajib diisi";
    if (Object.keys(errs).length) { setCmtErrors(errs); return; }

    setCmtBusy(true);
    const { error } = await submitComment(cmtName, cmtContent);
    setCmtBusy(false);

    if (error) {
      setCmtErrors({ form: error.message || "Gagal mengirim komentar." });
      return;
    }
    setCmtName("");
    setCmtContent("");
    setCmtSuccess(true);
    refreshComments();
  };

  // ── Submit email ──
  const handleMail = async (e) => {
    e.preventDefault();
    setMailErrors({});
    setMailDone(null);

    // Bot honeypot: abaikan diam-diam.
    if (String(mailHp).trim()) {
      setMailEmail("");
      setMailMessage("");
      setMailDone("ok");
      return;
    }

    const errs = {};
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(mailEmail).trim())) {
      errs.email = "Email tidak valid";
    }
    if (!String(mailMessage).trim()) {
      errs.message = "Wajib diisi";
    } else if (String(mailMessage).trim().length > 5000) {
      errs.message = "Pesan maksimal 5000 karakter";
    }
    if (Object.keys(errs).length) { setMailErrors(errs); return; }

    setMailBusy(true);
    const { error, emailSent } = await submitContactMessage(mailEmail, mailMessage);
    setMailBusy(false);

    if (error) {
      setMailErrors({ form: error.message || "Gagal mengirim pesan." });
      return;
    }
    setMailEmail("");
    setMailMessage("");
    setMailDone(emailSent ? "ok" : "saved");
  };

  const threads = buildThreads(comments);

  return (
    <div style={{ background: "var(--bg-0)", minHeight: "100vh" }}>
      <Navbar />
      <div style={C.glowCyan} />
      <div style={C.glowPurple} />

      <div style={{ paddingTop: "calc(var(--nav-h, 72px) + clamp(1.5rem, 5vw, 3rem))", paddingBottom: "4rem" }}>
        <div className="container">

          {/* ── Header ── */}
          <div className="animate-fadeUp" style={{ marginBottom: "3rem" }}>
            <span className="section-label">Contact</span>
            <h1 style={C.title}>
              Hubungi <span style={C.titleGradient}>Saya</span>
            </h1>
            <p style={C.subtitle}>
              Bagikan pendapat, hubungi saya melalui email, atau temukan saya di berbagai platform lainnya.
              Setiap pesan dan masukan sangat berarti untuk pengembangan karya saya! 
            </p>
          </div>

          <div style={C.grid}>

            {/* ── Kolom Kiri: Komentar ── */}
            <div className="animate-fadeUp animate-delay-1" style={C.card}>
              <div style={C.cardHead}>
                <span style={C.cardIcon}>💬</span>
                <h2 style={C.cardTitle}>Leave a Comment</h2>
              </div>
              <p style={C.cardDesc}>
                tulis sesuatu di sini!
              </p>

              <form onSubmit={handleComment} noValidate>
                {/* Honeypot anti-spam — tidak terlihat oleh manusia */}
                <div style={C.honeypot} aria-hidden="true">
                  <label htmlFor="cmt-website">Jangan isi kolom ini</label>
                  <input
                    id="cmt-website"
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={cmtHp}
                    onChange={(e) => setCmtHp(e.target.value)}
                  />
                </div>

                <Field label="Nama" error={cmtErrors.name}>
                  <input
                    style={C.input}
                    type="text"
                    placeholder="Nama kamu"
                    value={cmtName}
                    onChange={(e) => setCmtName(e.target.value)}
                  />
                </Field>

                <Field label="Komentar" error={cmtErrors.content}>
                  <textarea
                    style={{ ...C.input, ...C.textarea }}
                    rows={4}
                    placeholder="Tulis komentar atau pesan kamu…"
                    value={cmtContent}
                    onChange={(e) => setCmtContent(e.target.value)}
                  />
                </Field>

                {cmtErrors.form && <p role="alert" style={C.formError}>{cmtErrors.form}</p>}
                {cmtSuccess && (
                  <p aria-live="polite" style={C.successMsg}>✓ Komentar berhasil terkirim!</p>
                )}

                <button type="submit" className="btn-micro" style={C.btnPrimary} disabled={cmtBusy}>
                  {cmtBusy ? "Mengirim…" : "Kirim Komentar"}
                </button>
              </form>

              {/* ── Daftar komentar ── */}
              <div style={C.commentsSection}>
                <h3 style={C.commentsTitle}>Comments</h3>
                {!commentsLoaded ? (
                  <p style={C.emptyText}>Memuat komentar…</p>
                ) : threads.length === 0 ? (
                  <p style={C.emptyText}>Belum ada komentar. Jadilah yang pertama! 🎉</p>
                ) : (
                  <>
                    {threads.map((t) => <CommentThread key={t.id} item={t} />)}
                    {hasMore && (
                      <button
                        type="button"
                        style={C.moreBtn}
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                      >
                        {loadingMore ? "Memuat…" : "↓ Muat komentar lainnya"}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Kolom Kanan: Email ── */}
            <div className="animate-fadeUp animate-delay-2" style={C.card}>
              <div style={C.cardHead}>
                <span style={C.cardIcon}>📧</span>
                <h2 style={C.cardTitle}>Send Me an Email</h2>
              </div>

              <p style={C.cardDesc}>
                Kirim pesan pribadi — nanti masuk ke inbox email aku.
              </p>

              <form onSubmit={handleMail} noValidate>
                {/* Honeypot anti-spam — tidak terlihat oleh manusia */}
                <div style={C.honeypot} aria-hidden="true">
                  <label htmlFor="mail-website">Jangan isi kolom ini</label>
                  <input
                    id="mail-website"
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={mailHp}
                    onChange={(e) => setMailHp(e.target.value)}
                  />
                </div>

                <Field label="Email" error={mailErrors.email}>
                  <input
                    style={C.input}
                    type="email"
                    placeholder="emailkamu@gmail.com"
                    value={mailEmail}
                    onChange={(e) => setMailEmail(e.target.value)}
                  />
                </Field>

                <Field label="Pesan" error={mailErrors.message}>
                  <textarea
                    style={{ ...C.input, ...C.textarea }}
                    rows={5}
                    placeholder="Tulis pesan untuk saya…"
                    value={mailMessage}
                    onChange={(e) => setMailMessage(e.target.value)}
                  />
                </Field>

                {mailErrors.form && <p role="alert" style={C.formError}>{mailErrors.form}</p>}
                {mailDone === "ok" && (
                  <p aria-live="polite" style={C.successMsg}>✓ Pesan terkirim ke emailku! Terima kasih ya.</p>
                )}
                {mailDone === "saved" && (
                  <p aria-live="polite" style={C.warnMsg}>⚠️ Pesan sudah tersimpan. Notifikasi email belum aktif, tapi pesanmu tetap tersimpan dan bisa dibuka dari panel admin.</p>
                )}

                <button type="submit" className="btn-micro" style={C.btnPrimary} disabled={mailBusy}>
                  {mailBusy ? "Mengirim…" : "Kirim Email"}
                </button>
              </form>

              {/* ── Let's Stay Connected ── */}
              <div style={C.connectedSection}>
                <div style={C.connectedHead}>
                  <h3 style={C.connectedTitle}>Let's Stay Connected</h3>
                  <p style={C.connectedDesc}>
                    Cari aku di sini!
                  </p>
                </div>

                <div className="connected-grid" style={C.connectedGrid}>
                  {SOCIAL_LINKS.map((s) => (
                    <a
                      key={s.key}
                      href={s.href}
                      target={s.key === "email" ? undefined : "_blank"}
                      rel="noopener noreferrer"
                      className="btn-micro"
                      style={C.connectedCard}
                    >
                      <span style={{ fontSize: "1.4rem" }}>{s.icon}</span>
                      <div style={C.connectedText}>
                        <span style={C.connectedLabel}>{s.label}</span>
                        <span style={C.connectedValue}>{s.value}</span>
                      </div>
                      <span style={C.connectedArrow}>↗</span>
                    </a>
                  ))}
                </div>
                <style>{`
                  @media (max-width: 520px) {
                    .connected-grid { grid-template-columns: 1fr !important; }
                  }
                `}</style>
              </div>
            </div>

          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────
const C = {
  glowCyan: {
    position: "absolute",
    top: "-10%",
    right: "-8%",
    width: "640px",
    height: "640px",
    background: "radial-gradient(circle at center, rgba(34,211,238,0.09) 0%, transparent 65%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  glowPurple: {
    position: "absolute",
    bottom: "5%",
    left: "-5%",
    width: "480px",
    height: "480px",
    background: "radial-gradient(circle at center, rgba(167,139,250,0.07) 0%, transparent 65%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  title: {
    fontSize: "clamp(2.2rem, 5vw, 3.8rem)",
    fontWeight: 900,
    letterSpacing: "-0.035em",
    color: "var(--text-bright)",
    marginBottom: "0.75rem",
    marginTop: "0.5rem",
    fontFamily: "var(--font-display)",
  },
  titleGradient: {
    background: "linear-gradient(135deg, var(--cyan) 0%, var(--purple) 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  subtitle: {
    fontSize: "1rem",
    color: "var(--text-secondary)",
    maxWidth: "500px",
    lineHeight: 1.7,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))",
    gap: "1.5rem",
    alignItems: "start",
  },
  card: {
    background: "var(--bg-1)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-xl)",
    padding: "clamp(1.1rem, 4vw, 1.75rem)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
  },
  cardHead: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    marginBottom: "1.25rem",
  },
  cardIcon: { fontSize: "1.4rem" },
  cardTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "1.2rem",
    fontWeight: 800,
    color: "var(--text-bright)",
    letterSpacing: "-0.025em",
  },
  cardDesc: {
    fontSize: "0.98rem",
    color: "var(--text-secondary)",
    marginBottom: "1.25rem",
    lineHeight: 1.6,
  },
  honeypot: {
    position: "absolute",
    left: "-9999px",
    width: "1px",
    height: "1px",
    opacity: 0,
    overflow: "hidden",
    pointerEvents: "none",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
    marginBottom: "1rem",
  },
  label: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.8rem",
    color: "var(--text-secondary)",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "var(--bg-0)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-bright)",
    fontSize: "1rem",
    padding: "0.65rem 0.95rem",
    fontFamily: "var(--font-body)",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    appearance: "none",
    WebkitAppearance: "none",
  },
  textarea: {
    resize: "vertical",
    minHeight: "96px",
    lineHeight: 1.6,
  },
  fieldError: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.8rem",
    color: "#f87171",
  },
  formError: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.85rem",
    color: "#f87171",
    margin: "0 0 0.75rem",
  },
  successMsg: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.85rem",
    color: "#4ade80",
    margin: "0 0 0.75rem",
  },
  warnMsg: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.85rem",
    color: "#fbbf24",
    margin: "0 0 0.75rem",
  },
  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    background: "linear-gradient(135deg, var(--cyan), var(--purple))",
    color: "#080b12",
    padding: "0.7rem 1.5rem",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    fontSize: "1rem",
    border: "none",
    cursor: "pointer",
  },
  commentsSection: {
    marginTop: "1.75rem",
    paddingTop: "1.5rem",
    borderTop: "1px solid var(--border)",
  },
  commentsTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "1rem",
    fontWeight: 700,
    color: "var(--text-bright)",
    marginBottom: "1rem",
    letterSpacing: "-0.02em",
  },
  emptyText: {
    fontSize: "0.95rem",
    color: "var(--text-secondary)",
    fontStyle: "italic",
  },
  commentWrap: {
    marginBottom: "1rem",
  },
  comment: {
    background: "var(--bg-0)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "0.9rem 1rem",
  },
  commentHead: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    marginBottom: "0.3rem",
    flexWrap: "wrap",
  },
  commentName: {
    fontFamily: "var(--font-display)",
    fontSize: "1rem",
    fontWeight: 700,
    color: "var(--cyan)",
    letterSpacing: "-0.01em",
  },
  adminBadge: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.7rem",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "0.12rem 0.5rem",
    borderRadius: "100px",
    background: "rgba(167,139,250,0.12)",
    color: "#a78bfa",
    border: "1px solid rgba(167,139,250,0.25)",
  },
  commentDate: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.78rem",
    color: "var(--text-secondary)",
    marginLeft: "auto",
  },
  commentText: {
    fontSize: "0.98rem",
    color: "var(--text-primary)",
    lineHeight: 1.6,
    margin: 0,
    overflowWrap: "anywhere",
  },
  moreBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginTop: "0.75rem",
    padding: "0.6rem 1rem",
    background: "var(--bg-2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-secondary)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.85rem",
    cursor: "pointer",
    transition: "all 0.2s",
    letterSpacing: "0.03em",
  },
  replyList: {
    marginLeft: "clamp(0.5rem, 3vw, 1.25rem)",
    marginTop: "0.6rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.6rem",
  },
  reply: {
    display: "flex",
    gap: "0.5rem",
    background: "var(--bg-0)",
    border: "1px dashed var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "0.75rem 0.9rem",
  },
  replyArrow: {
    color: "var(--purple)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.9rem",
    lineHeight: 1.2,
  },

  // ── Let's Stay Connected ──
  connectedSection: {
    marginTop: "1.75rem",
    paddingTop: "1.5rem",
    borderTop: "1px solid var(--border)",
  },
  connectedHead: {
    marginBottom: "1rem",
  },
  connectedTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "1.15rem",
    fontWeight: 700,
    color: "var(--text-bright)",
    letterSpacing: "-0.02em",
    marginBottom: "0.35rem",
  },
  connectedDesc: {
    fontSize: "0.95rem",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
  },
  connectedGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "0.85rem",
  },
  connectedCard: {
    display: "flex",
    alignItems: "center",
    gap: "0.7rem",
    padding: "0.9rem 1rem",
    background: "var(--bg-0)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    textDecoration: "none",
    minWidth: 0,
    overflow: "hidden",
  },
  connectedText: {
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    minWidth: 0,
  },
  connectedLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-secondary)",
  },
  connectedValue: {
    fontSize: "0.9rem",
    color: "var(--text-bright)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  connectedArrow: {
    marginLeft: "auto",
    color: "var(--cyan)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.95rem",
    flexShrink: 0,
  },
};

export default Contact;