import { useState, useEffect } from "react";
import {
  adminFetchStats,
  adminFetchVisitorDays,
  adminFetchRecentVisits,
} from "../lib/admin";

const pad = (n) => String(n).padStart(2, "0");
const toDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function dayLabel(dayStr) {
  const d = new Date(dayStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric" });
}

function formatDateTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
}

function formatDeviceType(type) {
  if (type === "Mobile") return "Ponsel";
  if (type === "Tablet") return "Tablet";
  if (type === "Desktop") return "Desktop";
  return "Tidak diketahui";
}

/** Tab Pengunjung: ringkasan + grafik 7 hari + kunjungan terbaru. */
function AdminVisitors() {
  const [stats, setStats] = useState(null);
  const [days, setDays] = useState([]);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    adminFetchStats().then(({ data }) => { if (!cancelled) setStats(data); });
    adminFetchVisitorDays().then(({ data }) => { if (!cancelled) setDays(data); });
    adminFetchRecentVisits(20).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setError(error.message || "Gagal memuat riwayat kunjungan.");
      else setRecent(data || []);
    });
    return () => { cancelled = true; };
  }, []);

  // Bangun 7 hari terakhir (termasuk hari tanpa kunjungan = 0).
  const daysMap = new Map(days.map((d) => [d.day, d.count]));
  const bars = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = toDay(day);
    bars.push({ day: key, label: dayLabel(key), count: daysMap.get(key) || 0 });
  }
  const max = Math.max(1, ...bars.map((b) => b.count));

  const statCards = [
    { label: "Total Kunjungan", value: stats?.visitors_total, color: "var(--cyan)" },
    { label: "Kunjungan Hari Ini", value: stats?.visitors_today, color: "var(--purple)" },
    { label: "7 Hari Terakhir", value: stats?.visitors_week, color: "#4ade80" },
    { label: "Pengunjung Unik", value: stats?.visitors_unique, color: "#fb923c" },
  ];

  return (
    <div>
      {/* Responsive: grafik 7 hari lebih rapat di HP + baris kunjungan menumpuk */}
      <style>{`
        @media (max-width: 560px) {
          .admin-vis-chart { gap: 0.25rem !important; padding: 0.75rem !important; }
          .admin-vis-track { height: 84px !important; }
          .admin-vis-row { flex-direction: column !important; align-items: flex-start !important; gap: 0.25rem !important; }
        }
      `}</style>
      {error && <p style={V.error}>{error}</p>}

      {/* Kartu statistik */}
      <div style={V.statGrid}>
        {statCards.map((c) => (
          <div key={c.label} style={V.statCard}>
            <span style={{ ...V.statNum, color: c.color }}>{c.value ?? "–"}</span>
            <span style={V.statLabel}>{c.label}</span>
          </div>
        ))}
      </div>

      {/* Grafik 7 hari */}
      <div style={V.sectionTitle}>Kunjungan 7 Hari Terakhir</div>
      <div className="admin-vis-chart" style={V.chart}>
        {bars.map((b) => (
          <div key={b.day} style={V.barCol}>
            <div className="admin-vis-track" style={V.barTrack}>
              <div
                style={{
                  ...V.barFill,
                  height: `${b.count > 0 ? Math.max((b.count / max) * 100, 6) : 0}%`,
                }}
              />
            </div>
            <span style={V.barLabel}>{b.label}</span>
            <span style={V.barCount}>{b.count}</span>
          </div>
        ))}
      </div>

      {/* Riwayat kunjungan terbaru */}
      <div style={V.sectionTitle}>Kunjungan Terbaru</div>
      {recent.length === 0 ? (
        <p style={V.empty}>Belum ada data kunjungan.</p>
      ) : (
        <div style={V.list}>
          {recent.map((r) => (
            <div key={r.id} className="admin-vis-row" style={V.row}>
              <span style={V.device}>
                {r.device_name || formatDeviceType(r.device_type)}
              </span>
              <span style={V.date}>{formatDateTime(r.visited_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const V = {
  error: {
    fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "#f87171",
    background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
    borderRadius: "var(--radius-md)", padding: "0.65rem 0.9rem", marginBottom: "1rem",
  },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "0.75rem",
  },
  statCard: {
    display: "flex", flexDirection: "column", gap: "4px",
    padding: "1rem 1.1rem",
    background: "var(--bg-card)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
  },
  statNum: {
    fontFamily: "var(--font-display)", fontWeight: 900, fontSize: "1.7rem",
    letterSpacing: "-0.04em", lineHeight: 1,
  },
  statLabel: {
    fontFamily: "var(--font-mono)", fontSize: "0.78rem", color: "var(--text-secondary)",
    letterSpacing: "0.05em", textTransform: "uppercase",
  },
  sectionTitle: {
    fontFamily: "var(--font-display)", fontSize: "0.95rem", fontWeight: 700,
    color: "var(--text-bright)", margin: "1.5rem 0 0.75rem",
  },
  chart: {
    display: "flex", gap: "0.5rem", alignItems: "flex-end",
    background: "var(--bg-0)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", padding: "1rem",
  },
  barCol: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: 0 },
  barTrack: {
    position: "relative", width: "100%", maxWidth: "44px", height: "110px",
    background: "var(--bg-2)", borderRadius: "8px", overflow: "hidden",
    display: "flex", alignItems: "flex-end",
  },
  barFill: {
    width: "100%",
    background: "linear-gradient(135deg, var(--cyan), var(--purple))",
    borderRadius: "8px 8px 4px 4px",
    transition: "height 0.4s cubic-bezier(0.16,1,0.3,1)",
  },
  barLabel: {
    fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: "var(--text-secondary)",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%",
  },
  barCount: {
    fontFamily: "var(--font-display)", fontSize: "0.95rem", fontWeight: 700,
    color: "var(--text-bright)",
  },
  empty: { fontSize: "0.95rem", color: "var(--text-secondary)", fontStyle: "italic" },
  list: { display: "flex", flexDirection: "column", gap: "0.4rem" },
  row: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem",
    background: "var(--bg-0)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)", padding: "0.55rem 0.9rem",
  },
  device: { fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--cyan)" },
  date: { fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-secondary)" },
};

export default AdminVisitors;