import { useEffect, useRef } from "react";

/**
 * useModalA11y — aksesibilitas untuk modal/dialog.
 *
 * Fitur:
 *  - Saat terbuka: fokus berpindah ke elemen interaktif pertama di dalam modal
 *  - Tab / Shift+Tab terkunci di dalam modal (focus trap)
 *  - ESC menutup modal
 *  - Saat ditutup/menutup: fokus kembali ke elemen pemicu (sebelum modal dibuka)
 *
 * Pemakaian:
 *   const dialogRef = useModalA11y(isOpen, onClose);
 *   return <div ref={dialogRef} role="dialog" aria-modal="true">…</div>
 */
export function useModalA11y(active, onClose) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const FOCUSABLE =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const getFocusables = () => Array.from(node.querySelectorAll(FOCUSABLE));

    // Pindah fokus ke dalam modal (hindari scroll jump).
    const items = getFocusables();
    const first = items[0] || node;
    try {
      first.focus({ preventScroll: true });
    } catch {
      first.focus();
    }

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== "Tab") return;

      const els = getFocusables();
      if (els.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const firstEl = els[0];
      const lastEl = els[els.length - 1];
      const activeEl = document.activeElement;

      if (e.shiftKey && (activeEl === firstEl || activeEl === node)) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && activeEl === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    // Pakai capture supaya ESC menang dulu & tidak dobel-close.
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        try {
          previouslyFocused.focus({ preventScroll: true });
        } catch {
          previouslyFocused.focus();
        }
      }
    };
  }, [active]);

  return ref;
}

export default useModalA11y;