import { useEffect, useState } from "react";
import { loadSiteContent } from "../lib/content";

/**
 * Memuat konten situs yang bisa diedit (Home/About) sekali saat mount.
 * Mengembalikan `null` sebelum selesai dimuat, lalu objek {key: value}.
 */
export function useSiteContent() {
  const [content, setContent] = useState(null);

  useEffect(() => {
    let active = true;
    loadSiteContent().then((c) => {
      if (active) setContent(c || {});
    });
    return () => { active = false; };
  }, []);

  return content;
}

export default useSiteContent;