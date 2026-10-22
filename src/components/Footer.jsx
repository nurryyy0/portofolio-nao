function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={S.footer}>
      <div className="container" style={S.inner}>
        <span style={S.copy}>
          © {year} naomi's portfolio

        </span>
        <span style={S.madeWith}>
          <span style={S.heart}>♥</span> Designed & developed by naomi
        </span>
      </div>
    </footer>
  );
}

const S = {
  footer: {
    alignItems: "center",
    borderTop: "1px solid var(--border)",
    background: "var(--bg-1)",
    paddingTop: "2rem",
    paddingBottom: "2rem",
  },
  inner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "1rem",
  },
  copy: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.85rem",
    color: "var(--text-secondary)",
    letterSpacing: "0.03em",
    transition: "color 0.2s ease",
  },
  madeWith: {
    fontFamily: "var(--font-mono)",
    fontSize: "0.85rem",
    color: "var(--text-secondary)",
    letterSpacing: "0.03em",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  heart: {
    color: "#f87171",
    display: "inline-block",
    animation: "pulse-dot 2s ease infinite",
  },
};

export default Footer;
