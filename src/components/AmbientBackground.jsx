import { useEffect, useRef } from "react";
import { useReducedMotion } from "../hooks/useReducedMotion";

/**
 * AmbientBackground
 * ---------------------------------------------------------------------------
 * Lapisan dekoratif global (ambient) yang berada DI BELAKANG seluruh konten.
 *
 * Prinsip:
 * - Murni presentational: tidak menyentuh layout, data, atau routing.
 * - Tidakuenak clicks: pointer-events:none + z-index 0 (konten semua di atasnya).
 * - Ringan: animasi hanya transform/opacity (dipromosi ke compositor GPU).
 * - Partikel & bentuk ditulis lewat CSS custom property, jadi tidak ada
 *   komponen yang re-render per frame.
 * - Parallax pointer memakai satu rAF yang menulis 2 custom property, bukan
 *   setState → React tidak pernah re-render karena gerakan mouse.
 * - Nonaktif total bila user mengaktifkan prefers-reduced-motion, dan
 *   dirampingkan di perangkat sentuh (mobile) lewat CSS.
 */

// Partikel statis: posisi/durasi/delay di-hardcode di sini lalu di-pass
// sebagai CSS variable. Menghindari ribuan inline style di markup.
const PARTICLES = [
  { x: 6, y: 16, size: 3, dur: 34, delay: -4 },
  { x: 14, y: 62, size: 2, dur: 42, delay: -12 },
  { x: 22, y: 38, size: 4, dur: 38, delay: -7 },
  { x: 31, y: 82, size: 2, dur: 46, delay: -21 },
  { x: 38, y: 24, size: 3, dur: 30, delay: -2 },
  { x: 47, y: 71, size: 2, dur: 40, delay: -17 },
  { x: 55, y: 12, size: 3, dur: 36, delay: -9 },
  { x: 63, y: 55, size: 2, dur: 44, delay: -25 },
  { x: 71, y: 88, size: 3, dur: 32, delay: -14 },
  { x: 78, y: 30, size: 2, dur: 48, delay: -31 },
  { x: 86, y: 68, size: 3, dur: 36, delay: -6 },
  { x: 92, y: 20, size: 2, dur: 40, delay: -19 },
  { x: 18, y: 90, size: 2, dur: 42, delay: -28 },
  { x: 66, y: 44, size: 2, dur: 50, delay: -11 },
];

function AmbientBackground() {
  const rootRef = useRef(null);
  const prefersReduced = useReducedMotion();

  // Parallax pointer: tulis --amb-px / --amb-py (rentang -1..1) via rAF.
  // Nonaktif di perangkat sentuh & saat reduced motion.
  useEffect(() => {
    if (prefersReduced) return;
    const finePointer =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!finePointer) return;

    const el = rootRef.current;
    if (!el) return;

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let rafId = 0;
    let running = false;

    const tick = () => {
      // Lerp halus supaya tidak "nempel" ke kursor (lebih lembut, premium).
      current.x += (target.x - current.x) * 0.06;
      current.y += (target.y - current.y) * 0.06;
      el.style.setProperty("--amb-px", current.x.toFixed(4));
      el.style.setProperty("--amb-py", current.y.toFixed(4));
      const settled =
        Math.abs(target.x - current.x) < 0.0015 &&
        Math.abs(target.y - current.y) < 0.0015;
      if (settled) {
        running = false;
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    const onPointerMove = (e) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!running) {
        running = true;
        rafId = requestAnimationFrame(tick);
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [prefersReduced]);

  return (
    <div className="ambient" ref={rootRef} aria-hidden="true">
      {/* Base: aurora sangat soft sebagai lapisan dasar (bukan warna branding baru) */}
      <div className="ambient-base" />

      {/* Grid halus yang sudah ada sebelumnya, digeser gentle ikut parallax */}
      <div className="bg-grid" />

      {/* Orbs: glow besar yang bergerak sangat lambat */}
      <div className="ambient-orb ambient-orb-a" />
      <div className="ambient-orb ambient-orb-b" />
      <div className="ambient-orb ambient-orb-c" />

      {/* Bentuk abstrak: ring tipis berputar + dua garis light yang melintas */}
      <div className="ambient-ring" />
      <div className="ambient-streak ambient-streak-a" />
      <div className="ambient-streak ambient-streak-b" />

      {/* Partikel kecil yang mengambang naik-turun pelan */}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="ambient-particle"
          style={{
            "--px": `${p.x}%`,
            "--py": `${p.y}%`,
            "--size": `${p.size}px`,
            "--dur": `${p.dur}s`,
            "--delay": `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export default AmbientBackground;
