import { Routes, Route, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, Component } from "react";
import CustomCursor from "./components/CustomCursor";
import ScrollProgress from "./components/ScrollProgress";
import { useScrollReveal } from "./hooks/useScrollReveal";

// Code-split: tiap halaman jadi chunk terpisah → bundle awal lebih ringan.
const Home = lazy(() => import("./pages/Home"));
const Project = lazy(() => import("./pages/Project"));
const About = lazy(() => import("./pages/About"));
const Experience = lazy(() => import("./pages/Experience"));
const Contact = lazy(() => import("./pages/Contact"));
const Admin = lazy(() => import("./pages/Admin"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function PageLoader() {
  return (
    <div
      style={{
        background: "var(--bg-0)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-hidden="true"
    >
      <span
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--cyan), var(--purple))",
          animation: "pulse-dot 1s ease infinite",
        }}
      />
    </div>
  );
}

// ErrorBoundary: kalau ada error render, tampilkan pesan ramah — bukan black screen.
class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Route error:", error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            background: "var(--bg-0)",
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: "400px" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🛠️</div>
            <h2 style={{ fontFamily: "var(--font-display)", color: "var(--text-bright)", marginBottom: "0.5rem" }}>
              Ups, terjadi kesalahan.
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "1rem", marginBottom: "1.25rem" }}>
              Terjadi kendala saat memuat halaman. Silakan muat ulang.
            </p>
            <button
              className="btn-micro"
              onClick={this.handleReload}
              style={{
                background: "linear-gradient(135deg, var(--cyan), var(--purple))",
                color: "#080b12",
                padding: "0.7rem 1.6rem",
                borderRadius: "var(--radius-md)",
                fontFamily: "var(--font-body)",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              Muat Ulang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const { pathname } = useLocation();
  useScrollReveal();

  // Catat 1 kunjungan per sesi tab (bukan per halaman/route).
  // Dynamic import + dijadwalkan setelah load/idle: supabase-js tidak ikut
  // menunda render awal (FCP/LCP), tapi fitur pencatatan tetap berjalan.
  useEffect(() => {
    let active = true;
    const run = () => {
      import("./lib/contact").then(({ trackVisit }) => {
        if (active) trackVisit();
      });
    };
    const schedule =
      window.requestIdleCallback ||
      ((cb) => setTimeout(cb, 2000));
    schedule(run, { timeout: 4000 });
    return () => { active = false; };
  }, []);

  return (
    <div style={{ overflowX: "hidden", width: "100%" }}>
      {/* Global interactive elements */}
      <CustomCursor />
      <ScrollProgress />

      {/* Subtle background grid */}
      <div className="bg-grid" aria-hidden="true" />

      <ScrollToTop />

      {/* Page routes with enter animation */}
      <div key={pathname} className="page-enter" style={{ overflowX: "hidden", width: "100%" }}>
        <RouteErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/project" element={<Project />} />
              <Route path="/about" element={<About />} />
              <Route path="/experience" element={<Experience />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<Home />} />
            </Routes>
          </Suspense>
        </RouteErrorBoundary>
      </div>
    </div>
  );
}

export default App;
