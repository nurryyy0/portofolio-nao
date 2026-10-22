import { useState, useEffect } from "react";
import {
  adminFetchStats,
  adminFetchVisitorDays,
  adminFetchMessages,
  adminFetchComments,
} from "../lib/admin";

const pad = (n) => String(n).padStart(2, "0");
const toDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayLabel = (s) => {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric" });
};
const fmtDate = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
};
const num = (n, s = "–") => (typeof n === "number" ? n.toLocaleString("id-ID") : s);

function SectionTitle({ icon, title, badge, onSeeAll }) {
  return (
    <div style={Y.sectionHead}>
      <div style={Y.sectionLeft}>
        <span style={Y.sectionIcon}>{icon}</span>
        <span style={Y.sectionTitle}>{title}</span>
        {badge}
      </div>
      {onSeeAll && (
        <button type="button" style={Y.seeAll} onClick={onSeeAll}>Lihat detail →</button>
      )}
    </div>
  );
}

function MiniBadge({ children, color, bg, border }) {
  return (
    <span style={{ ...Y.badge, color, background: bg, border: `1px solid ${border}` }}>{children}</span>
  );
}

/** Tab Ringkasan: dashboard berkelompok per sesi supaya mudah dilihat & dianalisis. */
function AdminSummary({ onGo, onLogout, sessionUser }) {
  const [stats, setStats] = useState(null);
  const [days, setDays] = useState([]);
  const [messages, setMessages] = useState([]);
  const [pendingComments, setPendingComments] = useState([]);

  useEffect(() => {
    let cancelled = false;
    adminFetchStats().then(({ data }) => { if (!cancelled) setStats(data); });
    adminFetchVisitorDays().then(({ data }) => { if (!cancelled) setDays(Array.isArray(data) ? data : []); });
    adminFetchMessages().then(({ data }) => { if (!cancelled) setMessages((data || []).slice(0, 4)); });
    adminFetchComments().then(({ data }) => {
      if (!cancelled) {
        setPendingComments((data || []).filter((c) => c.status === "pending").slice(0, 4));
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Grafik 7 hari terakhir (termasuk hari tanpa kunjungan = 0).
  const m = new Map(days.map((d) => [d.day, d.count]));
  const bars = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = toDay(day);
    bars.push({ day: key, label: dayLabel(key), count: m.get(key) || 0 });
  }
  const maxBar = Math.max(1, ...bars.map((b) => b.count));
  const todayCount = bars[6]?.count || 0;
  const yesterdayCount = bars[5]?.count || 0;
  const delta = todayCount - yesterdayCount;
  const trend = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";

  return (
    <div style={Y.wrap}>
      {/* Responsive: grid 2-kolom dashboard ditumpuk di HP */}
      <style>{`
        @media (max-width: 700px) {
          .admin-vis-grid,
          .admin-content-grid {
            grid-template-columns: minmax(0, 1fr) !important;
          }
          .admin-vis-stats { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 520px) {
          .admin-chart { height: 96px !important; }
        }
      `}</style>
      {/* ── Kepala: sesi admin ── */}
      <div style={Y.userCard}>
        <div style={Y.userLeft}>
          <span style={Y.userAvatar}>A</span>
          <div>
            <div style={Y.userName}>{sessionUser?.email || "Admin"}</div>
            <div style={Y.userMeta}>Mode admin aktif — dashboard & CRUD siap digunakan</div>
          </div>
        </div>
        <button type="button" className="btn-micro" style={Y.logout} onClick={onLogout}>Keluar</button>
      </div>

      {/* ── Sesi 1: Pengunjung ── */}
      <div style={Y.card}>
        <SectionTitle
          icon="🧭"
          title="Pengunjung"
          onSeeAll={() => onGo("pengunjung")}
          badge={
            <MiniBadge color="#fb923c" bg="rgba(251,146,60,0.1)" border="rgba(251,146,60,0.25)">
              {todayCount} hari ini
            </MiniBadge>
          }
        />
        <div className="admin-vis-grid" style={Y.visGrid}>
          {/* Angka kunci + tren */}
          <div className="admin-vis-stats" style={Y.visStats}>
            <div style={Y.visStat}>
              <span style={Y.visNum}>{num(stats?.visitors_total)}</span>
              <span style={Y.visLabel}>Total Kunjungan</span>
            </div>
            <div style={Y.visStat}>
              <span style={Y.visNum}>{num(stats?.visitors_today)}</span>
              <span style={Y.visLabel}>Hari Ini</span>
            </div>
            <div style={Y.visStat}>
              <span style={Y.visNum}>{num(stats?.visitors_week)}</span>
              <span style={Y.visLabel}>7 Hari</span>
            </div>
            <div style={Y.visStat}>
              <span style={Y.visNum}>{num(stats?.visitors_unique)}</span>
              <span style={Y.visLabel}>Pengunjung Unik</span>
            </div>
            <div style={Y.trend}>
              <span style={{ color: delta > 0 ? "#4ade80" : delta < 0 ? "#f87171" : "var(--text-muted)" }}>
                {trend} {todayCount - yesterdayCount >= 0 ? "+" : ""}{Math.abs(delta)}
              </span>
              <span style={Y.trendLabel}>vs kemarin</span>
            </div>
          </div>
          {/* Grafik mini */}
          <div className="admin-chart" style={Y.chart}>
            {bars.map((b) => (
              <div key={b.day} style={Y.barCol}>
                <div style={Y.barTrack}>
                  <div style={{ ...Y.barFill, height: `${b.count > 0 ? Math.max((b.count / maxBar) * 100, 6) : 0}%` }} />
                </div>
                <span style={Y.barLabel}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sesi 2: Pesan Masuk ── */}
      <div style={Y.card}>
        <SectionTitle
          icon="📥"
          title="Pesan Masuk"
          onSeeAll={() => onGo("pesan")}
          badge={
            stats?.messages_new ? (
              <MiniBadge color="var(--cyan)" bg="var(--cyan-dim)" border="var(--cyan-border)">
                {stats.messages_new} baru
              </MiniBadge>
            ) : (
              <MiniBadge color="#7a8599" bg="rgba(122,133,153,0.1)" border="rgba(122,133,153,0.25)">
                0 baru
              </MiniBadge>
            )
          }
        />
        {messages.length === 0 ? (
          <p style={Y.empty}>Belum ada pesan masuk. 🎉</p>
        ) : (
          <div style={Y.list}>
            {messages.map((msg) => (
              <div key={msg.id} style={Y.row}>
                <span style={Y.rowMail}>{msg.email}</span>
                <span style={Y.rowText}>{String(msg.message).slice(0, 90)}{String(msg.message).length > 90 ? "…" : ""}</span>
                <span style={Y.rowDate}>{fmtDate(msg.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Sesi 3: Komentar (moderasi) ── */}
      <div style={Y.card}>
        <SectionTitle
          icon="💬"
          title="Komentar Masuk"
          onSeeAll={() => onGo("komentar")}
          badge={
            <>
              <MiniBadge color="#fbbf24" bg="rgba(251,191,36,0.1)" border="rgba(251,191,36,0.25)">
                {num(stats?.comments_pending)} menunggu
              </MiniBadge>
              <MiniBadge color="#4ade80" bg="rgba(74,222,128,0.1)" border="rgba(74,222,128,0.25)">
                {num(stats?.comments_published)} tampil
              </MiniBadge>
              <MiniBadge color="#f87171" bg="rgba(248,113,113,0.1)" border="rgba(248,113,113,0.25)">
                {num(stats?.comments_hidden)} hidden
              </MiniBadge>
            </>
          }
        />
        {pendingComments.length === 0 ? (
          <p style={Y.empty}>Tidak ada komentar menunggu moderasi.</p>
        ) : (
          <div style={Y.list}>
            {pendingComments.map((c) => (
              <div key={c.id} style={Y.row}>
                <span style={Y.rowMail}>{c.name}</span>
                <span style={Y.rowText}>{String(c.content).slice(0, 90)}{String(c.content).length > 90 ? "…" : ""}</span>
                <span style={Y.rowDate}>{fmtDate(c.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Sesi 4: Konten ── */}
      <div style={Y.card}>
        <SectionTitle icon="📁" title="Konten Anda" />
        <div className="admin-content-grid" style={Y.contentGrid}>
          <button type="button" style={Y.contentCard} onClick={() => onGo("konten-project")}>
            <span style={Y.contentEmoji}>📁</span>
            <div>
              <div style={Y.contentTitle}>Projects</div>
              <div style={Y.contentMeta}>{num(stats?.projects_count)} proyek terdaftar</div>
            </div>
            <span style={Y.contentGo}>→</span>
          </button>
          <button type="button" style={Y.contentCard} onClick={() => onGo("konten-experience")}>
            <span style={Y.contentEmoji}>🎓</span>
            <div>
              <div style={Y.contentTitle}>Experience</div>
              <div style={Y.contentMeta}>{num(stats?.experiences_count)} pengalaman terdaftar</div>
            </div>
            <span style={Y.contentGo}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const Y = {
  wrap: { display: "flex", flexDirection: "column", gap: "1rem" },

  userCard: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap",
    background: "var(--bg-card)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", padding: "1rem 1.25rem",
  },
  userLeft: { display: "flex", alignItems: "center", gap: "0.85rem", minWidth: 0 },
  userAvatar: {
    width: "42px", height: "42px", borderRadius: "12px", flexShrink: 0,
    background: "linear-gradient(135deg, var(--cyan), var(--purple))",
    color: "#080b12", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.1rem",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  userName: {
    fontFamily: "var(--font-display)", fontSize: "0.95rem", fontWeight: 700,
    color: "var(--text-bright)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
  },
  userMeta: { fontSize: "0.88rem", color: "var(--text-secondary)" },
  logout: {
    background: "var(--bg-3)", color: "var(--text-secondary)",
    padding: "0.55rem 1.1rem", borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.82rem",
    border: "1px solid var(--border)", cursor: "pointer",
  },

  card: {
    background: "var(--bg-1)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", padding: "1.25rem 1.4rem",
  },
  sectionHead: { display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" },
  sectionLeft: { display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", minWidth: 0 },
  sectionIcon: { fontSize: "1.15rem" },
  sectionTitle: { fontFamily: "var(--font-display)", fontSize: "1.02rem", fontWeight: 700, color: "var(--text-bright)" },
  seeAll: {
    marginLeft: "auto", background: "transparent", border: "1px solid var(--border)",
    color: "var(--cyan)", fontFamily: "var(--font-mono)", fontSize: "0.8rem",
    padding: "0.35rem 0.75rem", borderRadius: "100px", cursor: "pointer", transition: "all 0.2s",
  },
  badge: {
    fontFamily: "var(--font-mono)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.04em",
    padding: "0.16rem 0.55rem", borderRadius: "100px", whiteSpace: "nowrap",
  },

  visGrid: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr)", gap: "1.25rem", alignItems: "center" },
  visStats: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" },
  visStat: {
    background: "var(--bg-0)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
    padding: "0.7rem 0.85rem", display: "flex", flexDirection: "column", gap: "2px",
  },
  visNum: { fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "1.35rem", letterSpacing: "-0.03em", color: "var(--text-bright)", lineHeight: 1 },
  visLabel: { fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" },
  trend: {
    gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: "0.5rem",
    fontFamily: "var(--font-mono)", fontSize: "0.82rem",
  },
  trendLabel: { color: "var(--text-secondary)" },

  chart: { display: "flex", gap: "0.3rem", alignItems: "flex-end", height: "120px" },
  barCol: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", minWidth: 0, height: "100%" },
  barTrack: {
    position: "relative", width: "100%", maxWidth: "30px", height: "96px",
    background: "var(--bg-2)", borderRadius: "6px", overflow: "hidden",
    display: "flex", alignItems: "flex-end",
  },
  barFill: {
    width: "100%", background: "linear-gradient(135deg, var(--cyan), var(--purple))",
    borderRadius: "6px 6px 3px 3px", transition: "height 0.4s cubic-bezier(0.16,1,0.3,1)",
  },
  barLabel: { fontFamily: "var(--font-mono)", fontSize: "0.68rem", color: "var(--text-secondary)", whiteSpace: "nowrap" },

  empty: { fontSize: "0.95rem", color: "var(--text-secondary)", fontStyle: "italic" },
  list: { display: "flex", flexDirection: "column", gap: "0.4rem" },
  row: {
    display: "flex", alignItems: "center", gap: "0.8rem", flexWrap: "wrap",
    background: "var(--bg-0)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)", padding: "0.55rem 0.85rem", minWidth: 0,
  },
  rowMail: {
    fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--cyan)",
    minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%",
  },
  rowText: { fontSize: "0.92rem", color: "var(--text-secondary)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", minWidth: 0 },
  rowDate: { fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-secondary)", flexShrink: 0, marginLeft: "auto" },

  contentGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" },
  contentCard: {
    display: "flex", alignItems: "center", gap: "0.75rem",
    background: "var(--bg-card)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)", padding: "1rem 1.1rem",
    cursor: "pointer", textAlign: "left", transition: "all 0.2s",
  },
  contentEmoji: { fontSize: "1.4rem" },
  contentTitle: { fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem", color: "var(--text-bright)" },
  contentMeta: { fontSize: "0.88rem", color: "var(--text-secondary)" },
  contentGo: { marginLeft: "auto", color: "var(--cyan)", fontFamily: "var(--font-mono)" },
};

export default AdminSummary;