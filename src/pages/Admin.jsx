import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { signInAdmin, signOutAdmin, useAdmin, ADMIN_EMAIL } from "../lib/auth";
import { adminFetchStats } from "../lib/admin";
import AdminInbox from "../components/AdminInbox";
import AdminModeration from "../components/AdminModeration";
import AdminVisitors from "../components/AdminVisitors";
import AdminSummary from "../components/AdminSummary";
import AdminContent from "../components/AdminContent";

// ─── Halaman /admin ───────────────────────────────────────────
// 1. Belum login  -> formulir login admin
// 2. Login bukan admin -> beri tahu tidak punya akses
// 3. Login admin  -> dashboard admin (stats, inbox, moderasi, pintu CRUD)
function Admin() {
  const { isAdmin, sessionUser, checking } = useAdmin();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // ── Dashboard state ──
  const [tab, setTab] = useState("ringkasan");
  const [stats, setStats] = useState(null);

  // Muat statistik hanya saat admin login.
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    adminFetchStats().then(({ data }) => {
      if (!cancelled) setStats(data);
    });
    return () => { cancelled = true; };
  }, [isAdmin]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Isi email dan password.");
      return;
    }
    setBusy(true);
    const { error: err } = await signInAdmin(email.trim(), password);
    setBusy(false);
    if (err) {
      setError(err.message || "Login gagal. Periksa email/password.");
      return;
    }
    // Sukses: langsung ke halaman home (public). Sesi admin tetap aktif,
    // jadi CRUD akan muncul di Projects/Experience.
    setEmail("");
    setPassword("");
    navigate("/");
  };

  const handleLogout = async () => {
    await signOutAdmin();
    navigate("/"); // kembali ke halaman user (public)
  };

  // Navigasi dari kartu Ringkasan: tab → setTab, konten → halaman CRUD.
  const handleSummaryNav = (key) => {
    if (key === "konten-project") return navigate("/project");
    if (key === "konten-experience") return navigate("/experience");
    setTab(key);
  };

  return (
    <div className="admin-scope" style={{ background: "var(--bg-0)", minHeight: "100vh", position: "relative", overflowX: "hidden" }}>
      <Navbar />
      <div style={A.glowCyan} />
      <div style={A.glowPurple} />

      <div style={{ paddingTop: "calc(var(--nav-h, 72px) + clamp(2rem, 6vw, 4.5rem))", paddingBottom: "4rem" }}>
        <div className="container">

          <div className="animate-fadeUp" style={{ marginBottom: "2rem" }}>
            <span className="section-label">Admin Access</span>
            <h1 style={A.title}>
              Dashboard <span style={A.titleGradient}>Admin</span>
            </h1>
          </div>

          {checking ? (
            <div className="animate-fadeUp" style={A.box}>
              <p style={A.muted}>Memeriksa sesi…</p>
            </div>
          ) : isAdmin ? (
            <div className="animate-fadeUp">
              {/* ── Tab navigasi ── */}
              <div style={A.tabRow}>
                <button
                  onClick={() => setTab("ringkasan")}
                  style={{ ...A.tabBtn, ...(tab === "ringkasan" ? A.tabBtnActive : A.tabBtnIdle) }}
                >
                  Ringkasan
                </button>
                <button
                  onClick={() => setTab("pengunjung")}
                  style={{ ...A.tabBtn, ...(tab === "pengunjung" ? A.tabBtnActive : A.tabBtnIdle) }}
                >
                  🧭 Pengunjung
                </button>
                <button
                  onClick={() => setTab("pesan")}
                  style={{ ...A.tabBtn, ...(tab === "pesan" ? A.tabBtnActive : A.tabBtnIdle) }}
                >
                  Email Masuk
                  {stats?.messages_new ? <span style={A.tabBadge}>{stats.messages_new}</span> : null}
                </button>
                <button
                  onClick={() => setTab("komentar")}
                  style={{ ...A.tabBtn, ...(tab === "komentar" ? A.tabBtnActive : A.tabBtnIdle) }}
                >
                  Komentar Masuk
                  {stats?.comments_pending ? <span style={A.tabBadge}>{stats.comments_pending}</span> : null}
                </button>
                <button
                  onClick={() => setTab("konten")}
                  style={{ ...A.tabBtn, ...(tab === "konten" ? A.tabBtnActive : A.tabBtnIdle) }}
                >
                  ✏️ Konten Situs
                </button>
                <Link to="/" className="btn-micro" style={A.btnSite}>← Halaman User</Link>
              </div>

              {tab === "ringkasan" && (
                <AdminSummary
                  onGo={handleSummaryNav}
                  onLogout={handleLogout}
                  sessionUser={sessionUser}
                />
              )}

              {tab === "pesan" && <div style={A.box}><AdminInbox /></div>}
              {tab === "komentar" && <div style={A.box}><AdminModeration /></div>}
              {tab === "pengunjung" && <div style={A.box}><AdminVisitors /></div>}
              {tab === "konten" && <div style={A.box}><AdminContent /></div>}
            </div>
          ) : sessionUser ? (
            /* ── Login tapi bukan admin ── */
            <div className="animate-fadeUp" style={A.box}>
              <p style={A.muted}>
                Akun <strong style={{ color: "var(--text-bright)" }}>{sessionUser.email}</strong>{" "}
                tidak memiliki akses admin.
              </p>
              <p style={A.mutedSmall}>
                Akses hanya untuk email <strong style={{ color: "var(--cyan)" }}>{ADMIN_EMAIL || "(belum diatur)"}</strong>.
              </p>
              <button className="btn-micro" style={A.btnLogout} onClick={handleLogout}>
                Keluar
              </button>
            </div>
          ) : (
            /* ── Formulir login ── */
            <form className="animate-fadeUp" onSubmit={handleSubmit} style={A.box}>
              <label htmlFor="admin-email" style={A.label}>Email</label>
              <input
                id="admin-email"
                style={A.input}
                type="email"
                autoComplete="username"
                placeholder="admin@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <label htmlFor="admin-password" style={{ ...A.label, marginTop: "1rem" }}>Password</label>
              <input
                id="admin-password"
                style={A.input}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && <p role="alert" style={A.error}>{error}</p>}

              <button
                type="submit"
                className="btn-micro"
                style={{ ...A.btnPrimary, marginTop: "1.25rem", width: "100%" }}
                disabled={busy}
              >
                {busy ? "Memeriksa…" : "Masuk ke Dashboard"}
              </button>

              <p style={{ ...A.mutedSmall, marginTop: "1.25rem" }}>
                Area khusus admin. Pengunjung tetap bisa melihat portofolio di{" "}
                <Link to="/" style={{ color: "var(--cyan)" }}>halaman utama</Link>.
              </p>
            </form>
          )}

        </div>
      </div>

      <Footer />
    </div>
  );
}

// ─── Styles (mengikuti desain situs yang sudah ada) ─────────────
const A = {
  glowCyan: {
    position: "absolute",
    top: "-10%",
    right: "-8%",
    width: "min(640px, 80vw)",
    height: "min(640px, 80vw)",
    background: "radial-gradient(circle at center, rgba(34,211,238,0.09) 0%, transparent 65%)",
    pointerEvents: "none",
    zIndex: 0,
    overflow: "hidden",
  },
  glowPurple: {
    position: "absolute",
    bottom: "5%",
    left: "-5%",
    width: "min(480px, 60vw)",
    height: "min(480px, 60vw)",
    background: "radial-gradient(circle at center, rgba(167,139,250,0.07) 0%, transparent 65%)",
    pointerEvents: "none",
    zIndex: 0,
    overflow: "hidden",
  },
  title: {
    fontSize: "clamp(2rem, 5vw, 3rem)",
    fontWeight: 900,
    letterSpacing: "-0.035em",
    color: "var(--text-bright)",
    marginTop: "0.5rem",
    fontFamily: "var(--font-display)",
  },
  titleGradient: {
    background: "linear-gradient(135deg, var(--cyan) 0%, var(--purple) 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  tabRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    flexWrap: "wrap",
    marginBottom: "1.25rem",
  },
  tabBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "0.95rem",
    fontWeight: 600,
    fontFamily: "var(--font-body)",
    padding: "0.5rem 1rem",
    borderRadius: "10px",
    cursor: "pointer",
    border: "1px solid transparent",
    transition: "all 0.2s",
  },
  tabBtnActive: {
    background: "var(--bg-3)",
    color: "var(--text-bright)",
    border: "1px solid var(--border-hover)",
  },
  tabBtnIdle: {
    background: "transparent",
    color: "var(--text-secondary)",
  },
  tabBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "18px",
    height: "18px",
    padding: "0 5px",
    borderRadius: "100px",
    background: "var(--cyan-dim)",
    color: "var(--cyan)",
    border: "1px solid var(--cyan-border)",
    fontFamily: "var(--font-mono)",
    fontSize: "0.72rem",
    fontWeight: 700,
  },
  box: {
    background: "var(--bg-1)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "clamp(1.1rem, 4vw, 1.75rem)",
    minWidth: 0,
  },
  label: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.8rem",
    color: "var(--text-secondary)",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    display: "block",
    marginBottom: "0.4rem",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "var(--bg-0)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-bright)",
    fontSize: "0.9rem",
    padding: "0.65rem 0.95rem",
    fontFamily: "var(--font-body)",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, var(--cyan), var(--purple))",
    color: "#080b12",
    padding: "0.7rem 1.4rem",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    fontSize: "0.9rem",
    border: "none",
    cursor: "pointer",
  },
  btnLogout: {
    background: "var(--bg-3)",
    color: "var(--text-secondary)",
    padding: "0.6rem 1.2rem",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "0.85rem",
    border: "1px solid var(--border)",
    cursor: "pointer",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.75rem",
    alignItems: "center",
  },
  btnSite: {
    marginLeft: "auto",
    whiteSpace: "nowrap",
    background: "transparent",
    color: "var(--cyan)",
    padding: "0.55rem 1.1rem",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "0.82rem",
    border: "1px solid var(--cyan)",
    textDecoration: "none",
  },
  error: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    color: "#f87171",
    marginTop: "0.75rem",
  },
  adminEmail: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.9rem",
    color: "var(--cyan)",
    margin: 0,
    wordBreak: "break-all",
  },
  muted: {
    fontSize: "1rem",
    color: "var(--text-secondary)",
    margin: 0,
  },
  mutedSmall: {
    fontSize: "0.9rem",
    color: "var(--text-secondary)",
    marginTop: "0.5rem",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "0.75rem",
  },
  statCard: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "1rem 1.1rem",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
  },
  statNum: {
    fontFamily: "var(--font-display)",
    fontWeight: 900,
    fontSize: "1.7rem",
    letterSpacing: "-0.04em",
    lineHeight: 1,
  },
  statLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.78rem",
    color: "var(--text-secondary)",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: "0.3rem",
    padding: "1.5rem",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    textDecoration: "none",
    transition: "border-color 0.3s, transform 0.3s, box-shadow 0.3s",
  },
  cardIcon: { fontSize: "1.6rem" },
  cardTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "1.05rem",
    color: "var(--text-bright)",
    letterSpacing: "-0.02em",
  },
  cardDesc: {
    fontSize: "0.9rem",
    color: "var(--text-secondary)",
  },
};

export default Admin;