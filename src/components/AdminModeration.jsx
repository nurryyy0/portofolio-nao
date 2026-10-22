import { useState, useEffect } from "react";
import {
  adminFetchComments,
  adminSetCommentStatus,
  adminDeleteComment,
  adminReplyComment,
} from "../lib/admin";

const STATUS_META = {
  published: { label: "Published", color: "#4ade80", bg: "rgba(74,222,128,0.10)", border: "rgba(74,222,128,0.25)" },
  pending: { label: "Pending", color: "#fbbf24", bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.25)" },
  hidden: { label: "Hidden", color: "#f87171", bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.25)" },
};

const FILTERS = [
  { key: "all", label: "Semua" },
  { key: "published", label: "Published" },
  { key: "pending", label: "Pending" },
  { key: "hidden", label: "Hidden" },
];

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
}

function CommentRow({ item, onStatus, onDelete, onReply }) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const meta = STATUS_META[item.status] || STATUS_META.pending;

  const submitReply = async () => {
    if (!reply.trim() || busy) return;
    setBusy(true);
    const { error } = await onReply(item.id, reply);
    setBusy(false);
    if (error) return;
    setReply("");
    setReplying(false);
  };

  return (
    <div style={S.row}>
      <div style={S.rowHead}>
        <span style={S.author}>
          {item.is_admin ? "Admin" : item.name}
          {item.is_admin && <span style={S.adminTag}>admin</span>}
        </span>
        <span style={{ ...S.badge, color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
          {meta.label}
        </span>
        <span style={S.date}>{formatDate(item.created_at)}</span>
      </div>
      <p style={S.content}>{item.content}</p>
      <div style={S.actions}>
        {item.status !== "published" && (
          <button style={S.btnOk} onClick={() => onStatus(item.id, "published")}>✓ Terbitkan</button>
        )}
        {item.status !== "pending" && (
          <button style={S.btnNeutral} onClick={() => onStatus(item.id, "pending")}>⏳ Pending</button>
        )}
        {item.status !== "hidden" && (
          <button style={S.btnWarn} onClick={() => onStatus(item.id, "hidden")}>🙈 Sembunyikan</button>
        )}
        <button
          style={S.btnDanger}
          onClick={() => { if (window.confirm("Hapus komentar ini permanen?")) onDelete(item.id); }}
        >
          🗑 Hapus
        </button>
        <button style={S.btnReply} onClick={() => setReplying((v) => !v)}>
          {replying ? "✕ Batal" : "↩ Balas"}
        </button>
      </div>
      {replying && (
        <div style={S.replyBox}>
          <textarea
            rows={2}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Tulis balasan admin (tampil publik sebagai thread balasan)…"
            style={S.textarea}
          />
          <button style={S.btnSend} onClick={submitReply} disabled={busy || !reply.trim()}>
            {busy ? "Mengirim…" : "Kirim balasan"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Moderasi komentar: ubah status published/pending/hidden, hapus, balas sebagai admin. */
function AdminModeration() {
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    adminFetchComments().then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setError(error.message || "Gagal memuat komentar.");
        return;
      }
      setItems(data || []);
      setError("");
    });
    return () => { cancelled = true; };
  }, []);

  const changeStatus = async (id, status) => {
    const { error } = await adminSetCommentStatus(id, status);
    if (error) {
      setError(error.message || "Gagal mengubah status.");
      return;
    }
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  };

  const remove = async (id) => {
    const { error } = await adminDeleteComment(id);
    if (error) {
      setError(error.message || "Gagal menghapus.");
      return;
    }
    setItems((prev) => prev.filter((c) => c.id !== id));
  };

  const reply = async (parentId, content) => {
    const { error } = await adminReplyComment(parentId, content);
    if (error) {
      setError(error.message || "Gagal mengirim balasan.");
      return { error };
    }
    // Muat ulang agar thread baru ikut tampil.
    const { data } = await adminFetchComments();
    if (data) setItems(data);
    return { error: null };
  };

  // Build thread tree (root + balasan).
  const makeTree = () => {
    const list = items || [];
    const byParent = new Map();
    const roots = [];
    list.forEach((c) => {
      const hasParentInList = Boolean(c.parent_id && list.some((x) => x.id === c.parent_id));
      if (hasParentInList) {
        if (!byParent.has(c.parent_id)) byParent.set(c.parent_id, []);
        byParent.get(c.parent_id).push(c);
      } else {
        roots.push(c);
      }
    });
    byParent.forEach((arr) => arr.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    roots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return { roots, byParent };
  };

  const matches = (c) => filter === "all" || c.status === filter;

  const renderBranch = (node, depth, { byParent }) => {
    if (!matches(node)) return null;
    return (
      <div key={node.id} style={{ marginLeft: depth ? "min(26px, 4vw)" : 0 }}>
        <CommentRow item={node} onStatus={changeStatus} onDelete={remove} onReply={reply} />
        {(byParent.get(node.id) || []).map((child) => renderBranch(child, depth + 1, { byParent }))}
      </div>
    );
  };

  if (items === null) return <p style={S.muted}>Memuat komentar…</p>;

  const { roots, byParent } = makeTree();

  return (
    <div>
      {error && <p style={S.error}>{error}</p>}

      <div style={S.filters}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              ...S.filterBtn,
              background: filter === f.key ? "var(--bg-3)" : "transparent",
              color: filter === f.key ? "var(--text-bright)" : "var(--text-secondary)",
              borderColor: filter === f.key ? "var(--border-hover)" : "transparent",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {roots.length === 0 ? (
        <p style={S.empty}>Belum ada komentar.</p>
      ) : (
        roots.map((r) => renderBranch(r, 0, { roots, byParent }))
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
  filters: { display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1rem" },
  filterBtn: {
    fontFamily: "var(--font-body)", fontSize: "0.9rem", fontWeight: 600,
    padding: "0.4rem 0.9rem", borderRadius: "10px", cursor: "pointer",
    border: "1px solid transparent", transition: "all 0.2s",
  },
  row: {
    background: "var(--bg-0)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)", padding: "0.9rem 1rem", marginBottom: "0.7rem",
  },
  rowHead: { display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.4rem" },
  author: { fontFamily: "var(--font-display)", fontSize: "0.98rem", fontWeight: 700, color: "var(--cyan)" },
  adminTag: {
    fontFamily: "var(--font-mono)", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em",
    textTransform: "uppercase", marginLeft: "0.35rem", padding: "0.1rem 0.45rem",
    borderRadius: "100px", background: "rgba(167,139,250,0.12)", color: "#a78bfa",
    border: "1px solid rgba(167,139,250,0.25)",
  },
  badge: {
    fontFamily: "var(--font-mono)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em",
    textTransform: "uppercase", padding: "0.14rem 0.55rem", borderRadius: "100px",
  },
  date: { fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--text-secondary)", marginLeft: "auto" },
  content: {
    fontSize: "0.95rem", color: "var(--text-primary)", lineHeight: 1.7,
    marginBottom: "0.6rem", overflowWrap: "anywhere",
  },
  actions: { display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" },
  btnOk: btn("#4ade80", "rgba(74,222,128,0.09)", "rgba(74,222,128,0.22)"),
  btnNeutral: btn("#fbbf24", "rgba(251,191,36,0.08)", "rgba(251,191,36,0.22)"),
  btnWarn: btn("#f87171", "rgba(248,113,113,0.09)", "rgba(248,113,113,0.22)"),
  btnDanger: btn("#f87171", "rgba(248,113,113,0.09)", "rgba(248,113,113,0.22)"),
  btnReply: btn("#a78bfa", "rgba(167,139,250,0.09)", "rgba(167,139,250,0.25)"),
  btnSend: btn("#4ade80", "rgba(74,222,128,0.12)", "rgba(74,222,128,0.3)"),
  replyBox: { marginTop: "0.7rem", display: "flex", flexDirection: "column", gap: "0.5rem" },
  textarea: {
    width: "100%", boxSizing: "border-box", background: "var(--bg-1)",
    border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
    color: "var(--text-primary)", fontSize: "0.85rem", padding: "0.6rem 0.8rem",
    fontFamily: "var(--font-body)", resize: "vertical",
  },
};

function btn(color, bg, border) {
  return {
    fontFamily: "var(--font-mono)", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.02em",
    padding: "0.34rem 0.7rem", borderRadius: "var(--radius-md)",
    background: bg, color, border: `1px solid ${border}`, cursor: "pointer",
    transition: "all 0.2s",
  };
}

export default AdminModeration;