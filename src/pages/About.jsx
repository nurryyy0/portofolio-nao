import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useSiteContent } from "../hooks/useSiteContent";
import { DEFAULT_CONTENT } from "../lib/content";

const D = DEFAULT_CONTENT;

function About() {
  const content = useSiteContent();
  const subtitle = content?.about_subtitle ?? D.about_subtitle;
  const bio = content?.about_bio ?? D.about_bio;

  const facts = [
    {
      icon: "📧",
      label: "Email",
      value: "nurry.naomy28@gmail.com",
      href: "mailto:nurry.naomy28@gmail.com",
    },
    {
      icon: "🐙",
      label: "GitHub",
      value: "@nurryyy0",
      href: "https://github.com/nurryyy0",
    },
    {
      icon: "📸",
      label: "Instagram",
      value: "@nnaoou_",
      href: "https://www.instagram.com/nnaoou_/",
    },
    {
      icon: "📱",
      label: "WhatsApp",
      value: "chat aku disini",
      href: "https://wa.me/6285867733008",
    },
  ];

  return (
    <div style={{ background: "var(--bg-0)", minHeight: "100vh", color: "var(--text-bright)", position: "relative", overflowX: "hidden" }}>
      <Navbar />
        <div style={S.glowCyan} />
        <div style={S.glowPurple} />

      <div style={{ paddingTop: "calc(var(--nav-h, 72px) + clamp(1.5rem, 5vw, 3rem))" }}>
        <div className="container">

          {/* --- Header: Teks & Foto --- */}
          <div className="animate-fadeUp about-header-grid" style={S.headerGrid}>

            {/* Sisi Kiri: Teks */}
            <div style={S.headerTextContainer}>
              <span className="section-label">ABOUT</span>
              <h1 style={S.title}>Tentang Saya</h1>
              <p style={S.subtitle}>{subtitle}</p>
            </div>

            {/* Sisi Kanan: Foto Profil */}
            <div className="about-photo" style={S.photoFrameContainer}>
              <div className="profile-ring-interactive" style={S.neonRing}>
                <div style={S.imageCrop}>
                  <img src="/Nurry Nurul NAomi.jpeg" alt="Nurry Nurul Naomi" style={S.profileImage} />
                </div>
              </div>
            </div>
          </div>

          {/* --- Konten Utama --- */}
          <div className="about-main-grid" style={S.mainGrid}>

            {/* Kolom Bio */}
            <div className="animate-fadeUp animate-delay-1" style={S.bioColumn}>
              <div style={S.paragraphWrapper}>
                <p style={S.bioText}>{bio}</p>
              </div>

              <div style={S.btnGroup}>
                <a
                  href="https://www.instagram.com/nnaoou_"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-micro"
                  style={S.igBtn}
                >
                  <span style={S.igBtnDot} />
                  @nnaoou_ ↗
                </a>
                <a href="/project" className="btn-micro" style={S.projectsBtn}>
                  View Projects →
                </a>
              </div>
            </div>

            {/* Kolom Kanan: Kartu Kontak */}
            <div className="animate-fadeUp animate-delay-2" style={S.factsColumn}>
              <div className="about-facts-grid" style={S.factsGrid}>
                {facts.map((f) => (
                  <a href={f.href} key={f.label} target="_blank" rel="noopener noreferrer" style={S.cardLink}>
                    <div style={S.factCard} className="card card-hover" data-reveal data-reveal-delay="1">
                      <span style={S.factIcon}>{f.icon}</span>
                      <div style={S.cardTextWrapper}>
                        <p style={S.factLabel}>{f.label}</p>
                        <p style={S.factValue}>{f.value}</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>

          </div>

          {/* Divider */}
          <div style={S.sectionDivider} />

        </div>
      </div>

      {/* Responsive: dua kolom (teks|foto, bio|kontak) ditumpuk di HP/tablet.
          Sebelumnya grid 1.2fr 0.8fr dengan gap 4rem tanpa media query sama
          sekali, sehingga di 320–768px kolomnya sangat sempit. */}
      <style>{`
        @media (max-width: 900px) {
          .about-header-grid,
          .about-main-grid {
            grid-template-columns: minmax(0, 1fr) !important;
            gap: 2rem !important;
          }
          .about-photo { order: -1; }
        }
        @media (max-width: 480px) {
          .about-facts-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>

      <Footer />
    </div>
  );
}

// Styling Object
const S = {
  title: {
    fontSize: "clamp(2.5rem, 6vw, 4rem)",
    fontWeight: 900,
    letterSpacing: "-0.04em",
    color: "var(--text-bright)",
    marginBottom: "1rem",
    marginTop: "0.5rem",
    fontFamily: "var(--font-display)",
  },
  subtitle: {
    fontSize: "1.1rem",
    color: "var(--text-secondary)",
    maxWidth: "500px",
    lineHeight: "1.6",
    margin: 0,
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
  
  headerGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: "4rem",
    alignItems: "center",
    marginBottom: "0.5rem",
  },
  headerTextContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: "4rem",
    alignItems: "start",
  },
  bioColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "2rem",
  },
  paragraphWrapper: {
    borderTop: "1px solid var(--border)",
    paddingTop: "2rem",
  },
  bioText: {
    fontSize: "1.05rem",
    color: "var(--text-secondary)",
    lineHeight: "1.9",
    margin: 0,
  },
  highlight: {
    color: "var(--text-bright)",
    fontWeight: 600,
  },

  factsColumn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "start",
    marginTop: "1.5rem",
  },
  
  photoFrameContainer: {
    position: "relative",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  neonRing: {
    width: "clamp(150px, 45vw, 200px)",
    height: "clamp(150px, 45vw, 200px)",
    borderRadius: "50%",
    padding: "2.5px",
    background: "linear-gradient(135deg, var(--cyan, #00ffff), var(--purple, #bc13fe))",
    boxShadow: "0 10px 30px rgba(188, 19, 254, 0.25)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  imageCrop: {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    overflow: "hidden",
    border: "4px solid var(--bg-0, #0a0a0a)", 
  },
  profileImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
  },
  factsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1rem",
    width: "100%",
  },
  cardLink: {
    textDecoration: "none",
  },
  factCard: {
    padding: "1.5rem",
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    background: "#161616",
    border: "1px solid #222",
    borderRadius: "12px",
    height: "100%",
  },
  factIcon: {
    fontSize: "1.8rem",
    opacity: 0.8,
  },
  cardTextWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  factLabel: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.82rem",
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--text-secondary)",
    margin: 0,
  },
  factValue: {
    fontSize: "1.05rem",
    fontWeight: 600,
    color: "var(--text-bright)",
    margin: 0,
    wordBreak: "break-word",
  },

  btnGroup: {
    display: "flex",
    gap: "1rem",
    flexWrap: "wrap",
  },
  igBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    background: "#1a1a1a",
    border: "1px solid #333",
    color: "var(--text-secondary)",
    padding: "0.7rem 1.5rem",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: 500,
    textDecoration: "none",
    fontFamily: "var(--font-mono)",
  },
  igBtnDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#e1306c",
  },
  projectsBtn: {
    display: "inline-flex",
    alignItems: "center",
    background: "linear-gradient(135deg, #00ffff, #bc13fe)",
    color: "#000",
    padding: "0.7rem 1.5rem",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: 700,
    textDecoration: "none",
  },
  sectionDivider: {
    width: "100%",
    height: "1px",
    background: "var(--border)",
    marginTop: "2rem",
  },
};

export default About;
