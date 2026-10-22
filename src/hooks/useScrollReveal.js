import { useEffect } from "react";

/**
 * Sets up a global IntersectionObserver that watches all [data-reveal]
 * elements and adds the "revealed" class when they enter the viewport.
 *
 * Elements should have: data-reveal attribute
 * Optional: data-reveal-delay="1" through "8" for staggered animation
 * Optional: data-reveal="left" | "right" | "scale" for direction
 */
export function useScrollReveal() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      // Fallback: reveal everything immediately
      document.querySelectorAll("[data-reveal]").forEach((el) => {
        el.classList.add("revealed");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    const scan = () => {
      document
        .querySelectorAll("[data-reveal]:not(.revealed)")
        .forEach((el) => observer.observe(el));
    };

    scan();

    const mutationObserver = new MutationObserver(() => scan());
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);
}

export default useScrollReveal;