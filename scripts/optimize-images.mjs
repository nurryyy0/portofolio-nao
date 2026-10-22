// ─── Optimasi gambar public/ (sekali jalan) ─────────────────────────────
// Kebijakan "tanpa perubahan tampilan":
//   • JPEG : resize maksimal 1600px (sisi terpanjang) + re-encode quality 78
//            (mozjpeg, progressive). Gambar ditampilkan maksimal ~600px di
//            UI, jadi perbedaan tidak terlihat.
//   • PNG  : HANYA resize lossless bila > 1600px (kualitas piksel identik).
//            Tidak dikuantisasi palet → warna/gradien tidak berubah.
//   • File asli di-backup dulu ke .image-backup/ (bisa dipulihkan).
//   • NAMA FILE TIDAK BERUBAH → referensi di Supabase/DB/OG tetap sah.
//
// Jalankan:  node scripts/optimize-images.mjs
// (butuh: npm i -D sharp)

import { readdir, mkdir, copyFile, stat } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import sharp from "sharp";

const PUBLIC = new URL("../public/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const BACKUP = new URL("../.image-backup/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const MAX_SIDE = 1600;
const JPEG_QUALITY = 78;

const EXT = new Set([".jpg", ".jpeg", ".png"]);

async function main() {
  await mkdir(BACKUP, { recursive: true });
  const files = (await readdir(PUBLIC)).filter((f) => EXT.has(extname(f).toLowerCase()));
  let savedTotal = 0;

  for (const name of files) {
    const src = join(PUBLIC, name);
    const ext = extname(name).toLowerCase();
    const before = (await stat(src)).size;

    // Backup sekali (jangan timpa backup dengan versi yang sudah diedit).
    const backupPath = join(BACKUP, name);
    try {
      await stat(backupPath);
    } catch {
      await copyFile(src, backupPath);
    }

    const img = sharp(src);
    const meta = await img.metadata();
    const needsResize = Math.max(meta.width || 0, meta.height || 0) > MAX_SIDE;

    let out;
    if (ext === ".png") {
      out = await (needsResize
        ? img.resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
        : img
      )
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer();
    } else {
      out = await img
        .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true, progressive: true })
        .toBuffer();
    }

    const after = out.length;
    if (after < before) {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(src, out);
      savedTotal += before - after;
      console.log(
        `${basename(name)}: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB` +
          `${needsResize ? ` (resize ≤${MAX_SIDE}px)` : ""}`
      );
    } else {
      console.log(`${basename(name)}: tidak berubah (${(before / 1024).toFixed(0)} KB, sudah optimal)`);
    }
  }

  console.log(`\nTotal penghematan: ${(savedTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Backup asli di: .image-backup/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
