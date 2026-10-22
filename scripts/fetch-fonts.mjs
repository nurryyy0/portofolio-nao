// ─── Self-host Google Fonts (sekali jalan) ──────────────────────────────
// Mengunduh file woff2 yang SAMA dengan yang disajikan Google Fonts
// (Outfit + JetBrains Mono, subset latin & latin-ext) ke public/fonts/
// lalu membuat public/fonts/fonts.css. Tampilan font 100% identik —
// hanya asal file-nya yang pindah ke origin sendiri (hilangkan 2 request
// eksternal + rantai blocking).
//
// Jalankan:  node scripts/fetch-fonts.mjs
// Setelah itu: ganti <link> Google Fonts di index.html dengan
//   <link rel="stylesheet" href="/fonts/fonts.css" />

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT = new URL("../public/fonts/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const CSS_URL =
  "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap";
// UA browser modern → Google menyajikan woff2 + unicode-range per subset.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const KEEP_SUBSETS = new Set(["latin", "latin-ext"]);

async function main() {
  await mkdir(OUT, { recursive: true });
  const css = await (await fetch(CSS_URL, { headers: { "User-Agent": UA } })).text();

  // Blok @font-face dipisah per subset oleh komentar "/* subset */".
  const blocks = [];
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[^}]+\})/g;
  let m;
  while ((m = re.exec(css))) {
    const [, subset, block] = m;
    if (!KEEP_SUBSETS.has(subset)) continue;
    blocks.push({ subset, block });
  }
  if (!blocks.length) throw new Error("Tidak ada blok @font-face ditemukan (format CSS berubah?).");

  const outCss = [];
  let count = 0;
  for (const { subset, block } of blocks) {
    const family = /font-family:\s*'([^']+)'/.exec(block)[1];
    const weight = /font-weight:\s*(\d+)/.exec(block)[1];
    const url = /url\((https:\/\/[^)]+\.woff2)\)/.exec(block)[1];
    const file = `${family.toLowerCase().replace(/\s+/g, "-")}-${weight}-${subset}.woff2`;

    const buf = Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA } })).arrayBuffer());
    await writeFile(join(OUT, file), buf);
    count++;
    console.log(`${file}: ${(buf.length / 1024).toFixed(1)} KB`);

    outCss.push(block.replace(url, `./${file}`));
  }

  await writeFile(
    join(OUT, "fonts.css"),
    `/* Self-hosted Google Fonts — hasil scripts/fetch-fonts.mjs.\n` +
      `   File woff2 yang sama dengan fonts.gstatic.com (subset latin & latin-ext). */\n\n` +
      outCss.join("\n\n") +
      "\n"
  );
  console.log(`\n${count} file font → public/fonts/ + fonts.css`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
