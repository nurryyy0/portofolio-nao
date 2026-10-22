import { useState, useEffect } from "react";
import {
  adminFetchMessages,
  adminUpdateMessage,
  adminDeleteMessage,
} from "../lib/admin";

const STATUS_META = {
  new: { label: "Baru", color: "#22d3ee", bg: "rgba(34,211,238,0.10)", border: "rgba(34,211,238,0.25)" },
  read: { label: "Dibaca", color: "#7a8599", bg: "rgba(122,133,153,0.10)", border: "rgba(122,133,153,0.25)" },
  replied: { label: "Sudah dibalas", color: "#4ade80", bg: "rgba(74,222,128,0.10)", border: "rgba(74,222,128,0.25)" },
};

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
}

/** Inbox pesan yang dikirim pengunjung via halaman Contact. */
function AdminInbox() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    adminFetchMessages().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setError(error.message || "Gagal memuat pesan.");
        return;
      }
      setItems(data || []);
      setError("");
    });
    return () => { cancelled = true; };
  }, []);

  const setStatus = async (id, status) => {
    setBusyId(id);
    const { error } = await adminUpdateMessage(id, status);
    setBusyId(null);
    if (error) {
      setError(error.message || "Gagal mengubah status.");
      return;
    }
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
  };

  const remove = async (id) => {
    if (!window.confirm("Hapus pesan ini permanen?")) return;
    const { error } = await adminDeleteMessage(id);
    if (error) {
      setError(error.message || "Gagal menghapus.");
      return;
    }
    setItems((prev) => prev.filter((m) => m.id !== id));
  };

  if (items === null) return <p style={S.muted}>Memuat pesan masuk…</p>;

  return (
    <div>
      {error && <p style={S.error}>{error}</p>}
      {items.length === 0 ? (
        <p style={S.empty}>Belum ada pesan masuk. 🎉</p>
      ) : (
        items.map((m) => {
          const meta = STATUS_META[m.status] || STATUS_META.new;
          return (
            <div key={m.id} style={S.card}>
              <div style={S.cardHead}>
                <span style={S.mail}>{m.email}</span>
                <span style={{ ...S.badge, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
                  {meta.label}
                </span>
                <span style={S.date}>{formatDate(m.created_at)}</span>
              </div>
              <p style={S.msg}>{m.message}</p>
              <div style={S.actions}>
                <select
                  value={m.status}
                  onChange={(e) => setStatus(m.id, e.target.value)}
                  disabled={busyId === m.id}
                  style={S.select}
                  aria-label="Ubah status pesan"
                >
                  <option value="new">Baru</option>
                  <option value="read">Tandai dibaca</option>
                  <option value="replied">Tandai sudah dibalas</option>
                </select>
                <button style={S.btnDanger} onClick={() => remove(m.id)} disabled={busyId === m.id}>
                  Hapus
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

const S = {
  muted: { fontSize: "0.95rem", color: "var(--text-secondary)" },
  empty: { fontSize: "0.95rem", color: "var(--text-secondary)", fontStyle: "italic" },
  error: {
    fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "#f87171",
    background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
    borderRadius: "var(--radius-md)", padding: "0.65rem 0.9rem", marginBottom: "1rem",
  },
  card: {
    background: "var(--bg-0)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", padding: "1rem 1.15rem", marginBottom: "0.75rem",
  },
  cardHead: { display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.5rem" },
  mail: {
    fontFamily: "var(--font-mono)", fontSize: "0.92rem", color: "var(--cyan)", fontWeight: 600,
    overflowWrap: "anywhere", minWidth: 0,
  },
  badge: {
    fontFamily: "var(--font-mono)", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em",
    textTransform: "uppercase", padding: "0.15rem 0.55rem", borderRadius: "100px",
  },
  date: { fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-secondary)", marginLeft: "auto" },
  msg: {
    fontSize: "0.98rem", color: "var(--text-primary)", lineHeight: 1.7,
    whiteSpace: "pre-wrap", overflowWrap: "anywhere",
  },
  actions: { display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.75rem", flexWrap: "wrap" },
  select: {
    background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
    color: "var(--text-primary)", fontSize: "0.9rem", padding: "0.4rem 0.7rem", fontFamily: "var(--font-body)",
    cursor: "pointer", maxWidth: "100%",
  },
  btnDanger: {
    fontFamily: "var(--font-mono)", fontSize: "0.8rem", fontWeight: 700,
    padding: "0.38rem 0.8rem", borderRadius: "var(--radius-md)",
    background: "rgba(248,113,113,0.09)", color: "#f87171",
    border: "1px solid rgba(248,113,113,0.22)", cursor: "pointer",
  },
};

export default AdminInbox;