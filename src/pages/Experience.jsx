import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useState, useRef, useEffect, cloneElement, useId, isValidElement } from "react";
import { storage, isSupabaseEnabled, uploadImage, resolveImageUrl } from "../lib/storage";
import { useAdmin } from "../lib/auth";
import { useModalA11y } from "../hooks/useModalA11y";

// Ubah dataURL hasil kompresi canvas menjadi Blob (untuk upload ke Storage).
function dataUrlToBlob(dataUrl) {
  const [head, body] = String(dataUrl).split(",");
  const mime = (head.match(/:(.*?);/) || [])[1] || "image/jpeg";
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = ["PKL", "Freelance", "Lomba", "Ekstrakurikuler", "Organisasi","Participation"];

const TYPE_CONFIG = {
  PKL:            { color: "#22d3ee", bg: "rgba(34,211,238,0.09)",  border: "rgba(34,211,238,0.22)" },
  Freelance:      { color: "#a78bfa", bg: "rgba(167,139,250,0.09)", border: "rgba(167,139,250,0.22)" },
  Lomba:          { color: "#db7407", bg: "rgba(251,191,36,0.09)",  border: "rgba(251,191,36,0.22)" },
  Ekstrakurikuler:{ color: "#4ade80", bg: "rgba(74,222,128,0.09)",  border: "rgba(74,222,128,0.22)" },
  Organisasi:     { color: "#ffa65c", bg: "rgba(251,146,60,0.09)",  border: "rgba(251,146,60,0.22)" },
  Participation:  { color: "#fe76f3", bg: "rgba(139,92,246,0.09)",  border: "rgba(139,92,246,0.22)" },
};

const CATEGORY_ICONS = {
  PKL: "🏢", Freelance: "💼", Lomba: "🏆",
  Ekstrakurikuler: "⚡", Ekskul: "⚡", Organisasi: "🏛️","Participation": "🎫",
};

const EMPTY_FORM = {
  category: "", title: "", institution: "",
  startDate: "", description: "",
  link: "", tags: [], highlights: [],
  image: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatPeriod(startDate) {
  if (!startDate) return "";
  if (!startDate.includes("-")) return startDate;
  
  const fmt = (d) => {
    const [y, m] = d.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(m, 10) - 1]} ${y}`;
  };
  return `${fmt(startDate)}`;
}

function validate(form) {
  const errors = {};
  if (!form.category)          errors.category    = "Wajib diisi";
  if (!form.title.trim())      errors.title       = "Wajib diisi";
  if (!form.institution.trim()) errors.institution = "Wajib diisi";
  if (!form.startDate)         errors.startDate   = "Wajib diisi";
  if (!form.description.trim()) errors.description = "Wajib diisi";
  return errors;
}

// ─── Initial data ────────────────────────────────────────────────────────────

const INITIAL_EXPERIENCES = [
  {
    id: uid(), category: "Lomba",
    title: "LKS Broadcasting",
    institution: "LKS Kabupaten Purbalingga",
    startDate: "2026",
    description: "Mengikuti Lomba Kompetensi Siswa (LKS) sebagai sarana untuk mengembangkan keterampilan, menambah pengalaman, dan mengasah kemampuan di bidang keahlian yang dipelajari.",
    link: "", image: "lks.jpeg",
  },
  {
    id: uid(), category: "Organisasi",
    title: "Ketua IPPNU Ranting Desa Kalitinggar Kidul",
    institution: "Desa Kalitingar Kidul",
    startDate: "2022", 
    description: "Menjabat sebagai Ketua IPPNU Desa Kalikid dan bertanggung jawab dalam mengoordinasikan kegiatan organisasi, memimpin anggota, serta mengembangkan program yang bermanfaat bagi pelajar dan masyarakat.",
    link: "", image: "ipp.jpeg",
  },
  {
    id: uid(), category: "Ekstrakurikuler",
    title: "Anggota Pramuka",
    institution: "SMKN 1 Purbalingga",
    startDate: "2025",
    description: "Aktif mengikuti kegiatan kepramukaan yang berfokus pada pengembangan karakter, kedisiplinan, kerja sama tim, serta keterampilan kepemimpinan. ",
    link: "", image: "sankar.jpeg",
  },
  {
    id: uid(), category: "Ekstrakurikuler",
    title: "Tim Putri Basket SMEGA",
    institution: "SMKN 1 Purbalingga",
    startDate: "2025",
    description: "Menjadi bagian dari tim basket putri SMK N 1 Purbalingga dan berpartisipasi dalam latihan serta berbagai kegiatan dan kompetisi olahraga sekolah.",
    link: "", image: "basket.jpeg",
  },
  {
    id: uid(), category: "Lomba",
    title: "Film Pendek FLS3N 2026",
    institution: "FLS3N Kabupaten Purbalingga",
    startDate: "2026",
    description: "Terpilih sebagai bagian dari tim inti FLS3N sekolah dan berkontribusi dalam persiapan serta pelaksanaan lomba untuk mewakili sekolah. ",
    link: "", image: "fls.jpeg",
  },
  {
    id: uid(), category: "Organisasi",
    title: "Sekretaris Posyandu Remaja Tunas Harapan",
    institution: "Desa Kalitingar Kidul",
    startDate: "2026", 
    description: "Menjabat sebagai Sekretaris Posyandu Remaja Kalkid dengan tugas membantu administrasi, pencatatan kegiatan, penyusunan laporan, serta mendukung kelancaran program dan kegiatan remaja. ",
    link: "", image: "posyn.jpeg",
  },
];

// ─── Components ──────────────────────────────────────────────────────────────

function Field({ label, error, children, fullWidth }) {
  const id = useId();
  return (
    <div style={{ ...S.field, gridColumn: fullWidth ? "1 / -1" : "auto" }}>
      <label style={S.label} htmlFor={id}>{label}</label>
      {/* cloneElement hanya untuk anak tunggal; anak jamak (mis. area
          upload + tombol hapus) dirender apa adanya agar tidak crash. */}
      {isValidElement(children) ? cloneElement(children, { id }) : children}
      {error && <span role="alert" style={S.fieldError}>{error}</span>}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  const dialogRef = useModalA11y(true, onClose);

  // Kunci scroll halaman selama modal terbuka.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <>
      <div style={S.backdrop} onClick={onClose} />
      <div ref={dialogRef} style={S.modal} role="dialog" aria-modal="true" className="modal-animate-fixed">
        <div style={S.modalHeader}>
          <h2 style={S.modalTitle}>{title}</h2>
          <button style={S.closeBtn} onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        <div style={S.modalBody}>{children}</div>
      </div>
    </>
  );
}

function ConfirmDialog({ experience, onConfirm, onCancel }) {
  const dialogRef = useModalA11y(true, onCancel);

  return (
    <>
      <div style={S.backdrop} onClick={onCancel} />
      <div ref={dialogRef} style={S.confirmBox} role="alertdialog" aria-modal="true" className="modal-animate-fixed">
        <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🗑️</div>
        <h3 style={S.confirmTitle}>Hapus Experience?</h3>
        <p style={S.confirmText}>
          <strong style={{ color: "var(--text-bright)" }}>{experience.title}</strong> di{" "}
          <strong style={{ color: "var(--text-bright)" }}>{experience.institution}</strong> akan dihapus permanen.
        </p>
        <div style={S.confirmActions}>
          <button style={S.btnSecondary} onClick={onCancel}>Batal</button>
          <button style={S.btnDanger} onClick={onConfirm}>Ya, Hapus</button>
        </div>
      </div>
    </>
  );
}

// ─── Experience Form ─────────────────────────────────────────────────────────

function ExperienceForm({ initial, onSubmit, onCancel, submitting }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState(initial?.image || null);
  const [tagsPreview, setTagsPreview] = useState(() =>
    Array.isArray(initial?.tags) ? initial.tags.join(", ") : ""
  );
  const [highlightsPreview, setHighlightsPreview] = useState(() =>
    Array.isArray(initial?.highlights) ? initial.highlights.join("\n") : ""
  );
  const fileRef = useRef();

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  };

  const handleTags = (e) => {
    const val = e.target.value;
    setTagsPreview(val);
    setForm((f) => ({ ...f, tags: val.split(",").map((t) => t.trim()).filter(Boolean) }));
    if (errors.tags) setErrors((e) => { const n = { ...e }; delete n.tags; return n; });
  };

  const handleHighlights = (e) => {
    const val = e.target.value;
    setHighlightsPreview(val);
    setForm((f) => ({ ...f, highlights: val.split("\n").map((h) => h.trim()).filter(Boolean) }));
    if (errors.highlights) setErrors((e) => { const n = { ...e }; delete n.highlights; return n; });
  };

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Reset input supaya file yang sama bisa dipilih lagi.
    if (fileRef.current) fileRef.current.value = "";
    // Kompres gambar (maks 800px) supaya ringan untuk Storage & localStorage.
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const img = new Image();
      img.onload = async () => {
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const scale = Math.min(MAX / width, MAX / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.8);
        setPreview(compressed);
        setForm((f) => ({ ...f, image: compressed }));

        // Mode Supabase: unggah ke Storage (path tersimpan, bukan base64 besar).
        // uploadImage menangani lazy-load client sendiri.
        if (isSupabaseEnabled) {
          try {
            const { path, error } = await uploadImage(dataUrlToBlob(compressed), "experiences");
            if (!error) {
              setPreview(path);
              setForm((f) => ({ ...f, image: path }));
              return;
            }
            console.warn("Upload storage gagal, pakai base64 lokal:", error);
          } catch (err) {
            console.warn("Upload storage gagal, pakai base64 lokal:", err);
          }
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    const errs = validate(form);
    if (form.link && !/^(https?:\/\/)/i.test(String(form.link).trim())) {
      errs.link = "Link harus diawali http(s)";
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSubmit(form);
  };

  const tc = form.category ? TYPE_CONFIG[form.category] : null;

  return (
    <div data-exp-form-grid="" style={S.formGrid}>
      {/* Kategori */}
      <Field label="Kategori *" error={errors.category} fullWidth>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <select
            style={{ ...S.input, ...(tc ? { borderColor: tc.border, color: tc.color } : {}) }}
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
          >
            <option value="">Pilih kategori…</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {tc && (
            <span style={{ ...S.categoryPreview, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
              {CATEGORY_ICONS[form.category]} {form.category}
            </span>
          )}
        </div>
      </Field>

      {/* Judul & Instansi sejajar */}
      <Field label="Judul / Posisi *" error={errors.title}>
        <input style={S.input} type="text" placeholder="Frontend Developer Intern"
          value={form.title} onChange={(e) => set("title", e.target.value)} />
      </Field>

      <Field label="Instansi / Penyelenggara *" error={errors.institution}>
        <input style={S.input} type="text" placeholder="PT. Contoh Perusahaan"
          value={form.institution} onChange={(e) => set("institution", e.target.value)} />
      </Field>

      {/* Periode */}
      <Field label="Tahun *" error={errors.startDate} fullWidth>
        <input style={S.input} type="number" placeholder="2024" value={form.startDate}
          onChange={(e) => set("startDate", e.target.value)} />
      </Field>

      {/* Deskripsi */}
      <Field label="Deskripsi *" error={errors.description} fullWidth>
        <textarea style={{ ...S.input, ...S.textarea }}
          placeholder="Ceritakan pengalaman dan pencapaian kamu…"
          value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} />
      </Field>

      {/* Link (opsional) — untuk tombol "Lihat Detail" */}
      <Field label="Link (opsional)" error={errors.link} fullWidth>
        <input style={S.input} type="url" placeholder="https://… (muncul sebagai tombol Lihat Detail)"
          value={form.link || ""} onChange={(e) => set("link", e.target.value)} />
      </Field>

      {/* Tags (opsional) */}
      <Field label="Tags (opsional, pisahkan dengan koma)" error={errors.tags} fullWidth>
        <input style={S.input} type="text" placeholder="Python, Streamlit, Sertifikat"
          value={tagsPreview} onChange={handleTags} />
      </Field>

      {/* Highlights (opsional) */}
      <Field label="Highlight (opsional, satu per baris)" error={errors.highlights} fullWidth>
        <textarea style={{ ...S.input, ...S.textarea }} rows={2}
          placeholder={"Juara 1 Lomba …\nBerhasil deploy aplikasi"}
          value={highlightsPreview} onChange={handleHighlights} />
      </Field>

      {/* Image */}
      <Field label="Gambar / Sertifikat (opsional)" fullWidth>
        <div style={S.uploadArea} onClick={() => fileRef.current?.click()}>
          {preview ? (
            <img src={resolveImageUrl(preview)} alt="preview" style={S.imagePreview} />
          ) : (
            <div style={S.uploadPlaceholder}>
              <span style={{ fontSize: "1.4rem" }}>📎</span>
              <span style={{ fontSize: "0.95rem", color: "var(--text-secondary)" }}>Klik untuk upload gambar</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-secondary)" }}>JPG, PNG, WEBP</span>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImage} />
        </div>
        {preview && (
          <button style={S.removeImageBtn} onClick={() => { setPreview(null); set("image", null); }}>
            ✕ Hapus Gambar
          </button>
        )}
      </Field>

      {/* Actions */}
      <div style={{ ...S.formActions, gridColumn: "1 / -1" }}>
        <button style={S.btnSecondary} onClick={onCancel} disabled={submitting}>Batal</button>
        <button className="btn-micro" style={S.ctaBtn} onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function Experience() {
  // Hak akses: CRUD HANYA untuk admin — public murni read-only.
  // Keamanan sesungguhnya ada di RLS Supabase; ini hanya menyembunyikan UI,
  // sehingga publik TIDAK PERNAH melihat tombol Add/Edit/Delete (di mode
  // manapun — termasuk fallback dev tanpa Supabase).
  const { isAdmin } = useAdmin();
  const canWrite = isAdmin;

  // State awal dibaca sync dari localStorage (mode fallback cepat),
  // lalu Supabase (kalau aktif) menimpa secara async saat load selesai.
  const [experiences, setExperiences] = useState(() => {
    try {
      const raw = localStorage.getItem("portfolio_experiences2");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed;
        }
      }
    } catch { /* ignore */ }
    return INITIAL_EXPERIENCES;
  });
  const [loaded, setLoaded] = useState(false);
  const dirtyRef = useRef(false);
  const [timelineGrown, setTimelineGrown] = useState(false);
  const timelineRef = useRef(null);
  // Pesan error saat simpan/ubah/hapus gagal di database (mis. izin RLS).
  const [saveError, setSaveError] = useState(null);

  // Persist ke storage (Supabase kalau aktif, fallback localStorage).
  // Hanya ditulis kalau boleh menulis (admin).
  useEffect(() => {
    if (!loaded || !canWrite) return;
    storage.saveExperiences(experiences).then((ok) => {
      if (ok) {
        setSaveError(null);
      } else {
        setSaveError(
          "Perubahan TIDAK tersimpan ke database. Cek koneksi Supabase dan izin RLS (lihat konsol browser untuk detail)."
        );
      }
    });
  }, [experiences, loaded, canWrite]);

  // Load dari Supabase kalau aktif (menimpa state sekali)
  useEffect(() => {
    let cancelled = false;
    storage.loadExperiences(INITIAL_EXPERIENCES).then((list) => {
      if (!cancelled && !dirtyRef.current && Array.isArray(list)) {
        setExperiences(list);
      }
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Timeline grow on scroll
  useEffect(() => {
    if (!timelineRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimelineGrown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(timelineRef.current);
    return () => observer.disconnect();
  }, []);
  
  const [modal, setModal]     = useState(null); // null | "add" | "edit"
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // sort newest first
  const sorted = [...experiences].sort((a, b) =>
    (b.startDate || "").localeCompare(a.startDate || "")
  );

  const openAdd  = () => { setEditing(null); setModal("add"); };
  const openEdit = (exp) => { setEditing(exp); setModal("edit"); };
  const closeModal = () => { setModal(null); setEditing(null); };

  const handleAdd = (form) => {
    dirtyRef.current = true;
    setSubmitting(true);
    setTimeout(() => {
      setExperiences((prev) => [{ ...form, id: uid() }, ...prev]);
      setSubmitting(false);
      closeModal();
    }, 300);
  };

  const handleEdit = (form) => {
    dirtyRef.current = true;
    setSubmitting(true);
    setTimeout(() => {
      setExperiences((prev) =>
        prev.map((e) => e.id === editing.id
          ? { ...e, ...form }
          : e
        )
      );
      setSubmitting(false);
      closeModal();
    }, 300);
  };

  const handleDelete = () => {
    dirtyRef.current = true;
    setExperiences((prev) => prev.filter((e) => e.id !== toDelete.id));
    setToDelete(null);
  };

  // Stats for the bar
  const freelanceCount = experiences.filter((e) => e.category === "Freelance").length;
  const stats = [
    { num: experiences.filter(e => e.category === "PKL").length.toString(),       label: "PKL",           color: TYPE_CONFIG.PKL.color },
    { num: freelanceCount ? freelanceCount + "+" : "0",                            label: "Freelance Projects", color: TYPE_CONFIG.Freelance.color },
    { num: experiences.filter(e => e.category === "Lomba").length.toString(),     label: "Competition",   color: TYPE_CONFIG.Lomba.color },
    { num: experiences.filter(e => e.category === "Ekstrakurikuler").length.toString(),     label: "Extracurricular",   color: TYPE_CONFIG.Ekstrakurikuler.color },
    { num: experiences.filter(e => e.category === "Organisasi").length.toString(),     label: "Organisasi",   color: TYPE_CONFIG.Organisasi.color },
    { num: experiences.filter(e => e.category === "Participation").length.toString(),     label: "Participation",   color: TYPE_CONFIG.Participation.color },
  ];

  return (
    <div style={{ background: "var(--bg-0)", minHeight: "100vh", position: "relative", overflowX: "hidden" }}>
      <Navbar />
        <div style={S.glowCyan} />
        <div style={S.glowPurple} />

      <div style={{ paddingTop: "calc(var(--nav-h, 72px) + clamp(1.5rem, 5vw, 3rem))", paddingBottom: "0.5rem" }}>
        <div className="container">

          {/* ── Header ── */}
          <div className="animate-fadeUp" style={{ marginBottom: "4rem" }}>
            <span className="section-label">Experience</span>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1.5rem" }}>
              <div>
                <h1 style={S.title}>Pengalaman & Pencapaian</h1>
                <p style={S.subtitle}>
                  Berbagai kegiatan, proyek, dan pengalaman yang telah saya ikuti sebagai bagian dari proses belajar dan pengembangan diri.
                </p>
              </div>
              {/* Tombol Tambah — hanya tampil untuk admin */}
              {canWrite && (
                <button className="btn-micro" style={S.ctaBtn} onClick={openAdd}>+ Tambah</button>
              )}
            </div>
            {saveError && <p style={S.saveError}>{saveError}</p>}
          </div>

          {/* ── Stats bar ── */}
          <div className="animate-fadeUp animate-delay-1 exp-stats-bar" style={S.statsBar}>
            {stats.map((stat) => (
              <div key={stat.label} style={S.statItem}>
                <span style={{ ...S.statNum, color: stat.color }}>{stat.num}</span>
                <span style={S.statLabel}>{stat.label}</span>
              </div>
            ))}
          </div>

          {/* ── Timeline Grid ── */}
          <div ref={timelineRef} style={{ position: "relative" }}>
            {/* Timeline line */}
            <div className={`timeline-line ${timelineGrown ? "grown" : ""}`} aria-hidden="true" />

            <div className="exp-timeline-grid" style={S.gridContainer}>
              {sorted.map((exp, i) => {
                const tc = TYPE_CONFIG[exp.category] || TYPE_CONFIG.PKL;
                const icon = CATEGORY_ICONS[exp.category] || "📌";
                return (
                  <div
                    key={exp.id}
                    data-reveal
                    data-reveal-delay={String((i % 4) + 1)}
                    style={S.itemWrapper}
                  >
                    {/* Timeline dot */}
                    <div className="exp-timeline-dot" style={S.timelineDotWrap} aria-hidden="true">
                      <div style={{ ...S.timelineDot, background: tc.color, boxShadow: `0 0 8px ${tc.color}40` }} />
                    </div>

                    {/* Card */}
                    <div style={{ ...S.card, borderColor: "var(--border)" }} className="exp-card-stagger">

                      {/* Card header */}
                      <div style={S.cardHeader}>
                        <div style={{ ...S.iconWrap, borderColor: tc.border, background: tc.bg }}>
                          <span style={S.icon}>{icon}</span>
                        </div>
                        <div style={S.headerMeta}>
                          <div style={S.headerTop}>
                            <span style={{ ...S.typeBadge, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                              {exp.category}
                            </span>
                            <span style={S.period}>{formatPeriod(exp.startDate)}</span>
                          </div>
                          <h3 style={S.role}>{exp.title}</h3>
                          <p style={S.company}>{exp.institution}</p>
                        </div>
                      </div>

                      <div className="divider" style={{ margin: "1rem 0" }} />

                      {/* Thumbnail */}
                      {exp.image && (
                        <div style={{ marginBottom: "0.85rem", borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border)" }}>
                          <img src={resolveImageUrl(exp.image)} alt="sertifikat" loading="lazy" decoding="async" style={{ width: "100%", maxHeight: "160px", objectFit: "cover", display: "block" }} />
                        </div>
                      )}

                      {/* Description */}
                      <p style={S.desc}>{exp.description}</p>

                      {/* Highlights */}
                      {exp.highlights?.length > 0 && (
                        <div style={S.highlights}>
                          {exp.highlights.map((h) => (
                            <div key={h} style={S.highlightItem}>
                              <span style={{ ...S.highlightDot, background: tc.color }} />
                              <span style={S.highlightText}>{h}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Tags */}
                      {exp.tags?.length > 0 && (
                        <div style={S.tagRow}>
                          {exp.tags.map((t) => <span key={t} className="tag tag-interactive">{t}</span>)}
                        </div>
                      )}

                      {/* ── Card footer: link + Edit/Hapus (admin saja) ── */}
                      <div style={S.cardFooter}>
                        {exp.link ? (
                          <a href={exp.link} className="btn-micro" target="_blank" rel="noopener noreferrer" style={S.btnLink}>
                            Lihat Detail ↗
                          </a>
                        ) : <span />}
                        {canWrite && (
                          <div style={{ display: "flex", gap: "0.4rem" }}>
                            <button className="btn-micro" style={S.btnEdit} onClick={() => openEdit(exp)}>✏️ Edit</button>
                            <button className="btn-micro" style={S.btnDangerSm} onClick={() => setToDelete(exp)}>🗑️ Hapus</button>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      <Footer />

      {/* ── Add Modal ── */}
      {modal === "add" && (
        <Modal title="Tambah Experience" onClose={closeModal}>
          <ExperienceForm initial={EMPTY_FORM} onSubmit={handleAdd} onCancel={closeModal} submitting={submitting} />
        </Modal>
      )}

      {/* ── Edit Modal ── */}
      {modal === "edit" && editing && (
        <Modal title="Edit Experience" onClose={closeModal}>
          <ExperienceForm initial={editing} onSubmit={handleEdit} onCancel={closeModal} submitting={submitting} />
        </Modal>
      )}

      {/* ── Delete Confirm ── */}
      {toDelete && (
        <ConfirmDialog
          experience={toDelete}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}

      <style>{`
        .exp-card-stagger:hover {
          border-color: var(--border-hover) !important;
          transform: translateY(-4px);
          box-shadow: var(--shadow-md);
          transition: all 0.3s ease;
        }
        select option { background: var(--bg-1); color: var(--text-bright); }
        @media (max-width: 640px) {
          .timeline-line { left: 6px !important; }
          .exp-timeline-dot { left: -19px !important; }
          .exp-timeline-grid { margin-left: 26px !important; }
        }
        /* Stats bar: jumlah kolom naik seiring lebar layar. */
        @media (min-width: 768px) {
          .exp-stats-bar { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        @media (min-width: 1024px) {
          .exp-stats-bar { grid-template-columns: repeat(6, minmax(0, 1fr)) !important; }
          .exp-stats-bar > * { borderBottom: none !important; }
        }
        /* Form modal: 1 kolom di layar sempit (sebelumnya selalu 1fr 1fr). */
        @media (max-width: 640px) {
          [data-exp-form-grid] { grid-template-columns: minmax(0, 1fr) !important; }
        }
        .exp-stats-bar > *:last-child { borderRight: none !important; }
      `}</style>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  title: {
    fontSize: "clamp(2.2rem, 5vw, 3.8rem)",
    fontWeight: 900,
    letterSpacing: "-0.035em",
    color: "var(--text-bright)",
    marginBottom: "0.75rem",
    marginTop: "0.5rem",
    fontFamily: "var(--font-display)",
  },
  subtitle: {
    fontSize: "1rem",
    color: "var(--text-secondary)",
    maxWidth: "520px",
    lineHeight: 1.7,
  },
  
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
  statsBar: {
    display: "grid",
    /* 6 statistik: 2 kolom di HP, 3 di tablet, 6 sejajar sejak 1024px.
       Sebelumnya flex 6-item tanpa wrap → tiap kolom cuma ~50px di 320px. */
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 0,
    marginBottom: "3.5rem",
    background: "var(--bg-1)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
  },
  statItem: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "1.25rem 0.75rem",
    borderRight: "1px solid var(--border)",
    borderBottom: "1px solid var(--border)",
    gap: "4px",
    transition: "background 0.2s ease",
  },
  statNum: {
    fontFamily: "var(--font-display)",
    fontWeight: 900,
    fontSize: "1.8rem",
    letterSpacing: "-0.04em",
    lineHeight: 1,
  },
  statLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.8rem",
    color: "var(--text-secondary)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    textAlign: "center",
  },
  
  gridContainer: {
    display: "grid",
    /* min(320px, 100%) → kolom tidak pernah melebihi lebar container,
       sehingga tidak ada overflow horizontal di HP 320px. */
    gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
    gap: "1.5rem",
    marginBottom: "4rem",
    marginLeft: "36px", // space for timeline dots
  },
  itemWrapper: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    position: "relative",
  },
  timelineDotWrap: {
    position: "absolute",
    left: "-30px",
    top: "24px",
    zIndex: 2,
  },
  timelineDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    border: "2px solid var(--bg-0)",
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
  },
  card: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "1.5rem",
    transition: "border-color 0.3s, transform 0.3s, box-shadow 0.3s",
  },
  cardHeader: {
    display: "flex",
    gap: "clamp(0.6rem, 3vw, 1rem)",
    alignItems: "flex-start",
    minWidth: 0,
  },
  iconWrap: {
    width: "44px",
    height: "44px",
    borderRadius: "12px",
    border: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.2rem",
    flexShrink: 0,
    transition: "transform 0.2s ease",
  },
  icon: { fontSize: "1.2rem" },
  headerMeta: { flex: 1, minWidth: 0, overflowWrap: "anywhere" },
  headerTop: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    marginBottom: "0.4rem",
    flexWrap: "wrap",
  },
  typeBadge: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    fontWeight: 700,
    padding: "0.18rem 0.65rem",
    borderRadius: "100px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  period: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.85rem",
    color: "var(--text-secondary)",
    letterSpacing: "0.03em",
  },
  role: {
    fontFamily: "var(--font-display)",
    fontSize: "1.08rem",
    fontWeight: 700,
    color: "var(--text-bright)",
    letterSpacing: "-0.02em",
    marginBottom: "2px",
  },
  company: {
    fontSize: "0.82rem",
    color: "var(--text-secondary)",
  },
  desc: {
    fontSize: "0.9rem",
    color: "var(--text-secondary)",
    lineHeight: 1.7,
    marginBottom: "1rem",
    overflowWrap: "anywhere",
  },
  highlights: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
    marginBottom: "1rem",
  },
  highlightItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  highlightDot: {
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  highlightText: {
    fontSize: "0.82rem",
    color: "var(--text-secondary)",
  },
  tagRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.35rem",
    marginBottom: "1rem",
  },
  cardFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.5rem",
    flexWrap: "wrap",
    paddingTop: "0.85rem",
    borderTop: "1px solid var(--border)",
    marginTop: "auto",
  },
  ctaBtn: {
    display: "inline-flex",
    alignItems: "center",
    background: "linear-gradient(135deg, var(--cyan), var(--purple))",
    color: "#080b12",
    padding: "0.75rem 1.75rem",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    fontSize: "1rem",
    textDecoration: "none",
    border: "none",
    cursor: "pointer",
  },
  saveError: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.85rem",
    color: "#f87171",
    background: "rgba(248,113,113,0.08)",
    border: "1px solid rgba(248,113,113,0.25)",
    borderRadius: "var(--radius-md)",
    padding: "0.7rem 1rem",
    marginTop: "1rem",
    maxWidth: "640px",
    lineHeight: 1.6,
  },

  // Buttons CRUD
  btnEdit: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.8rem",
    fontWeight: 700,
    padding: "0.32rem 0.7rem",
    borderRadius: "var(--radius-md)",
    background: "rgba(167,139,250,0.1)",
    color: "#a78bfa",
    border: "1px solid rgba(167,139,250,0.25)",
    cursor: "pointer",
    letterSpacing: "0.03em",
  },
  btnDangerSm: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.8rem",
    fontWeight: 700,
    padding: "0.32rem 0.7rem",
    borderRadius: "var(--radius-md)",
    background: "rgba(248,113,113,0.09)",
    color: "#f87171",
    border: "1px solid rgba(248,113,113,0.22)",
    cursor: "pointer",
    letterSpacing: "0.03em",
  },
  btnLink: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.8rem",
    fontWeight: 700,
    padding: "0.32rem 0.7rem",
    borderRadius: "var(--radius-md)",
    background: "rgba(34,211,238,0.09)",
    color: "var(--cyan)",
    border: "1px solid rgba(34,211,238,0.22)",
    cursor: "pointer",
    letterSpacing: "0.03em",
    textDecoration: "none",
  },
  btnSecondary: {
    display: "inline-flex",
    alignItems: "center",
    background: "var(--bg-3)",
    color: "var(--text-secondary)",
    padding: "0.6rem 1.2rem",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "1rem",
    border: "1px solid var(--border)",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  btnDanger: {
    display: "inline-flex",
    alignItems: "center",
    background: "rgba(248,113,113,0.12)",
    color: "#f87171",
    padding: "0.6rem 1.2rem",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    fontSize: "0.88rem",
    border: "1px solid rgba(248,113,113,0.3)",
    cursor: "pointer",
    transition: "all 0.2s",
  },

  // Modal
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(4,7,14,0.75)",
    backdropFilter: "blur(4px)",
    zIndex: 40,
    animation: "fadeIn 0.2s ease both",
  },
  modal: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    width: "min(680px, 94vw)",
    maxHeight: "min(90vh, 90dvh)",
    overflowY: "auto",
    background: "var(--bg-1)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-xl)",
    zIndex: 50,
    boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1.25rem clamp(1rem, 5vw, 1.75rem) 1rem",
    borderBottom: "1px solid var(--border)",
    position: "sticky",
    top: 0,
    background: "var(--bg-1)",
    zIndex: 1,
  },
  modalTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "1.2rem",
    fontWeight: 800,
    color: "var(--text-bright)",
    letterSpacing: "-0.025em",
  },
  closeBtn: {
    background: "none",
    border: "1px solid var(--border)",
    color: "var(--text-secondary)",
    borderRadius: "8px",
    width: "32px",
    height: "32px",
    cursor: "pointer",
    fontSize: "0.85rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
  },
  modalBody: {
    padding: "1.25rem clamp(1rem, 5vw, 1.75rem) 1.5rem",
  },

  // Confirm
  confirmBox: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    width: "min(380px, 92vw)",
    maxHeight: "min(90vh, 90dvh)",
    overflowY: "auto",
    background: "var(--bg-1)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-xl)",
    padding: "clamp(1.25rem, 5vw, 2rem)",
    zIndex: 50,
    boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
    textAlign: "center",
  },
  confirmTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "1.15rem",
    fontWeight: 800,
    color: "var(--text-bright)",
    marginBottom: "0.5rem",
  },
  confirmText: {
    fontSize: "0.86rem",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
    marginBottom: "1.5rem",
  },
  confirmActions: {
    display: "flex",
    gap: "0.75rem",
    justifyContent: "center",
  },

  // Form
  formGrid: {
    display: "grid",
    /* 2 kolom di layar lebar; 1 kolom di HP lewat [data-exp-form-grid]
       yang di-override di blok <style> halaman ini. */
    gridTemplateColumns: "1fr 1fr",
    gap: "clamp(0.85rem, 3vw, 1.1rem)",
    minWidth: 0,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },
  label: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.8rem",
    color: "var(--text-secondary)",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  fieldError: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.8rem",
    color: "#f87171",
  },
  input: {
    width: "100%",
    background: "var(--bg-0)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-bright)",
    fontSize: "1rem",
    padding: "0.6rem 0.9rem",
    fontFamily: "var(--font-body)",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box",
    appearance: "none",
    WebkitAppearance: "none",
  },
  textarea: {
    resize: "vertical",
    minHeight: "96px",
    lineHeight: 1.6,
  },
  categoryPreview: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    fontWeight: 700,
    padding: "0.4rem 0.65rem",
    borderRadius: "100px",
    letterSpacing: "0.08em",
    whiteSpace: "nowrap",
  },
  uploadArea: {
    border: "1px dashed var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "1rem",
    cursor: "pointer",
    overflow: "hidden",
    transition: "border-color 0.2s ease",
  },
  uploadPlaceholder: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.3rem",
    padding: "1rem 0",
  },
  imagePreview: {
    width: "100%",
    maxHeight: "180px",
    objectFit: "cover",
    borderRadius: "calc(var(--radius-md) - 2px)",
    display: "block",
  },
  removeImageBtn: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.8rem",
    color: "#f87171",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "0.2rem 0",
    marginTop: "0.25rem",
  },
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
    paddingTop: "0.5rem",
    borderTop: "1px solid var(--border)",
    marginTop: "0.25rem",
  },
};

export default Experience;
