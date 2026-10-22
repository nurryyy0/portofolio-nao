import { useState, useEffect } from "react";
import {
  CONTENT_FIELDS,
  DEFAULT_CONTENT,
  loadSiteContent,
  adminSaveSiteContent,
} from "../lib/content";

const GROUPS = [
  { key: "Home", title: "🏠 Halaman Home" },
  { key: "About", title: "🙋 Halaman About" },
];

/** Tab "Konten Situs": edit teks Home & About dari dashboard admin. */
function AdminContent() {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // {type:'ok'|'err', text}

  useEffect(() => {
    let cancelled = false;
    loadSiteContent().then((c) => {
      if (cancelled) return;
      const f = {};
      CONTENT_FIELDS.forEach(({ key }) => {
        f[key] = c[key] ?? DEFAULT_CONTENT[key] ?? "";
      });
      setForm(f);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const reset = () => {
    const f = {};
    CONTENT_FIELDS.forEach(({ key }) => { f[key] = DEFAULT_CONTENT[key] ?? ""; });
    setForm(f);
    setMsg(null);
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const entries = CONTENT_FIELDS.map(({ key }) => ({ key, value: form?.[key] ?? "" }));
    const { error } = await adminSaveSiteContent(entries);
    setSaving(false);
    if (error) {
      setMsg({ type: "err", text: error.message || "Gagal menyimpan konten." });
    } else {
      setMsg({ type: "ok", text: "✓ Konten berhasil disimpan — halaman publik sudah diperbarui." });
    }
  };

  if (loading) return <p style={X.muted}>Memuat konten…</p>;

  return (
    <div>
      {msg && (
        <p role="alert" style={msg.type === "ok" ? X.ok : X.error}>{msg.text}</p>
      )}

      {GROUPS.map((g) => (
        <div key={g.key} style={X.group}>
          <h3 style={X.groupTitle}>{g.title}</h3>
          {CONTENT_FIELDS.filter((f) => f.group === g.key).map((f) => (
            <div key={f.key} style={X.field}>
              <label style={X.label} htmlFor={`cf-${f.key}`}>{f.label}</label>
              {f.multiline ? (
                <textarea
                  id={`cf-${f.key}`}
                  rows={g.key === "About" ? 6 : 3}
                  style={X.textarea}
                  value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              ) : (
                <input
                  id={`cf-${f.key}`}
                  type="text"
                  style={X.input}
                  value={form[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      ))}

      <div style={X.actions}>
        <button type="button" style={X.btnGhost} onClick={reset} disabled={saving}>
          Reset ke default
        </button>
        <button type="button" className="btn-micro" style={X.btnPrimary} onClick={save} disabled={saving}>
          {saving ? "Menyimpan…" : "💾 Simpan Konten"}
        </button>
      </div>
    </div>
  );
}

const X = {
  muted: { fontSize: "0.95rem", color: "var(--text-secondary)" },
  ok: {
    fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "#4ade80",
    background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.25)",
    borderRadius: "var(--radius-md)", padding: "0.65rem 0.9rem", marginBottom: "1rem", lineHeight: 1.6,
  },
  error: {
    fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "#f87171",
    background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
    borderRadius: "var(--radius-md)", padding: "0.65rem 0.9rem", marginBottom: "1rem", lineHeight: 1.6,
  },
  group: {
    background: "var(--bg-0)", border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)", padding: "1.25rem 1.5rem", marginBottom: "1rem",
  },
  groupTitle: {
    fontFamily: "var(--font-display)", fontSize: "1.05rem", fontWeight: 700,
    color: "var(--text-bright)", marginBottom: "1rem",
  },
  field: { display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1rem" },
  label: {
    fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-secondary)",
    letterSpacing: "0.05em", textTransform: "uppercase",
  },
  input: {
    width: "100%", boxSizing: "border-box", background: "var(--bg-1)",
    border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
    color: "var(--text-bright)", fontSize: "0.9rem", padding: "0.65rem 0.95rem",
    fontFamily: "var(--font-body)",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    background: "var(--bg-1)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-bright)",
    fontSize: "0.9rem",
    padding: "0.65rem 0.95rem",
    fontFamily: "var(--font-body)",
    resize: "vertical",
    lineHeight: 1.7,
  },
  actions: { display: "flex", gap: "0.75rem", flexWrap: "wrap" },
  btnGhost: {
    background: "var(--bg-3)", color: "var(--text-secondary)",
    padding: "0.6rem 1.2rem", borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "0.95rem",
    border: "1px solid var(--border)", cursor: "pointer",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, var(--cyan), var(--purple))",
    color: "#080b12", padding: "0.6rem 1.4rem", borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-body)", fontWeight: 700, fontSize: "1rem",
    border: "none", cursor: "pointer",
  },
};

export default AdminContent;