import { useState, useEffect } from "react";

/**
 * Detects if the user prefers reduced motion.
 * Returns true if animations should be reduced/disabled.
 */
export function useReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    return mq.matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e) => setPrefersReduced(e.matches);

    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return prefersReduced;
}

export default useReducedMotion;
