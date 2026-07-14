import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { LOGO_SVG_INNER } from "../lib/logo-svg.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${LOGO_SVG_INNER}</svg>`;
const svgBuffer = Buffer.from(svg);

async function renderPng(size, outPath) {
  await sharp(svgBuffer, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`écrit ${path.relative(ROOT, outPath)} (${size}x${size})`);
}

async function main() {
  const iconsDir = path.join(ROOT, "public", "icons");
  await mkdir(iconsDir, { recursive: true });

  // Le fond du logo (rect 0,0 100,100) touche déjà les 4 bords : sert tel quel
  // de variante "maskable" (safe zone respectée) en plus de l'icône standard.
  await renderPng(192, path.join(iconsDir, "icon-192.png"));
  await renderPng(512, path.join(iconsDir, "icon-512.png"));

  // Convention de fichier Next.js (app/apple-icon.png) : génère automatiquement
  // le <link rel="apple-touch-icon">.
  await renderPng(180, path.join(ROOT, "app", "apple-icon.png"));

  // Convention de fichier Next.js (app/icon.png) : génère automatiquement le favicon,
  // remplaçant le favicon.ico par défaut de Create Next App (sharp ne produit pas de .ico).
  await renderPng(48, path.join(ROOT, "app", "icon.png"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
