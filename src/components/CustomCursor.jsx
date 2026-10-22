import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Custom cursor component with smooth follow and interaction feedback.
 * - Small dot + outer ring
 * - Changes on hover over interactive elements
 * - Hidden on touch devices
 * - Smooth follow using requestAnimationFrame + lerp
 */
function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const mousePos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const rafId = useRef(null);
  const stateRef = useRef({ hovering: false, clicking: false });
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(true);

  // Keep animation loop state in sync with React state
  useEffect(() => {
    stateRef.current.hovering = isHovering;
  }, [isHovering]);

  useEffect(() => {
    stateRef.current.clicking = isClicking;
  }, [isClicking]);

  // Detect touch device / small screen
  useEffect(() => {
    const checkTouch = () => {
      const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth <= 768;
      setIsTouchDevice(isTouch || isSmallScreen);
    };
    checkTouch();
    window.addEventListener("resize", checkTouch);
    return () => window.removeEventListener("resize", checkTouch);
  }, []);

  const handleMouseMove = useCallback((e) => {
    mousePos.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseDown = useCallback(() => setIsClicking(true), []);
  const handleMouseUp = useCallback(() => setIsClicking(false), []);

  // Detect hover on interactive elements
  useEffect(() => {
    const isInteractiveEl = (el) =>
      el &&
      (el.closest("a") ||
        el.closest("button") ||
        el.closest("[role='button']") ||
        el.closest("input") ||
        el.closest("textarea") ||
        el.closest("select") ||
        el.closest(".btn-micro") ||
        el.closest(".card-hover") ||
        el.closest("[data-cursor-hover]"));

    const onOver = (e) => {
      if (isInteractiveEl(e.target)) setIsHovering(true);
    };

    const onOut = (e) => {
      if (!isInteractiveEl(e.relatedTarget)) setIsHovering(false);
    };

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
    };
  }, []);

  // Mouse events
  useEffect(() => {
    if (isTouchDevice) return;

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isTouchDevice, handleMouseMove, handleMouseDown, handleMouseUp]);

  // Animation loop for smooth follow
  useEffect(() => {
    if (isTouchDevice) return;

    const lerp = (a, b, t) => a + (b - a) * t;

    const animate = () => {
      // Ring follows with smooth easing
      ringPos.current.x = lerp(ringPos.current.x, mousePos.current.x, 0.14);
      ringPos.current.y = lerp(ringPos.current.y, mousePos.current.y, 0.14);

      const { hovering, clicking } = stateRef.current;

      // Compute current rendered sizes for proper centering
      const dotSize = clicking ? 4 : hovering ? 10 : 6;
      const ringSize = clicking ? 26 : hovering ? 48 : 32;

      if (dotRef.current) {
        dotRef.current.style.transform =
          `translate(${mousePos.current.x - dotSize / 2}px, ${mousePos.current.y - dotSize / 2}px)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform =
          `translate(${ringPos.current.x - ringSize / 2}px, ${ringPos.current.y - ringSize / 2}px)`;
      }

      rafId.current = requestAnimationFrame(animate);
    };

    rafId.current = requestAnimationFrame(animate);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [isTouchDevice]);

  if (isTouchDevice) return null;

  return (
    <>
      <div
        ref={dotRef}
        className={`cursor-dot ${isHovering ? "cursor-hover" : ""} ${isClicking ? "cursor-click" : ""}`}
        style={{ display: "block" }}
        aria-hidden="true"
      />
      <div
        ref={ringRef}
        className={`cursor-ring ${isHovering ? "cursor-hover" : ""} ${isClicking ? "cursor-click" : ""}`}
        style={{ display: "block" }}
        aria-hidden="true"
      />
    </>
  );
}

export default CustomCursor;