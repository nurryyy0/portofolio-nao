import { useState, useEffect, useRef } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useSiteContent } from "../hooks/useSiteContent";
import { DEFAULT_CONTENT } from "../lib/content";
import { storage, resolveImageUrl } from "../lib/storage";

// Fallback konten (dipakai sebelum data load / saat Supabase nonaktif).
const D = DEFAULT_CONTENT;

// Jumlah project yang ditampilkan di section "Featured Work" kalau admin
// belum mencentang project Manual (fallback otomatis).
const FEATURED_COUNT = 3;

// Warna kategori — sama dengan halaman Projects agar konsisten.
const CATEGORY_COLORS = {
  Web: { color: "var(--cyan)", bg: "var(--cyan-dim)", border: "var(--cyan-border)" },
  App: { color: "var(--purple)", bg: "var(--purple-dim)", border: "var(--purple-border)" },
  Game: { color: "#fb923c", bg: "rgba(251,146,60,0.1)", border: "rgba(251,146,60,0.2)" },
  "Creative Projects": { color: "#4ade80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.22)" },
};

// Fallback kalau Supabase nonaktif / error — cukup 3 project saja.
const FALLBACK_PROJECTS = [
  {
    id: "1",
    title: "SmartLand Project",
    shortDesc: "Aplikasi prediksi kesuburan tanah memakai Machine Learning.",
    tags: ["Python", "Streamlit"],
    category: "App",
    year: "2026",
    thumb: "smartland.png",
    links: { github: "https://github.com/nurryyy0/Project-Akhir", live: "" },
  },
  {
    id: "2",
    title: "Poertofolio Web",
    shortDesc: "Web portofolio interaktif yang dibangun dengan React dan Vite.",
    tags: ["React", "Node.js", "Vite"],
    category: "Web",
    year: "2026",
    thumb: "porto.png",
    links: { github: "#", live: "" },
  },
  {
    id: "3",
    title: "The Noyescape",
    shortDesc: "Game platformer 2D pixel art bertema petualangan luar angkasa.",
    tags: ["Turbowarp"],
    category: "Game",
    year: "2025",
    thumb: "noyescape.jpeg",
    links: { github: "https://github.com/nurryyy0/Game-The-Noyescape", live: "" },
  },
];

function Home() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const heroRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const content = useSiteContent();
  // Project untuk section "Featured Work" — dimuat dari storage yang sama
  // dengan halaman Projects, jadi hasil edit admin otomatis ikut tampil di sini.
  const [featured, setFeatured] = useState([]);

  // Parallax: track mouse relative to hero section
  useEffect(() => {
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (isTouch || prefersReducedMotion) return;

    const onMove = (e) => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      setMouse({ x, y });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [prefersReducedMotion]);

  // Ambil project untuk showcase. Fallback dipakai kalau Supabase error.
  useEffect(() => {
    let active = true;
    storage.loadProjects(FALLBACK_PROJECTS).then((list) => {
      if (!active || !Array.isArray(list)) return;
      const safe = list.filter((p) => p && p.title);
      // Pilihan manual admin: project yang dicentang "Tampilkan di Home"
      // di form project. Kalau tidak ada yang dicentang, pakai fallback lama
      // (yang punya link deploy lebih dulu) supaya section tidak kosong.
      const chosen = safe.filter((p) => p.featured === true);
      if (chosen.length) {
        setFeatured(chosen);
        return;
      }
      const withLive = safe.filter((p) => p.links?.live && p.links.live !== "#");
      const rest = safe.filter((p) => !(p.links?.live && p.links.live !== "#"));
      setFeatured([...withLive, ...rest].slice(0, FEATURED_COUNT));
    });
    return () => { active = false; };
  }, []);

  return (
    <div style={{ background: "var(--bg-0)", minHeight: "100vh" }}>
      <Navbar />

      {/* ── Hero ── */}
      <section ref={heroRef} style={S.hero}>
        {/* Ambient glows with parallax */}
        <div
          className="hero-glow"
          style={{
            ...S.glowCyan,
            transform: `translate(${mouse.x * 20}px, ${mouse.y * 20}px)`,
          }}
        />
        <div
          className="hero-glow"
          style={{
            ...S.glowPurple,
            transform: `translate(${mouse.x * -15}px, ${mouse.y * -15}px)`,
          }}
        />

        {/* Floating decorative elements */}
        <div style={S.floatingWrap} aria-hidden="true">
          <div
            className="floating-slow"
            style={{ ...S.floatElement, top: "15%", right: "12%", width: "6px", height: "6px", borderRadius: "50%", background: "var(--cyan)", opacity: 0.4 }}
          />
          <div
            className="floating-medium floating-delay-1"
            style={{ ...S.floatElement, top: "25%", right: "25%", width: "4px", height: "4px", borderRadius: "50%", background: "var(--purple)", opacity: 0.35 }}
          />
          <div
            className="floating-slow floating-delay-2"
            style={{ ...S.floatElement, bottom: "30%", right: "8%", width: "40px", height: "1px", background: "linear-gradient(90deg, var(--cyan), transparent)", opacity: 0.3 }}
          />
          <div
            className="floating-medium floating-delay-3"
            style={{ ...S.floatElement, top: "60%", right: "18%", width: "8px", height: "8px", borderRadius: "2px", border: "1px solid var(--cyan-border)", opacity: 0.3, transform: "rotate(45deg)" }}
          />
          <div
            className="floating-slow floating-delay-1"
            style={{ ...S.floatElement, top: "40%", right: "5%", width: "50px", height: "1px", background: "linear-gradient(90deg, transparent, var(--purple))", opacity: 0.2 }}
          />
          <div
            className="floating-medium floating-delay-2"
            style={{ ...S.floatElement, top: "70%", right: "30%", width: "5px", height: "5px", borderRadius: "50%", border: "1px solid var(--purple-border)", opacity: 0.3 }}
          />
          <div
            className="floating-slow floating-delay-3"
            style={{ ...S.floatElement, bottom: "15%", right: "15%", width: "30px", height: "30px", borderRadius: "8px", border: "1px solid var(--border)", opacity: 0.15, transform: "rotate(12deg)" }}
          />
        </div>

        <div className="container" style={{ position: "relative", zIndex: 1 }}>

          {/* Main heading */}
          <h1 className="animate-fadeUp animate-delay-1" style={S.heroTitle}>
            {content?.home_hero_l1a ?? D.home_hero_l1a}{" "}
            <span style={S.gradientText}>{content?.home_hero_l1b ?? D.home_hero_l1b}</span>
            <br />
            {content?.home_hero_l2a ?? D.home_hero_l2a}{" "}
            <span style={S.gradientText}>{content?.home_hero_l2b ?? D.home_hero_l2b}</span>
          </h1>

          {/* ── Tech Stack Section ── */}
          <div className="animate-fadeUp animate-delay-2" style={S.skillsStrip}>
            <div style={S.skillsRow}>
              {[
                { num: "01", label: "ML Engineer" },
                { num: "02", label: "Graphic Designer" },
                { num: "03", label: "Web Developer" },
                { num: "04", label: "Game Developer" },
                { num: "05", label: "AI Enthusiast" },
                { num: "06", label: "Generalist" }
              ].map((skill) => (
                <div key={skill.num} className="skill-chip-interactive" style={S.skillChip}>
                  <span style={S.skillIcon}>{skill.num}</span>
                  {skill.label}
                </div>
              ))}
            </div>
          </div>

          {/* ── Sub-headline ── */}
          <p className="animate-fadeUp animate-delay-3" style={S.heroSub}>
            {content?.home_subtitle ?? D.home_subtitle}
          </p>

          {/* CTAs */}
          <div className="animate-fadeUp animate-delay-4" style={S.ctaRow}>
            <a href="/project" className="btn-micro" style={S.btnPrimary}>
              <span>View Projects</span>
              <span className="arrow-move">→</span>
            </a>
            <a href="/about" className="btn-micro" style={S.btnGhost}>
              About me
            </a>
          </div>

        </div>
      </section>

      {/* ── Featured Work ── */}
      <section style={S.featuredSection}>
        <div className="container">
          <div className="animate-fadeUp" style={S.featuredHead}>
            <div>
              <span className="section-label">Featured Work</span>
              <h2 style={S.featuredTitle}>
                Eksplorasi <span style={S.gradientText}>Projek</span>
              </h2>
              <p style={S.featuredSubtitle}>
                Tiga karya pilihan saya yang menunjukkan kemampuan teknis dalam berkarya dan mengembangkan proyek.
              </p>
            </div>
            <a href="/project" className="btn-micro" style={S.seeAllBtn}>
              Lihat Semua <span className="arrow-move">→</span>
            </a>
          </div>

          <div className="animate-fadeUp animate-delay-1 featured-grid" style={S.featuredGrid}>
            {featured.map((p, i) => {
              const cc = CATEGORY_COLORS[p.category] || CATEGORY_COLORS.Web;
              return (
                <a
                  key={p.id}
                  href="/project"
                  className="card-hover featured-card"
                  data-reveal
                  data-reveal-delay={String(i + 1)}
                  style={S.featuredCard}
                >
                  {/* Thumbnail */}
                  <div style={S.featuredThumbWrap}>
                    <img
                      src={resolveImageUrl(p.thumb)}
                      alt={p.title}
                      loading="lazy"
                      decoding="async"
                      style={S.featuredThumb}
                    />
                    <div style={S.featuredThumbOverlay} />
                    <span
                      style={{
                        ...S.featuredCat,
                        background: cc.bg,
                        color: cc.color,
                        border: `1px solid ${cc.border}`,
                      }}
                    >
                      {p.category}
                    </span>
                  </div>

                  <div style={S.featuredBody}>
                    <div style={S.featuredTop}>
                      <h3 style={S.featuredCardTitle}>{p.title}</h3>
                      <span style={S.featuredYear}>{p.year}</span>
                    </div>
                    <p style={S.featuredDesc}>{p.shortDesc}</p>
                    <div style={S.featuredTags}>
                      {(p.tags || []).slice(0, 3).map((t) => (
                        <span key={t} className="tag tag-interactive">{t}</span>
                      ))}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* CSS untuk hover effect card + responsive grid */}
      <style>{`
        a.featured-card:hover img {
          transform: scale(1.06);
        }
        @media (max-width: 640px) {
          .featured-grid { grid-template-columns: 1fr !important; }
        }
        /* Hero: glow dekoratif tidak boleh menambah lebar halaman */
        .hero-glow { max-width: 100vw; }
      `}</style>

      <Footer />
    </div>
  );
}

const S = {
  hero: {
    position: "relative",
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    /* offset navbar (fluid) + ruang napas; sebelumnya fix 64px sehingga
       konten menempel/tertutup di layar kecil. */
    paddingTop: "calc(var(--nav-h, 72px) + clamp(1.5rem, 5vw, 3rem))",
    paddingBottom: "clamp(2rem, 6vw, 4rem)",
    overflow: "hidden",
  },
  glowCyan: {
    position: "absolute",
    top: "-10%",
    right: "-8%",
    width: "640px",
    height: "640px",
    background: "radial-gradient(circle at center, rgba(34,211,238,0.09) 0%, transparent 65%)",
    pointerEvents: "none",
    zIndex: 0,
    transition: "transform 0.3s ease-out",
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
    transition: "transform 0.3s ease-out",
  },
  heroTitle: {
    fontSize: "clamp(3rem, 7vw, 5.5rem)",
    fontWeight: 900,
    lineHeight: 1.0,
    letterSpacing: "-0.04em",
    color: "var(--text-bright)",
    marginBottom: "1.5rem",
    fontFamily: "var(--font-display)",
  },
  gradientText: {
    background: "linear-gradient(135deg, var(--cyan) 0%, var(--purple) 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  heroSub: {
    fontSize: "1.05rem",
    color: "var(--text-secondary)",
    lineHeight: 1.75,
    maxWidth: "480px",
    marginBottom: "1.5rem",
    fontWeight: 400,
  },
  ctaRow: {
    display: "flex",
    gap: "0.85rem",
    flexWrap: "wrap",
  },
  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    background: "linear-gradient(135deg, var(--cyan) 0%, var(--purple) 100%)",
    color: "#080b12",
    padding: "0.75rem 1.75rem",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    fontSize: "1rem",
    cursor: "pointer",
    letterSpacing: "-0.01em",
  },
  btnGhost: {
    display: "inline-flex",
    alignItems: "center",
    background: "var(--bg-2)",
    color: "var(--text-secondary)",
    padding: "0.75rem 1.75rem",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-body)",
    fontWeight: 500,
    fontSize: "1rem",
    border: "1px solid var(--border)",
    cursor: "pointer",
  },
  skillsStrip: {
    padding: "3rem 0",
  },
  skillsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.6rem",
  },
  skillChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontFamily: "var(--font-body)",
    fontSize: "0.95rem",
    color: "var(--text-secondary)",
    background: "var(--bg-2)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "0.4rem 0.9rem",
    fontWeight: 500,
  },
  skillIcon: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.82rem",
    color: "var(--cyan)",
  },
  floatingWrap: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 0,
  },
  floatElement: {
    position: "absolute",
  },

  // ── Featured Work ──
  featuredSection: {
    position: "relative",
    paddingTop: "5rem",
    paddingBottom: "5rem",
  },
  featuredHead: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "1.5rem",
    marginBottom: "2.5rem",
    flexWrap: "wrap",
  },
  featuredTitle: {
    fontSize: "clamp(2rem, 4.5vw, 3.2rem)",
    fontWeight: 900,
    letterSpacing: "-0.035em",
    color: "var(--text-bright)",
    lineHeight: 1.1,
    fontFamily: "var(--font-display)",
  },
  featuredSubtitle: {
    maxWidth: "600px",
    marginTop: "0.75rem",
    color: "var(--text-secondary)",
    lineHeight: 1.7,
  },
  seeAllBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    background: "var(--bg-2)",
    color: "var(--text-secondary)",
    padding: "0.6rem 1.2rem",
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "0.95rem",
    border: "1px solid var(--border)",
    textDecoration: "none",
  },
  featuredGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))",
    gap: "1.25rem",
  },
  featuredCard: {
    display: "block",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    textDecoration: "none",
    outline: "none",
  },
  featuredThumbWrap: {
    position: "relative",
    overflow: "hidden",
    height: "190px",
  },
  featuredThumb: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    transition: "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
  },
  featuredThumbOverlay: {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(to bottom, transparent 40%, rgba(8,11,18,0.7) 100%)",
    pointerEvents: "none",
  },
  featuredCat: {
    position: "absolute",
    top: "12px",
    right: "12px",
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    fontWeight: 600,
    padding: "0.25rem 0.7rem",
    borderRadius: "6px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  featuredBody: {
    padding: "1.25rem 1.5rem 1.5rem",
  },
  featuredTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    marginBottom: "0.4rem",
  },
  featuredCardTitle: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "1.05rem",
    color: "var(--text-bright)",
    letterSpacing: "-0.02em",
  },
  featuredYear: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.8rem",
    color: "var(--text-secondary)",
    flexShrink: 0,
  },
  featuredDesc: {
    fontSize: "0.95rem",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
    marginBottom: "1rem",
  },
  featuredTags: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.35rem",
  },
};

export default Home;
