import { useState, useEffect, useCallback, useRef, cloneElement, useId, isValidElement } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
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

// ─── CRUD helpers ─────────────────────────────────────────────
const EMPTY_FORM = {
  title: "",
  shortDesc: "",
  desc: "",
  category: "",
  year: "",
  tags: [],
  thumb: null,
  links: { github: "", live: "" },
  featured: false,
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function normalizeProject(p) {
  return {
    ...p,
    tags: Array.isArray(p.tags) ? p.tags : [],
    links: { github: "#", live: "", ...(p.links || {}) },
    featured: p.featured === true,
  };
}

// ─── Project data ────────────────────────────────────────────────
const PROJECTS = [
  {
    id: 1,
    title: "SmartLand Project",
    shortDesc: "Aplikasi berbasis Streamlit yang dirancang untuk memprediksi tingkat kesuburan tanah menggunakan algoritma Machine Learning",
    desc: "Sistem cerdas untuk menentukan tingkat kesuburan menjadi Kurang Subur, Cukup Subur, atau Sangat Subur, berdasarkan berbagai parameter kimia tanah secara cepat, praktis, dan mudah digunakan. ",
    thumb: "smartland.png",
    tags: ["Python","Streamlit"],
    category: "App",
    year: "2026",
    links: { github: "https://github.com/nurryyy0/Project-Akhir" },
  },
  {
    id: 2,
    title: "Poertofolio Web",
    shortDesc: "Web Portofolio Nurry Nurul Naomi",
    desc: "Web Portofolio pertama saya sebagai siswa SMK, yang dibangun dengan React dan Vite untuk menciptakan web yang interaktif dan responsif.",
    thumb: "porto.png",
    tags: ["React", "Node.js", "Vite"],
    category: "Web",
    year: "2026",
    links: { github: "#", live: "" },
  },
  {
    id: 3,
    title: "The Noyescape",
    shortDesc: "Game platformer 2D pixel art bertema petualangan luar angkasa.",
    desc: "NoyeScape adalah game platformer 2D pixel art yang mengikuti petualangan Noye, seorang astronot muda yang harus melewati berbagai rintangan dan mengumpulkan item untuk mencapai portal dan menyelesaikan setiap level.",
    thumb: "noyescape.jpeg",
    tags: ["Turbowarp"],
    category: "Game",
    year: "2025",
    links: {github: "https://github.com/nurryyy0/Game-The-Noyescape" },
  },
  {
    id: 4,
    title: "SuperStar",
    shortDesc: "Game lompat-lompatan ala platformer klasik.",
    desc: "Game platformer 2D yang mengajak pemain mengendalikan seekor kucing lincah untuk melompati rintangan, mengumpulkan koin, dan mencapai target.",
    thumb: "superstar.png",
    tags: ["scratch"],
    category: "Game",
    year: "2024",
    links: { github: "https://github.com/nurryyy0/SuperStar-Game-2024" },
  },
  {
    id: 5,
    title: "Web Wisata",
    shortDesc: "Membangun web antarmuka yang menonjolkan aspek visual pariwisata Jawa Timur",
    desc: " Proyek pengembangan front-end untuk membangun direktori wisata Jawa Timur. Fokus pada implementasi desain responsif, optimasi performa loading gambar",
    thumb: "webwisata.jpeg",
    tags: ["HTML","CSS","JavaScript"],
    category: "Web",
    year: "2025",
    links: { github: "https://github.com/nurryyy0/web-wisata-frontend" },
  },
  {
    id: 6,
    title: "Klasifikasi Kopi",
    shortDesc: "Menilai kualitas kopi lebih cepat dengan analisis berbasis data",
    desc: "Aplikasi ini dikembangkan menggunakan Streamlit dan Machine Learning untuk melakukan klasifikasi kualitas kopi berdasarkan karakteristik tertentu. Sistem memberikan hasil prediksi secara real-time lengkap dengan tingkat kepercayaan model terhadap hasil yang diberikan.",
    thumb: "klasskopi.png",
    tags: ["Python","Streamlit"],
    category: "App",
    year: "2025",
    links: { github: "https://github.com/nurryyy0/klasifikasi_kopi" },
  },
];

const CATEGORIES = ["All", "Web", "App", "Game", "Creative Projects"];

const CATEGORY_COLORS = {
  Web: { color: "var(--cyan)", bg: "var(--cyan-dim)", border: "var(--cyan-border)" },
  App: { color: "var(--purple)", bg: "var(--purple-dim)", border: "var(--purple-border)" },
  Game: { color: "#fb923c", bg: "rgba(251,146,60,0.1)", border: "rgba(251,146,60,0.2)" },
  "Creative Projects": { color: "#4ade80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.22)" },
  // Apelasi lama tanpa spasi — tetap didukung supaya data lama tidak jatuh ke warna default.
  CreativeProjects: { color: "#4ade80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.22)" },
};

// ─── CRUD Form Modal ──────────────────────────────────────────
function ProjectFormModal({ initial, onClose, onSubmit, submitting }) {
  const dialogRef = useModalA11y(true, onClose);
  const [form, setForm] = useState(() => {
    const base = {
      ...EMPTY_FORM,
      ...initial,
      tags: Array.isArray(initial.tags) ? [...initial.tags] : [],
      links: { github: "", live: "", ...(initial.links || {}) },
      featured: initial?.featured === true,
    };
    return base;
  });
  const [errors, setErrors] = useState({});
  const fileRef = useRef(null);

  // Kunci scroll halaman selama modal terbuka.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (errors[key]) setErrors((e) => { const n = { ...e }; delete n[key]; return n; });
  };

  const setLink = (key, val) => {
    setForm((f) => ({ ...f, links: { ...f.links, [key]: val } }));
    if (errors.links) setErrors((e) => { const n = { ...e }; delete n.links; return n; });
  };

  const handleTags = (e) => {
    const val = e.target.value;
    setTagsPreview(val);
    setForm((f) => ({
      ...f,
      tags: val.split(",").map((t) => t.trim()).filter(Boolean),
    }));
    if (errors.tags) setErrors((e) => { const n = { ...e }; delete n.tags; return n; });
  };

  const [tagsPreview, setTagsPreview] = useState(() =>
    (initial.tags || []).join(", ")
  );

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
        setForm((f) => ({ ...f, thumb: compressed }));

        // Mode Supabase: unggah ke Storage (path tersimpan, bukan base64 besar).
        // uploadImage menangani lazy-load client sendiri.
        if (isSupabaseEnabled) {
          try {
            const { path, error } = await uploadImage(dataUrlToBlob(compressed), "projects");
            if (!error) {
              setForm((f) => ({ ...f, thumb: path }));
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
    const errs = {};
    if (!form.title.trim()) errs.title = "Wajib diisi";
    if (!form.category) errs.category = "Wajib diisi";
    if (form.year && !/^\d{4}$/.test(String(form.year).trim())) errs.year = "Tahun harus 4 digit";
    if (
      form.links.github &&
      !/^(https?:\/\/|#)/i.test(form.links.github.trim())
    ) errs.links = "Link GitHub harus http(s) atau #";
    if (
      form.links.live &&
      !/^https?:\/\//i.test(form.links.live.trim())
    ) errs.links = "Link deploy harus diawali http(s)://";
    if (Object.keys(errs).length) { setErrors(errs); return; }
    onSubmit(form);
  };

  return (
    <>
      <div style={CRM.backdrop} onClick={onClose} />
      <div ref={dialogRef} style={{ ...CRM.modal, maxHeight: "min(90vh, 90dvh)", overflowY: "auto" }} role="dialog" aria-modal="true" className="modal-animate-fixed">
        <div style={CRM.modalHeader}>
          <h2 style={CRM.modalTitle}>{initial?.id ? "Edit Project" : "Tambah Project"}</h2>
          <button style={CRM.closeBtn} onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        <div style={CRM.modalBody}>
          <div data-form-grid="" style={CRM.formGrid}>
            <Field label="Judul Project *" error={errors.title} fullWidth>
              <input style={CRM.input} type="text" placeholder="Nama Project" value={form.title}
                onChange={(e) => set("title", e.target.value)} />
            </Field>

            <Field label="Kategori *" error={errors.category} fullWidth>
              <select style={CRM.input} value={form.category}
                onChange={(e) => set("category", e.target.value)}>
                <option value="">Pilih kategori…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>

            <Field label="Tahun" error={errors.year} fullWidth>
              <input style={CRM.input} type="text" placeholder="2026" value={form.year}
                onChange={(e) => set("year", e.target.value)} />
            </Field>

            <Field label="Teknologi / Tags (pisahkan dengan koma)" error={errors.tags} fullWidth>
              <input style={CRM.input} type="text" placeholder="React, Vite"
                value={tagsPreview} onChange={handleTags} />
            </Field>

            <Field label="Deskripsi Singkat *" error={errors.shortDesc} fullWidth>
              <textarea style={{ ...CRM.input, ...CRM.textarea }} rows={2}
                placeholder="Short description yang tampil di card…"
                value={form.shortDesc} onChange={(e) => set("shortDesc", e.target.value)} />
            </Field>

            <Field label="Deskripsi Lengkap *" error={errors.desc} fullWidth>
              <textarea style={{ ...CRM.input, ...CRM.textarea }} rows={4}
                placeholder="Deskripsi lengkap yang tampil di modal detail…"
                value={form.desc} onChange={(e) => set("desc", e.target.value)} />
            </Field>

            <div data-link-grid="" style={CRM.linkGrid}>
              <Field label="Link GitHub (opsional)" error={errors.links}>
                <input style={CRM.input} type="text" placeholder="https://github.com/..." value={form.links.github}
                  onChange={(e) => setLink("github", e.target.value)} />
              </Field>

              <Field label="Link Deploy / Live (opsional)" error={errors.links}>
                <input style={CRM.input} type="text" placeholder="https://my-app.vercel.app" value={form.links.live}
                  onChange={(e) => setLink("live", e.target.value)} />
              </Field>
            </div>

            {/* Pilihan manual: project ini tampil di section Featured Work (Home). */}
            <div style={{ ...CRM.field, gridColumn: "1 / -1" }}>
              <label style={CRM.checkRow}>
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => set("featured", e.target.checked)}
                  style={CRM.checkbox}
                />
                <span style={CRM.checkLabel}>
                  Tampilkan di Home
                  <span style={CRM.checkHint}>
                    Centang kalau project ini mau muncul di section &ldquo;Proyek Pilihan&rdquo; di halaman Home. Kalau tidak ada satu pun yang dicentang, Home menampilkan 3 project teratas secara otomatis.
                  </span>
                </span>
              </label>
            </div>

            <Field label="Gambar / Thumbnail (opsional)" fullWidth>
              <div style={CRM.uploadArea} onClick={() => fileRef.current?.click()}>
                {(form.thumb && typeof form.thumb === "string") ? (
                  <img src={resolveImageUrl(form.thumb)} alt="preview" style={CRM.imagePreview} />
                ) : (
                  <div style={CRM.uploadPlaceholder}>
                    <span style={{ fontSize: "1.4rem" }}>📎</span>
                    <span style={{ fontSize: "0.95rem", color: "var(--text-secondary)" }}>Klik untuk upload gambar</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--text-secondary)" }}>JPG, PNG, WEBP</span>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImage} />
              </div>
              {form.thumb && (
                <button style={CRM.removeImageBtn}
                  onClick={() => { setForm((f) => ({ ...f, thumb: null })); }}>
                  ✕ Hapus Gambar
                </button>
              )}
            </Field>

            <div style={{ ...CRM.formActions, gridColumn: "1 / -1" }}>
              <button style={CRM.btnSecondary} onClick={onClose} disabled={submitting}>Batal</button>
              <button className="btn-micro" style={CRM.ctaBtn} onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Menyimpan…" : (initial?.id ? "Simpan Perubahan" : "Tambah Project")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ConfirmDialog({ title, onConfirm, onCancel }) {
  const dialogRef = useModalA11y(true, onCancel);

  return (
    <>
      <div style={CRM.backdrop} onClick={onCancel} />
      <div ref={dialogRef} style={CRM.confirmBox} role="alertdialog" aria-modal="true" className="modal-animate-fixed">
        <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🗑️</div>
        <h3 style={CRM.confirmTitle}>Hapus Project?</h3>
        <p style={CRM.confirmText}>{title}</p>
        <div style={CRM.confirmActions}>
          <button style={CRM.btnSecondary} onClick={onCancel}>Batal</button>
          <button style={CRM.btnDanger} onClick={onConfirm}>Ya, Hapus</button>
        </div>
      </div>
    </>
  );
}

// ─── Small Field layout helper (for CRUD form only) ──────────
function Field({ label, error, children, fullWidth }) {
  const id = useId();
  return (
    <div style={{ ...CRM.field, gridColumn: fullWidth ? "1 / -1" : "auto" }}>
      <label style={CRM.label} htmlFor={id}>{label}</label>
      {/* cloneElement hanya untuk anak tunggal; anak jamak (mis. area
          upload + tombol hapus) dirender apa adanya agar tidak crash. */}
      {isValidElement(children) ? cloneElement(children, { id }) : children}
      {error && <span role="alert" style={CRM.fieldError}>{error}</span>}
    </div>
  );
}

// ─── Modal Component ─────────────────────────────────────────────
function ProjectModal({ project, onClose }) {
  const dialogRef = useModalA11y(Boolean(project), onClose);

  // Kunci scroll halaman selama modal terbuka.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!project) return null;
  const cc = CATEGORY_COLORS[project.category] || CATEGORY_COLORS.Web;

  return (
    <div style={MS.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        style={MS.modal}
        onClick={(e) => e.stopPropagation()}
        className="modal-animate-in"
        role="dialog"
        aria-modal="true"
        aria-label={project.title}
      >
        {/* Close */}
        <button onClick={onClose} style={MS.closeBtn} aria-label="Close">✕</button>

        {/* Thumbnail */}
        <div style={MS.thumbWrap}>
          <img
            src={resolveImageUrl(project.thumb)}
            alt={project.title}
            loading="lazy"
            decoding="async"
            style={MS.thumb}
          />
          <div style={MS.thumbOverlay} />
          {/* Category badge */}
          <span style={{ ...MS.catBadge, background: cc.bg, color: cc.color, border: `1px solid ${cc.border}` }}>
            {project.category}
          </span>
        </div>

        {/* Content */}
        <div style={MS.content}>
          <div style={MS.header}>
            <div>
              <p style={MS.year}>{project.year}</p>
              <h2 style={MS.title}>{project.title}</h2>
            </div>
            <div style={MS.actions}>
              {project.links?.live && project.links.live !== "#" && (
                <a href={project.links.live} className="btn-micro" style={MS.actionBtn} target="_blank" rel="noopener noreferrer">
                  Live Demo ↗
                </a>
              )}
              {project.links?.github && project.links.github !== "#" && (
                <a href={project.links.github} className="btn-micro" style={{ ...MS.actionBtn, ...MS.actionBtnGhost }} target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              )}
            </div>
          </div>

          <p style={MS.desc}>{project.desc}</p>

          <div style={MS.tagsRow}>
            {project.tags.map((t) => (
              <span key={t} className="tag tag-interactive">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────
function Project() {
  // Hak akses: CRUD HANYA untuk admin — public murni read-only.
  // Keamanan sesungguhnya ada di RLS Supabase; ini hanya menyembunyikan UI,
  // sehingga publik TIDAK PERNAH melihat tombol Add/Edit/Delete (di mode
  // manapun — termasuk fallback dev tanpa Supabase).
  const { isAdmin } = useAdmin();
  const canWrite = isAdmin;

  // State awal dibaca sync dari localStorage (mode fallback cepat),
  // lalu Supabase (kalau aktif) menimpa secara async saat load selesai.
  const [projects, setProjects] = useState(() => {
    try {
      const raw = localStorage.getItem("portfolio_projects_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed.map(normalizeProject);
        }
      }
    } catch { /* ignore */ }
    return PROJECTS.map(normalizeProject);
  });
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedProject, setSelectedProject] = useState(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [formModal, setFormModal] = useState(null); // null | "add" | editing-project
  const [toDelete, setToDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // Pesan error saat simpan/ubah/hapus gagal di database (mis. izin RLS).
  const [saveError, setSaveError] = useState(null);
  // Ref: true kalau user sudah add/edit/delete sebelum load selesai.
  // Kalau true, hasil load TIDAK menimpa state (hindari data hilang).
  const dirtyRef = useRef(false);

  // Persist ke storage (Supabase kalau aktif, fallback localStorage).
  // Hanya ditulis kalau boleh menulis (admin).
  useEffect(() => {
    if (!loaded || !canWrite) return;
    const prev = projects;
    storage.saveProjects(prev).then((ok) => {
      if (ok) {
        setSaveError(null);
      } else {
        setSaveError(
          "Perubahan TIDAK tersimpan ke database. Cek koneksi Supabase dan izin RLS (lihat konsol browser untuk detail)."
        );
      }
    });
  }, [projects, loaded, canWrite]);

  // Load dari Supabase kalau aktif (menimpa state sekali)
  useEffect(() => {
    let cancelled = false;
    storage.loadProjects(PROJECTS.map(normalizeProject)).then((list) => {
      if (!cancelled && !dirtyRef.current && Array.isArray(list)) {
        setProjects(list.map(normalizeProject));
      }
      if (!cancelled) setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = activeFilter === "All"
    ? projects
    : projects.filter((p) => p.category === activeFilter);

  const handleFilter = useCallback((cat) => {
    if (cat === activeFilter) return;
    setIsFiltering(true);
    // Brief delay for exit animation feel
    setTimeout(() => {
      setActiveFilter(cat);
      setIsFiltering(false);
    }, 50);
  }, [activeFilter]);

  const openAdd = () => { setFormModal({ project: null }); };
  const openEdit = (proj) => { setFormModal({ project: proj }); };
  const closeForm = () => { setFormModal(null); };

  const handleSave = (form) => {
    dirtyRef.current = true;
    setSubmitting(true);
    setTimeout(() => {
      setProjects((prev) => {
        if (formModal.project) {
          return prev.map((p) =>
            p.id === formModal.project.id ? { ...p, ...form } : p
          );
        }
        return [{ ...form, id: uid() }, ...prev];
      });
      // Jika project yang sedang dibuka di modal detail diedit,
      // perbarui juga tampilan detailnya agar ikut data terbaru.
      if (formModal.project && selectedProject?.id === formModal.project.id) {
        setSelectedProject({ ...formModal.project, ...form });
      }
      setSubmitting(false);
      closeForm();
    }, 300);
  };

  const handleDelete = () => {
    if (!toDelete) return;
    dirtyRef.current = true;
    setProjects((prev) => prev.filter((p) => p.id !== toDelete.id));
    if (selectedProject?.id === toDelete.id) setSelectedProject(null);
    setToDelete(null);
  };

  return (
    <div style={{ background: "var(--bg-0)", minHeight: "100vh" }}>
      <Navbar />

      <div style={{ paddingTop: "calc(var(--nav-h, 72px) + clamp(1.5rem, 5vw, 3rem))", paddingBottom: "2rem" }}>
        <div className="container">

          {/* Header */}
          <div className="animate-fadeUp" style={{ marginBottom: "3.5rem" }}>
            <span className="section-label">Projects</span>
            <h1 style={PS.title}>
              Projek <span style={PS.titleGradient}>Saya</span>
            </h1>
            <p style={PS.subtitle}>
              Kumpulan proyek yang telah saya kerjakan sebagai bentuk pembelajaran, eksplorasi, dan pengembangan keterampilan di berbagai bidang teknologi dan desain.
            </p>
            {/* CRUD: tombol tambah — hanya tampil untuk admin */}
            {canWrite && (
              <button className="btn-micro" style={PS.tambahBtn} onClick={openAdd}>
                + Tambah Project
              </button>
            )}
            {saveError && <p style={PS.saveError}>{saveError}</p>}
          </div>

          {/* Filter tabs */}
          <div className="animate-fadeUp animate-delay-1" style={PS.filterRow}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleFilter(cat)}
                className={activeFilter === cat ? "filter-tab-active" : ""}
                style={{
                  ...PS.filterBtn,
                  background: activeFilter === cat ? "var(--bg-3)" : "transparent",
                  color: activeFilter === cat ? "var(--text-bright)" : "var(--text-secondary)",
                  border: activeFilter === cat
                    ? "1px solid var(--border-hover)"
                    : "1px solid transparent",
                  transform: activeFilter === cat ? "scale(1.02)" : "scale(1)",
                }}
              >
                {cat}
                <span style={{
                  ...PS.filterCount,
                  background: activeFilter === cat ? "var(--cyan-dim)" : "var(--bg-3)",
                  color: activeFilter === cat ? "var(--cyan)" : "var(--text-secondary)",
                }}>
                  {cat === "All" ? projects.length : projects.filter((p) => p.category === cat).length}
                </span>
              </button>
            ))}
          </div>

          {/* Project Grid */}
          <div style={PS.grid}>
            {filtered.map((proj, i) => {
              const cc = CATEGORY_COLORS[proj.category] || CATEGORY_COLORS.Web;
              return (
                <div
                  key={proj.id}
                  data-reveal
                  data-reveal-delay={String((i % 4) + 1)}
                  className="card-hover"
                  style={{
                    ...PS.card,
                    opacity: isFiltering ? 0 : undefined,
                    transform: isFiltering ? "translateY(8px) scale(0.98)" : undefined,
                    transition: "opacity 0.2s ease, transform 0.2s ease, border-color 0.35s ease, box-shadow 0.35s ease",
                  }}
                  onClick={() => setSelectedProject(proj)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedProject(proj)}
                >
                  {/* Thumbnail */}
                  <div style={PS.cardThumbWrap}>
                    <img
                      src={resolveImageUrl(proj.thumb)}
                      alt={proj.title}
                      loading="lazy"
                      decoding="async"
                      style={PS.cardThumb}
                    />
                    <div style={PS.cardThumbOverlay} />
                    <span style={{ ...PS.cardCat, background: cc.bg, color: cc.color, border: `1px solid ${cc.border}` }}>
                      {proj.category}
                    </span>
                    {/* Hover overlay */}
                    <div style={PS.hoverOverlay} className="card-hover-overlay">
                      <span style={PS.hoverIcon}>↗</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div style={PS.cardBody}>
                    <div style={PS.cardTop}>
                      <h3 style={PS.cardTitle}>{proj.title}</h3>
                      <span style={PS.cardYear}>{proj.year}</span>
                    </div>
                    <p style={PS.cardDesc}>{proj.shortDesc}</p>
                    <div style={PS.cardTags}>
                      {proj.tags.slice(0, 3).map((t) => (
                        <span key={t} className="tag tag-interactive">{t}</span>
                      ))}
                    </div>

                    {/* Link deploy & GitHub — hanya tampil bila tersedia */}
                    {((proj.links?.live && proj.links.live !== "#") ||
                      (proj.links?.github && proj.links.github !== "#")) && (
                      <div
                        style={PS.cardLinksRow}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {proj.links?.live && proj.links.live !== "#" && (
                          <a
                            className="btn-micro"
                            style={PS.cardLinkBtn}
                            href={proj.links.live}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            🌐 Live Demo ↗
                          </a>
                        )}
                        {proj.links?.github && proj.links.github !== "#" && (
                          <a
                            className="btn-micro"
                            style={{ ...PS.cardLinkBtn, ...PS.cardGithubBtn }}
                            href={proj.links.github}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            🐙 GitHub
                          </a>
                        )}
                      </div>
                    )}

                    {/* CRUD: tombol edit + hapus — hanya tampil untuk admin */}
                    {canWrite && (
                      <div
                        style={PS.cardCrudRow}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <button
                          className="btn-micro"
                          style={PS.cardEditBtn}
                          onClick={(e) => { e.stopPropagation(); openEdit(proj); }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="btn-micro"
                          style={PS.cardDeleteBtn}
                          onClick={(e) => { e.stopPropagation(); setToDelete(proj); }}
                        >
                          🗑️ Hapus
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      <Footer />

      {/* Modal */}
      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}

      {/* CRUD: Form Modal (Create/Edit) */}
      {formModal && (
        <ProjectFormModal
          initial={formModal.project || EMPTY_FORM}
          onClose={closeForm}
          onSubmit={handleSave}
          submitting={submitting}
        />
      )}

      {/* CRUD: Delete Confirm */}
      {toDelete && (
        <ConfirmDialog
          title={`"${toDelete.title}" akan dihapus permanen.`}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}

      <style>{`
        .card-hover-overlay {
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        div[role="button"]:hover .card-hover-overlay,
        div[role="button"]:focus-visible .card-hover-overlay {
          opacity: 1;
        }
        div[role="button"] img {
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        div[role="button"]:hover img,
        div[role="button"]:focus-visible img {
          transform: scale(1.06);
        }
        div[role="button"]:hover,
        div[role="button"]:focus-visible {
          border-color: var(--border-hover);
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255,255,255,0.06);
          transform: translateY(-6px);
        }
        div[role="button"] {
          cursor: pointer;
        }
        @media (hover: none) {
          div[role="button"]:hover .card-hover-overlay { opacity: 0; }
          div[role="button"]:hover img { transform: none; }
          div[role="button"]:hover { transform: none; box-shadow: none; }
        }
        @media (max-width: 640px) {
          [data-form-grid], [data-link-grid] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// ─── Page Styles ─────────────────────────────────────────────────
const PS = {
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
    maxWidth: "480px",
  },
  tambahBtn: {
    display: "inline-flex",
    alignItems: "center",
    marginTop: "1.2rem",
    background: "linear-gradient(135deg, var(--cyan), var(--purple))",
    color: "#080b12",
    padding: "0.65rem 1.4rem",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    fontSize: "1rem",
    border: "none",
    cursor: "pointer",
    letterSpacing: "-0.01em",
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
  filterRow: {
    display: "flex",
    gap: "0.4rem",
    marginBottom: "2.5rem",
    flexWrap: "wrap",
  },
  filterBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "0.45rem 0.9rem",
    borderRadius: "10px",
    fontSize: "0.95rem",
    fontWeight: 500,
    fontFamily: "var(--font-body)",
    cursor: "pointer",
    transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
    letterSpacing: "-0.01em",
  },
  filterCount: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(min(320px, 100%), 1fr))",
    gap: "1.25rem",
  },
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    outline: "none",
  },
  cardThumbWrap: {
    position: "relative",
    overflow: "hidden",
    height: "200px",
  },
  cardThumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  cardThumbOverlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(to bottom, transparent 40%, rgba(8,11,18,0.7) 100%)",
    pointerEvents: "none",
  },
  cardCat: {
    position: "absolute",
    top: "12px",
    right: "12px",
    fontFamily: "var(--font-mono)",
    fontSize: "0.62rem",
    fontWeight: 600,
    padding: "0.2rem 0.6rem",
    borderRadius: "6px",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  hoverOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(8,11,18,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  hoverIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.12)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.2rem",
    color: "var(--text-bright)",
    fontFamily: "var(--font-mono)",
  },
  cardBody: {
    padding: "1.25rem",
  },
  cardTop: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "0.5rem",
    marginBottom: "0.4rem",
  },
  cardTitle: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "1.05rem",
    color: "var(--text-bright)",
    letterSpacing: "-0.02em",
  },
  cardYear: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.8rem",
    color: "var(--text-secondary)",
    flexShrink: 0,
  },
  cardDesc: {
    fontSize: "0.95rem",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
    marginBottom: "1rem",
  },
  cardTags: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.35rem",
  },
  cardLinksRow: {
    display: "flex",
    gap: "0.4rem",
    marginTop: "0.9rem",
    flexWrap: "wrap",
  },
  cardLinkBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontFamily: "var(--font-mono)",
    fontSize: "0.8rem",
    fontWeight: 700,
    padding: "0.34rem 0.75rem",
    borderRadius: "var(--radius-md)",
    background: "rgba(34,211,238,0.09)",
    color: "var(--cyan)",
    border: "1px solid rgba(34,211,238,0.22)",
    cursor: "pointer",
    letterSpacing: "0.03em",
    textDecoration: "none",
    transition: "all 0.2s",
  },
  cardGithubBtn: {
    background: "rgba(167,139,250,0.1)",
    color: "#a78bfa",
    border: "1px solid rgba(167,139,250,0.25)",
  },
  cardCrudRow: {
    display: "flex",
    gap: "0.4rem",
    marginTop: "1rem",
    paddingTop: "0.85rem",
    borderTop: "1px solid var(--border)",
    flexWrap: "wrap",
  },
  cardEditBtn: {
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
  cardDeleteBtn: {
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
};

// ─── Modal Styles ────────────────────────────────────────────────
const MS = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(4, 6, 10, 0.85)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    zIndex: 2000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.5rem",
    animation: "fadeIn 0.2s ease both",
  },
  modal: {
    background: "var(--bg-1)",
    border: "1px solid var(--border-hover)",
    borderRadius: "var(--radius-xl)",
    width: "100%",
    maxWidth: "580px",
    maxHeight: "min(90vh, 90dvh)",
    overflowY: "auto",
    position: "relative",
    boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
  },
  closeBtn: {
    position: "absolute",
    top: "16px",
    right: "16px",
    zIndex: 10,
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid var(--border)",
    color: "var(--text-secondary)",
    fontSize: "0.8rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.2s",
    fontFamily: "var(--font-mono)",
  },
  thumbWrap: {
    position: "relative",
    height: "240px",
    overflow: "hidden",
    borderRadius: "var(--radius-xl) var(--radius-xl) 0 0",
  },
  thumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  thumbOverlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(to bottom, transparent 40%, var(--bg-1) 100%)",
  },
  catBadge: {
    position: "absolute",
    top: "16px",
    left: "16px",
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    fontWeight: 600,
    padding: "0.25rem 0.7rem",
    borderRadius: "6px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  content: {
    padding: "clamp(1.1rem, 4vw, 1.5rem) clamp(1rem, 5vw, 1.75rem) clamp(1.4rem, 5vw, 2rem)",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "1rem",
    marginBottom: "1rem",
    flexWrap: "wrap",
  },
  year: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.7rem",
    color: "var(--text-secondary)",
    marginBottom: "4px",
    letterSpacing: "0.06em",
  },
  title: {
    fontFamily: "var(--font-display)",
    fontWeight: 800,
    fontSize: "1.6rem",
    color: "var(--text-bright)",
    letterSpacing: "-0.03em",
  },
  actions: {
    display: "flex",
    gap: "0.5rem",
    flexShrink: 0,
  },
  actionBtn: {
    display: "inline-flex",
    alignItems: "center",
    background: "linear-gradient(135deg, var(--cyan), var(--purple))",
    color: "#080b12",
    padding: "0.5rem 1.1rem",
    borderRadius: "10px",
    fontSize: "0.82rem",
    fontWeight: 700,
    fontFamily: "var(--font-body)",
    textDecoration: "none",
  },
  actionBtnGhost: {
    background: "var(--bg-3)",
    color: "var(--text-secondary)",
    border: "1px solid var(--border)",
  },
  desc: {
    fontSize: "0.92rem",
    color: "var(--text-secondary)",
    lineHeight: 1.75,
    marginBottom: "1.25rem",
  },
  tagsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.4rem",
  },
};

// ─── CRUD Modal Styles ───────────────────────────────────────────
const CRM = {
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
  confirmBox: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    width: "min(380px, 92vw)",
    background: "var(--bg-1)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-xl)",
    padding: "2rem",
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
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1.1rem",
  },
  linkGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1.1rem",
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
  checkRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.65rem",
    padding: "0.8rem 0.95rem",
    background: "var(--bg-0)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
  },
  checkbox: {
    width: "18px",
    height: "18px",
    marginTop: "0.15rem",
    accentColor: "var(--cyan)",
    cursor: "pointer",
    flexShrink: 0,
  },
  checkLabel: {
    display: "flex",
    flexDirection: "column",
    gap: "0.2rem",
    fontFamily: "var(--font-body)",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "var(--text-bright)",
  },
  checkHint: {
    fontFamily: "var(--font-body)",
    fontSize: "0.8rem",
    fontWeight: 400,
    lineHeight: 1.5,
    color: "var(--text-secondary)",
  },
  formActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.75rem",
    paddingTop: "0.5rem",
    borderTop: "1px solid var(--border)",
    marginTop: "0.25rem",
  },  btnSecondary: {
    display: "inline-flex",
    alignItems: "center",
    background: "var(--bg-3)",
    color: "var(--text-secondary)",
    padding: "0.6rem 1.2rem",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "0.88rem",
    border: "1px solid var(--border)",
    cursor: "pointer",
  },
  ctaBtn: {
    display: "inline-flex",
    alignItems: "center",
    background: "linear-gradient(135deg, var(--cyan), var(--purple))",
    color: "#080b12",
    padding: "0.6rem 1.2rem",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    fontSize: "1rem",
    border: "none",
    cursor: "pointer",
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
  },
};

export default Project;
