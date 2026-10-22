import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAdmin } from "../lib/auth";

function Navbar() {
  const location = useLocation();
  const { isAdmin } = useAdmin();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setLogoClicks] = useState(0);
  const [easterEgg, setEasterEgg] = useState(false);
  const logoTimerRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock page scrolling while the mobile menu is open. Restoring the previous
  // value on cleanup also handles route changes that unmount this navbar.
  useEffect(() => {
    if (!menuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  // Easter egg: click logo 5 times
  const handleLogoClick = useCallback((e) => {
    e.preventDefault();
    setLogoClicks((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        setEasterEgg(true);
        setTimeout(() => setEasterEgg(false), 1200);
        return 0;
      }
      return next;
    });
    // Reset counter after 2 seconds of no clicks
    if (logoTimerRef.current) clearTimeout(logoTimerRef.current);
    logoTimerRef.current = setTimeout(() => setLogoClicks(0), 2000);
  }, []);

  const links = [
    { to: "/", label: "Home" },
    { to: "/about", label: "About" },
    { to: "/project", label: "Projects" },
    { to: "/experience", label: "Experience" },
    { to: "/contact", label: "Contact" },
  ];

  // Link Dashboard hanya tampil saat admin login (publik tidak melihat),
  // dan diletakkan di depan sebagai item navigasi pertama.
  const navLinks = isAdmin
    ? [{ to: "/admin", label: "Dashboard" }, ...links]
    : links;

  const isActive = (to) => location.pathname === to;

  return (
    <>
      <nav className="navbar-root" style={{
        position: "fixed",
        top: 0, left: 0, right: 0,
        zIndex: 1000,
        transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        background: scrolled
          ? "rgba(8, 11, 18, 0.88)"
          : "transparent",
        borderBottom: scrolled
          ? "1px solid rgba(255,255,255,0.055)"
          : "1px solid transparent",
        backdropFilter: scrolled ? "blur(24px) saturate(1.6)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(24px) saturate(1.6)" : "none",
      }}>
        <div style={S.inner}>
          {/* Logo */}
          <a
            href="https://www.instagram.com/nnaoou_?igsh=MXZidWtmeW5yNW5tcQ=="
            target="_blank"
            rel="noopener noreferrer"
            style={S.logo}
            onClick={handleLogoClick}
            aria-label="Logo - click 5 times for a surprise"
          >
            <span
              className={easterEgg ? "easter-egg-active" : ""}
              style={S.logoMark}
            >
              N
            </span>
            <span style={S.logoText}>nnaomii</span>
          </a>

          {/* Desktop nav */}
          <ul style={S.navList}>
            {navLinks.map((l) => (
              <li key={l.to} style={{ listStyle: "none" }}>
                <Link
                  to={l.to}
                  className={`nav-link-interactive ${isActive(l.to) ? "nav-active" : ""}`}
                  style={{
                    ...S.navLink,
                    color: isActive(l.to) ? "var(--text-bright)" : "var(--text-secondary)",
                  }}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <a
            href="https://www.instagram.com/nnaoou_?igsh=MXZidWtmeW5yNW5tcQ=="
            target="_blank"
            rel="noopener noreferrer"
            style={S.ctaBtn}
            className="nav-cta btn-micro"
          >
            Hire Me ↗
          </a>

          {/* Hamburger */}
          <button onClick={() => setMenuOpen((open) => !open)} style={S.burger} aria-label="Toggle menu" aria-expanded={menuOpen}>
            <span style={{ ...S.burgerLine, transform: menuOpen ? "rotate(45deg) translate(5px, 5px)" : "none" }} />
            <span style={{ ...S.burgerLine, opacity: menuOpen ? 0 : 1, transform: menuOpen ? "scaleX(0)" : "none" }} />
            <span style={{ ...S.burgerLine, transform: menuOpen ? "rotate(-45deg) translate(5px, -5px)" : "none" }} />
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      <div
        style={{
          ...S.mobileOverlay,
          opacity: menuOpen ? 1 : 0,
          visibility: menuOpen ? "visible" : "hidden",
          pointerEvents: menuOpen ? "auto" : "none",
        }}
        aria-hidden={!menuOpen}
      >
        <div style={S.mobileInner}>
          {navLinks.map((l, i) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMenuOpen(false)}
              style={{
                ...S.mobileLink,
                color: isActive(l.to) ? "var(--cyan)" : "var(--text-primary)",
                animationDelay: menuOpen ? `${i * 0.06}s` : "0s",
                opacity: menuOpen ? 1 : 0,
                transform: menuOpen ? "translateY(0)" : "translateY(20px)",
                transition: `opacity 0.3s ease ${i * 0.06}s, transform 0.3s ease ${i * 0.06}s, color 0.2s ease`,
              }}
            >
              <span style={S.mobileLinkNum}>0{i + 1}</span>
              {l.label}
            </Link>
          ))}
          <div style={S.mobileDivider} />
          <a
            href="https://www.instagram.com/nnaoou_?igsh=MXZidWtmeW5yNW5tcQ=="
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...S.mobileIg,
              opacity: menuOpen ? 1 : 0,
              transform: menuOpen ? "translateY(0)" : "translateY(20px)",
              transition: `opacity 0.3s ease 0.3s, transform 0.3s ease 0.3s, color 0.2s ease`,
            }}
          >
            @nnaoou_ ↗
          </a>
        </div>
      </div>
    </>
  );
}

const S = {
  inner: {
    width: "100%",
    maxWidth: "1400px",
    margin: "0 auto",
    paddingLeft: "clamp(1rem, 4vw, 2rem)",
    paddingRight: "clamp(1rem, 4vw, 2rem)",
    /* Tinggi fluid: tetap 76px di HP, boleh tumbuh di layar lebar (sedikit
       lebih lega). Halaman memakai --nav-h sebagai offset, jadi selalu sinkron. */
    height: "var(--nav-h)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "clamp(0.75rem, 3vw, 2rem)",
    minWidth: 0,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    textDecoration: "none",
    flexShrink: 0,
  },
  logoMark: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    background: "linear-gradient(135deg, var(--cyan) 0%, var(--purple) 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-display)",
    fontWeight: 800,
    fontSize: "0.9rem",
    color: "#080b12",
    flexShrink: 0,
    transition: "transform 0.3s ease",
  },
  logoText: {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "1.05rem",
    color: "var(--text-bright)",
    letterSpacing: "-0.02em",
  },
  navList: {
    display: "flex",
    gap: "0.5rem",
    listStyle: "none",
    margin: "0 auto",
    padding: 0,
  },
  navLink: {
    fontFamily: "var(--font-body)",
    fontSize: "1rem",
    fontWeight: 400,
    textDecoration: "none",
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "5px",
    transition: "color 0.2s ease, background 0.2s ease",
  },
  ctaBtn: {
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    background: "var(--cyan-dim)",
    color: "var(--cyan)",
    border: "1px solid var(--cyan-border)",
    padding: "0.5rem 1.25rem",
    borderRadius: "10px",
    fontSize: "0.95rem",
    fontWeight: 600,
    fontFamily: "var(--font-body)",
    textDecoration: "none",
    letterSpacing: "0.01em",
  },
  burger: {
    display: "none",
    flexDirection: "column",
    gap: "5px",
    background: "transparent",
    border: "none",
    padding: "8px",
    cursor: "pointer",
  },
  burgerLine: {
    width: "20px",
    height: "1.5px",
    background: "var(--text-primary)",
    borderRadius: "2px",
    transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease",
    display: "block",
  },
  mobileOverlay: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    /* Selalu menempel tepat di bawah navbar, berapa pun tingginya. */
    top: "var(--nav-h)",
    background: "rgba(8, 11, 18, 0.97)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    zIndex: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    /* Body dikunci saat menu terbuka, jadi overlay WAJIB bisa di-scroll
       sendiri — kalau tidak, link terbawah tidak terjangkau di HP pendek. */
    overflowY: "auto",
    overscrollBehavior: "contain",
    WebkitOverflowScrolling: "touch",
    transition: "opacity 0.3s ease, visibility 0.3s ease",
  },
  mobileInner: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.25rem",
    width: "100%",
    margin: "auto",
    padding: "2rem 1.25rem",
  },
  mobileLink: {
    fontFamily: "var(--font-display)",
    fontSize: "clamp(1.5rem, 7vw, 2.2rem)",
    fontWeight: 800,
    textDecoration: "none",
    letterSpacing: "-0.03em",
    display: "flex",
    alignItems: "baseline",
    gap: "0.75rem",
    padding: "0.3rem 0",
  },
  mobileLinkNum: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.85rem",
    color: "var(--text-secondary)",
    fontWeight: 400,
    letterSpacing: "0.05em",
  },
  mobileDivider: {
    width: "40px",
    height: "1px",
    background: "var(--border)",
    margin: "1.5rem 0 1rem",
  },
  mobileIg: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.95rem",
    color: "var(--text-secondary)",
    textDecoration: "none",
    letterSpacing: "0.04em",
  },
};

// Responsive via media query injection
const mq = document.createElement("style");
mq.textContent = `
  :root { --nav-h: 68px; }
  @media (min-width: 1024px) { :root { --nav-h: 76px; } }
  @media (max-width: 768px) {
    .nav-cta { display: none !important; }
  }
  @media (max-width: 900px) {
    nav.navbar-root ul { display: none !important; }
    button[aria-label="Toggle menu"] { display: flex !important; }
  }
  @media (min-width: 901px) {
    button[aria-label="Toggle menu"] { display: none !important; }
  }
  .nav-cta:hover {
    background: var(--cyan-glow) !important;
    box-shadow: 0 0 16px var(--cyan-glow) !important;
  }
`;
if (typeof document !== "undefined" && !document.getElementById("navbar-mq")) {
  mq.id = "navbar-mq";
  document.head.appendChild(mq);
}

export default Navbar;
